#!/bin/bash
set -e

echo "[sub2api-start] Starting Sub2API NodeBB..."
echo "[sub2api-start] Zeabur PORT: ${PORT:-4567}"

# Zeabur 期望 config.json 在 /opt/config/config.json
ZEABUR_CONFIG="/opt/config/config.json"
APP_CONFIG="/usr/src/app/config.json"

# 创建 /opt/config 目录
mkdir -p /opt/config

# ============================================
# 1. 处理 MongoDB 完整 URI
# ============================================
# Zeabur 模板期望 MONGO_CONNECTION_STRING
if [ -z "$MONGO_CONNECTION_STRING" ] && [ -n "$MONGO_URI" ]; then
  export MONGO_CONNECTION_STRING="$MONGO_URI"
  echo "[sub2api-start] Aliased MONGO_URI to MONGO_CONNECTION_STRING"
fi

if [ -z "$MONGO_CONNECTION_STRING" ] && [ -n "$MONGO_HOST" ]; then
  export MONGO_CONNECTION_STRING="mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT:-27017}/${MONGO_DATABASE:-sub2api_forum}"
  echo "[sub2api-start] Constructed MONGO_CONNECTION_STRING from individual fields"
fi

# ============================================
# 2. 处理 Redis URI
# ============================================
if [ -z "$REDIS_CONNECTION_STRING" ] && [ -n "$REDIS_HOST" ]; then
  export REDIS_CONNECTION_STRING="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT:-6379}"
  echo "[sub2api-start] Constructed REDIS_CONNECTION_STRING"
fi

# ============================================
# 3. 写入 config.json 到 /opt/config/
# ============================================
cat > "$ZEABUR_CONFIG" <<EOF
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

echo "[sub2api-start] Wrote config.json to $ZEABUR_CONFIG"

# ============================================
# 4. 输出配置摘要
# ============================================
echo "[sub2api-start] Configuration summary:"
echo "  PORT: ${PORT:-4567}"
echo "  CONFIG_FILE: $ZEABUR_CONFIG"
echo "  SUB2API_PLATFORM_URL: ${SUB2API_PLATFORM_URL:-not set}"
echo "  NODEBB_SSO_CLIENT_ID: ${NODEBB_SSO_CLIENT_ID:-not set}"
echo "  NODEBB_SSO_ENABLED: $([ -n "$NODEBB_SSO_CLIENT_ID" ] && [ -n "$NODEBB_SSO_CLIENT_SECRET" ] && echo true || echo false)"

# ============================================
# 5. 启动 NodeBB
# ============================================
echo "[sub2api-start] Starting NodeBB loader.js..."
exec node loader.js
