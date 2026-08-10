#!/bin/bash
set -e

echo "========================================="
echo "Sub2API NodeBB 论坛部署"
echo "时间: $(date)"
echo "========================================="

cd /opt/sub2api-forum

# 1. 检查 .env
if [ ! -f .env ]; then
    echo "❌ 缺少 .env 文件"
    echo "请执行: cp .env.example .env && vim .env"
    exit 1
fi

source .env

# 2. 验证必需的环境变量
REQUIRED_VARS=(
    "SUB2API_PLATFORM_URL"
    "NODEBB_SSO_CLIENT_ID"
    "NODEBB_SSO_CLIENT_SECRET"
    "NODEBB_SSO_AUTHORIZE_URL"
    "NODEBB_SSO_TOKEN_URL"
    "NODEBB_SSO_USERINFO_URL"
    "NODEBB_WEBHOOK_SECRET"
    "NODEBB_APP_SECRET"
    "NODEBB_SESSION_KEY"
    "MONGO_ROOT_PASSWORD"
    "REDIS_PASSWORD"
)

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ] || [[ "${!VAR}" == *"REPLACE_WITH"* ]]; then
        echo "❌ 环境变量 $VAR 未设置或仍是占位符"
        exit 1
    fi
done

echo "✅ 环境变量检查通过"

# 3. 创建目录
mkdir -p mongo-data mongo-config redis-data nodebb-uploads nodebb-config backups

# 4. 生成 NodeBB config.json（如不存在）
if [ ! -f nodebb-config/config.json ]; then
    echo "📝 生成 NodeBB config.json..."
    ./scripts/generate-config.sh
fi

# 5. 拉取最新镜像
echo "📥 拉取最新镜像..."
docker-compose pull

# 6. 启动容器
echo "🚀 启动 Docker Compose..."
docker-compose up -d

# 7. 等待 MongoDB 启动
echo "⏳ 等待 MongoDB 启动(30秒)..."
sleep 30

# 8. 健康检查
echo "🏥 健康检查..."
./scripts/health-check.sh

echo "========================================="
echo "✅ 部署完成"
echo ""
echo "论坛地址: ${SUB2API_PLATFORM_URL}/community/"
echo "管理后台: ${SUB2API_PLATFORM_URL}/community/admin"
echo ""
echo "下一步:"
echo "  1. 初始化 NodeBB: docker exec -it sub2api-forum ./nodebb setup"
echo "  2. 配置 Nginx: 将 nginx-forum.conf 添加到主平台 nginx 配置"
echo "  3. 重载 Nginx: sudo nginx -t && sudo nginx -s reload"
echo "========================================="
