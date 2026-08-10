#!/bin/bash
set -e

CONFIG_FILE="/opt/config/config.json"

echo "[nodebb-start] ========================================="
echo "[nodebb-start] Sub2API NodeBB"
echo "[nodebb-start] ========================================="
echo "[nodebb-start] PORT: ${PORT:-4567}"

# 1. 生成 config.json（如果不存在）
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[nodebb-start] Creating config.json..."
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
  echo "[nodebb-start] config.json created"
else
  echo "[nodebb-start] config.json already exists"
fi

# 2. 确保 PORT 写入 config.json（覆盖 Zeabur 注入的端口）
if command -v node >/dev/null 2>&1; then
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    config.port = process.env.PORT || '4567';
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
    console.log('[nodebb-start] Updated port to', config.port);
  "
fi

# 3. 切换到 NodeBB 工作目录
cd /usr/src/app

# 4. 启动 NodeBB
echo "[nodebb-start] Starting NodeBB loader.js..."
exec node loader.js
