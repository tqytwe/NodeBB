#!/bin/bash
set -e

source /opt/sub2api-forum/.env
BACKUP_DIR="${BACKUP_DIR:-/opt/sub2api-forum/backups}"

if [ -z "$1" ]; then
    echo "用法: $0 <timestamp>"
    echo ""
    echo "可用备份:"
    ls $BACKUP_DIR 2>/dev/null | grep -E "^mongo_" | sort -r | head -10 || echo "  (无备份)"
    exit 1
fi

TIMESTAMP=$1

if [ ! -d "$BACKUP_DIR/mongo_$TIMESTAMP" ]; then
    echo "❌ 备份不存在: $BACKUP_DIR/mongo_$TIMESTAMP"
    exit 1
fi

echo "⏪ 准备回滚到 $TIMESTAMP"
echo ""
echo "⚠️  此操作将覆盖当前数据!"
read -p "确认回滚? 输入 'yes' 继续: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ 取消"
    exit 0
fi

docker stop sub2api-forum

docker cp $BACKUP_DIR/mongo_$TIMESTAMP sub2api-forum-mongo:/data/backup_restore
docker exec sub2api-forum-mongo mongorestore \
    -u nodebb \
    -p "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --drop \
    /data/backup_restore

if [ -f "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" ]; then
    rm -rf /opt/sub2api-forum/nodebb-uploads/*
    tar xzf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz -C /opt/sub2api-forum
fi

docker start sub2api-forum
sleep 15

/opt/sub2api-forum/scripts/health-check.sh

echo ""
echo "✅ 回滚完成"
