#!/bin/bash
set -e

source /opt/sub2api-forum/.env

echo "🏥 健康检查..."

if ! docker ps --format '{{.Names}}' | grep -q '^sub2api-forum$'; then
    echo "❌ NodeBB 容器未运行"
    exit 1
fi
echo "✅ NodeBB 容器运行中"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4567/community/ || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ NodeBB HTTP 返回 $HTTP_CODE"
    exit 1
fi
echo "✅ NodeBB HTTP 响应 200"

if ! docker exec sub2api-forum-mongo mongosh --quiet \
    -u nodebb -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
    --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "❌ MongoDB 连接失败"
    exit 1
fi
echo "✅ MongoDB 连接正常"

if ! docker exec sub2api-forum-redis redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG; then
    echo "❌ Redis 连接失败"
    exit 1
fi
echo "✅ Redis 连接正常"

PLUGIN_HEALTH=$(curl -s http://127.0.0.1:4567/community/api/sub2api/health || echo "")
if echo "$PLUGIN_HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ Sub2API SSO 插件正常"
else
    echo "⚠️  Sub2API SSO 插件未响应"
fi

echo ""
echo "✅ 所有检查通过"
