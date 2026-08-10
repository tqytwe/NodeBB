#!/bin/bash
set -e

CONFIG_DIR="${CONFIG_DIR:-/opt/config}"
CONFIG_FILE="$CONFIG_DIR/config.json"

log() { echo "[init-config] $*"; }

log "========================================="
log "Sub2API NodeBB init"
log "========================================="
log "PORT=${PORT:-4567}"
log "MONGO_HOST=${MONGO_HOST}"
log "MONGO_PORT=${MONGO_PORT}"
log "MONGO_DATABASE=${MONGO_DATABASE:-sub2api_forum}"

mkdir -p "$CONFIG_DIR"

# NodeBB's getConnectionString() builds mongodb://user:pass@host:port/db without
# authSource. Zeabur creates the mongo root user in the `admin` database, so the
# generated string always fails with AuthenticationFailed. Setting mongo.uri wins
# over that construction (`return uri || ...`), so we build it ourselves.
export NODEBB_URL="${NODEBB_URL:-https://community.jisudeng.com}"
export MONGO_DATABASE="${MONGO_DATABASE:-sub2api_forum}"
export MONGO_PORT="${MONGO_PORT:-27017}"
export NODEBB_PORT="${PORT:-4567}"

node <<'GENEOF'
const fs = require('fs');
const path = process.env.CONFIG_DIR || '/opt/config';
const file = `${path}/config.json`;

const enc = encodeURIComponent;
const user = process.env.MONGO_USERNAME || '';
const pass = process.env.MONGO_PASSWORD || '';
const host = process.env.MONGO_HOST || '127.0.0.1';
const port = process.env.MONGO_PORT || '27017';
const db = process.env.MONGO_DATABASE || 'sub2api_forum';

const cred = user && pass ? `${enc(user)}:${enc(pass)}@` : '';
const uri = `mongodb://${cred}${host}:${port}/${db}?authSource=admin`;

let config = {};
if (fs.existsSync(file)) {
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.log('[init-config] existing config.json unparseable, regenerating');
    config = {};
  }
}

config.url = process.env.NODEBB_URL;
config.port = process.env.NODEBB_PORT;
config.bind_address = '0.0.0.0';
config.database = 'mongo';
config.mongo = { uri, host, port, username: user, password: pass, database: db };
config.upload_path = config.upload_path || '/usr/src/app/public/uploads';
config.bcrypt_rounds = config.bcrypt_rounds || 12;
config.default_locale = config.default_locale || 'zh-CN';
config.languages = config.languages || ['zh-CN', 'en-GB'];
config.log_level = config.log_level || 'info';

fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`[init-config] wrote ${file} (port=${config.port}, db=${db}, authSource=admin)`);
GENEOF

# Detect whether NodeBB has ever been installed into this database. An empty
# `objects` collection means a fresh database that still needs `nodebb setup`.
cd /usr/src/app

set +e
INSTALLED=$(node -e '
const { MongoClient } = require("mongodb");
const cfg = require(`${process.env.CONFIG_DIR || "/opt/config"}/config.json`);
(async () => {
  let client;
  try {
    client = await MongoClient.connect(cfg.mongo.uri, {
      connectTimeoutMS: 20000,
      serverSelectionTimeoutMS: 20000,
    });
    const n = await client.db(cfg.mongo.database).collection("objects").countDocuments();
    process.stdout.write(n > 0 ? "yes" : "no");
  } catch (err) {
    process.stdout.write(`error:${err.codeName || err.message}`);
  } finally {
    if (client) await client.close();
  }
})();
')
set -e

log "database installed check: ${INSTALLED}"

case "$INSTALLED" in
  no)
    log "fresh database, running one-time nodebb setup"
    if [ -z "$NODEBB_ADMIN_USERNAME" ] || [ -z "$NODEBB_ADMIN_PASSWORD" ] || [ -z "$NODEBB_ADMIN_EMAIL" ]; then
      log "ERROR: NODEBB_ADMIN_USERNAME / NODEBB_ADMIN_PASSWORD / NODEBB_ADMIN_EMAIL"
      log "ERROR: must all be set for automated setup. Refusing to fall back to"
      log "ERROR: the interactive web installer."
      exit 1
    fi
    # NODEBB_DB_* keys are namespaced by NODEBB_DB in src/install.js, and the
    # mongo credentials already live in config.json, so only pass the admin
    # values plus the database driver name.
    export NODEBB_DB=mongo
    ./nodebb setup --config="$CONFIG_FILE" --skip-build || {
      log "ERROR: nodebb setup failed"
      exit 1
    }
    log "setup finished, activating sub2api-sso plugin"
    ./nodebb activate nodebb-plugin-sub2api-sso --config="$CONFIG_FILE" || \
      log "WARN: plugin activation failed, activate it from the admin panel"
    ;;
  yes)
    log "database already initialised, skipping setup"
    ;;
  *)
    log "ERROR: cannot reach mongo (${INSTALLED})"
    log "ERROR: check MONGO_HOST / MONGO_PORT / MONGO_USERNAME / MONGO_PASSWORD"
    exit 1
    ;;
esac

# Hand off to the official entrypoint so its upgrade/build/start_forum logic and
# NODEBB_ADDITIONAL_PLUGINS handling still run. config.json now exists, so it
# takes the start_forum branch instead of the web installer.
log "handing off to official entrypoint"
exec /usr/local/bin/entrypoint.sh "$@"
