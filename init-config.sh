#!/bin/bash
set -e

CONFIG_DIR="${CONFIG_DIR:-/opt/config}"
CONFIG_FILE="$CONFIG_DIR/config.json"
PLUGIN_NAME="nodebb-plugin-sub2api-sso"
PLUGIN_SRC="/usr/src/app/custom-plugins/$PLUGIN_NAME"

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
// NodeBB sits behind the Zeabur gateway, so Express must trust X-Forwarded-*
// or every client IP is logged as the gateway and secure cookies misbehave.
config.trust_proxy = true;

// /opt/config files are root-owned while the app may run unprivileged; the
// directory itself is writable, so write a temp file and rename over the top.
const tmp = `${file}.tmp`;
fs.writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`);
fs.renameSync(tmp, file);
console.log(`[init-config] wrote ${file} (port=${config.port}, db=${db}, authSource=admin)`);
GENEOF

cd /usr/src/app

# ---------------------------------------------------------------------------
# Register the SSO plugin in the PERSISTED package.json.
#
# The official entrypoint symlinks $CONFIG_DIR/package.json over
# /usr/src/app/package.json and then runs `npm install`. npm prunes anything not
# declared there, which is exactly why a plugin COPY'd straight into
# node_modules disappeared at runtime ("active but not installed"). Declaring it
# as an absolute file: dependency before the handoff makes npm keep it.
# ---------------------------------------------------------------------------
if [ ! -d "$PLUGIN_SRC" ]; then
  log "ERROR: plugin source $PLUGIN_SRC missing from the image"
  exit 1
fi

# Replicate the entrypoint's seed step so there is something to edit.
if [ ! -f "$CONFIG_DIR/package.json" ]; then
  log "seeding $CONFIG_DIR/package.json from install/package.json"
  cp /usr/src/app/install/package.json "$CONFIG_DIR/package.json"
fi

PLUGIN_REGISTERED=$(node <<'PKGEOF'
const fs = require('fs');
const dir = process.env.CONFIG_DIR || '/opt/config';
const file = `${dir}/package.json`;
const name = process.env.PLUGIN_NAME;
const want = `file:${process.env.PLUGIN_SRC}`;

const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.dependencies = pkg.dependencies || {};

if (pkg.dependencies[name] === want) {
  process.stdout.write('unchanged');
} else {
  pkg.dependencies[name] = want;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(pkg, null, 2)}\n`);
  fs.renameSync(tmp, file);
  process.stdout.write('changed');
}
PKGEOF
)

log "plugin dependency in persisted package.json: ${PLUGIN_REGISTERED}"

# Link it into node_modules now so `nodebb activate` can resolve the plugin
# during first-run setup, before the entrypoint's npm install has run.
mkdir -p /usr/src/app/node_modules
ln -sfn "$PLUGIN_SRC" "/usr/src/app/node_modules/$PLUGIN_NAME"

# install_hash.md5 matches install/package.json on every boot, so the official
# build_forum() would print "No changes in package.json. Skipping build..." and
# the plugin's client assets (static/lib/main.js, styles.less) would never be
# compiled. build/ lives in the container layer, not the persistent volume, so
# key the decision off whether the built manifest already lists the plugin.
if ! grep -q "$PLUGIN_NAME" /usr/src/app/build/active_plugins.json 2>/dev/null; then
  log "built assets do not include $PLUGIN_NAME, forcing a build"
  export START_BUILD=true
else
  log "built assets already include $PLUGIN_NAME, skipping rebuild"
fi

# Detect whether NodeBB has ever been installed into this database. An empty
# `objects` collection means a fresh database that still needs `nodebb setup`.
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
    log "setup finished, activating $PLUGIN_NAME"
    ./nodebb activate "$PLUGIN_NAME" --config="$CONFIG_FILE" || \
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
