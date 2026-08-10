#!/bin/bash
set -e

echo "🔌 更新插件..."

cd /opt/sub2api-forum

if ! docker ps --format '{{.Names}}' | grep -q '^sub2api-forum$'; then
    echo "❌ NodeBB 容器未运行"
    exit 1
fi

echo "📦 复制插件文件..."
docker cp plugins/nodebb-plugin-sub2api-sso/. sub2api-forum:/usr/src/app/node_modules/nodebb-plugin-sub2api-sso/

echo "🔄 重启 NodeBB..."
docker restart sub2api-forum

echo "⏳ 等待启动..."
sleep 20

echo "🏥 健康检查..."
/opt/sub2api-forum/scripts/health-check.sh

echo ""
echo "✅ 插件更新完成"
