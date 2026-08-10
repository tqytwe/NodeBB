#!/bin/bash
set -e

cd /opt/sub2api-forum

if [ ! -f .env ]; then
    echo "❌ 缺少 .env 文件"
    exit 1
fi

source .env

cat > nodebb-config/config.json <<EOF2
{
  "url": "${SUB2API_PLATFORM_URL}/community",
  "secret": "${NODEBB_APP_SECRET}",
  "relative_path": "/community",
  "port": "4567",
  "bind_address": "0.0.0.0",
  "database": "mongo",
  "mongo": {
    "host": "mongo",
    "port": 27017,
    "username": "nodebb",
    "password": "${MONGO_ROOT_PASSWORD}",
    "database": "sub2api_forum"
  },
  "redis": {
    "host": "redis",
    "port": 6379,
    "password": "${REDIS_PASSWORD}"
  },
  "upload_path": "/usr/src/app/public/uploads",
  "bcrypt_rounds": 12,
  "default_locale": "zh-CN",
  "languages": ["zh-CN", "en-GB"],
  "log_level": "info",
  "sessionKey": "${NODEBB_SESSION_KEY}",
  "minify": ["js", "css"],
  "socket.io": {
    "transports": ["websocket", "polling"],
    "origins": "${SUB2API_PLATFORM_URL}:*"
  }
}
EOF2

chmod 600 nodebb-config/config.json

echo "✅ NodeBB config.json 已生成"
