#!/bin/bash
set -e

CONFIG_FILE="/opt/config/config.json"

echo "[init-config] ========================================="
echo "[init-config] Sub2API NodeBB Init"
echo "[init-config] ========================================="

# 1. 如果 config.json 不存在,创建它
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[init-config] Creating config.json..."
  mkdir -p /opt/config
  
  cat > "$CONFIG_FILE" <<EOF
{
  "url": "https://community.jisudeng.com",
  "port": "${PORT:-4567}",
  "bind_address": "0.0.0.0",
  "database": "mongo",
  "mongo": {
    "host": "${MONGO_HOST}",
    "port": "${MONGO_PORT:-27017}",
    "username": "${MONGO_USERNAME}",
    "password": "${MONGO_PASSWORD}",
    "database": "${MONGO_DATABASE:-sub2api_forum}"
  },
  "redis": {
    "host": "${REDIS_HOST}",
    "port": "${REDIS_PORT:-6379}",
    "password": "${REDIS_PASSWORD}"
  },
  "upload_path": "/usr/src/app/public/uploads",
  "bcrypt_rounds": 12,
  "default_locale": "zh-CN",
  "languages": ["zh-CN", "en-GB"],
  "log_level": "info"
}
EOF
  chown nodebb:nodebb "$CONFIG_FILE"
  echo "[init-config] config.json created"
fi

# 2. 更新端口到 Zeabur 注入的 PORT
if command -v node >/dev/null 2>&1; then
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    config.port = process.env.PORT || '4567';
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
    console.log('[init-config] Updated port to', config.port);
  "
fi

echo "[init-config] Final PORT: ${PORT:-4567}"
echo "[init-config] MONGO_HOST: ${MONGO_HOST}"
echo "[init-config] REDIS_HOST: ${REDIS_HOST}"
echo "[init-config] ========================================="

# 3. 启动 NodeBB
cd /usr/src/app
echo "[init-config] Starting NodeBB loader.js..."
exec node loader.js
