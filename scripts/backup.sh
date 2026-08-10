#!/bin/bash
set -e

source /opt/sub2api-forum/.env

BACKUP_DIR="${BACKUP_DIR:-/opt/sub2api-forum/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=${BACKUP_KEEP_DAYS:-30}

mkdir -p $BACKUP_DIR

echo "📦 开始备份 ($TIMESTAMP)..."

docker exec sub2api-forum-mongo mongodump \
    -u nodebb \
    -p "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --out /data/backup_$TIMESTAMP 2>/dev/null

docker cp sub2api-forum-mongo:/data/backup_$TIMESTAMP $BACKUP_DIR/mongo_$TIMESTAMP

tar czf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz -C /opt/sub2api-forum nodebb-uploads/

docker exec sub2api-forum-redis redis-cli -a "$REDIS_PASSWORD" BGSAVE > /dev/null 2>&1
sleep 5
docker cp sub2api-forum-redis:/data/dump.rdb $BACKUP_DIR/redis_$TIMESTAMP.rdb 2>/dev/null || true

find $BACKUP_DIR -type d -mtime +$KEEP_DAYS -name "mongo_*" -exec rm -rf {} +
find $BACKUP_DIR -type f -mtime +$KEEP_DAYS \( -name "uploads_*" -o -name "redis_*" \) -delete

echo "✅ 备份完成: $BACKUP_DIR"
