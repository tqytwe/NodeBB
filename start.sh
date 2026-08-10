#!/bin/bash
set -e

echo "[sub2api-start] Starting Sub2API NodeBB..."
echo "[sub2api-start] Zeabur PORT: ${PORT:-4567}"

# 动态修改 NodeBB config.json 的端口
if [ -f /usr/src/app/config.json ]; then
  if command -v node >/dev/null 2>&1; then
    node -e "
      const fs = require('fs');
      const configPath = '/usr/src/app/config.json';
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.port = process.env.PORT || '4567';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('[sub2api-start] Updated config.json port to', config.port);
    "
  fi
fi

# 处理 MongoDB URI（从分立字段构造）
if [ -z "$MONGO_URI" ] && [ -n "$MONGO_HOST" ]; then
  export MONGO_URI="mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT:-27017}/${MONGO_DATABASE:-sub2api_forum}"
  echo "[sub2api-start] Constructed MONGO_URI"
fi

# 输出环境变量摘要
echo "[sub2api-start] Configuration:"
echo "  PORT: ${PORT:-4567}"
echo "  SUB2API_PLATFORM_URL: ${SUB2API_PLATFORM_URL:-not set}"
echo "  NODEBB_SSO_CLIENT_ID: ${NODEBB_SSO_CLIENT_ID:-not set}"
echo "  NODEBB_SSO_ENABLED: $([ -n "$NODEBB_SSO_CLIENT_ID" ] && [ -n "$NODEBB_SSO_CLIENT_SECRET" ] && echo true || echo false)"
echo "  REDIS_HOST: ${REDIS_HOST:-not set}"

# 启动 NodeBB
echo "[sub2api-start] Starting NodeBB loader.js..."
exec node loader.js
