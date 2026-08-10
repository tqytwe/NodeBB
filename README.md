# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB，与 Sub2API 主平台账号互通。

## 快速开始

```bash
# 生成密钥
echo "NODEBB_SSO_SECRET=$(openssl rand -hex 32)"
echo "NODEBB_WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo "MONGO_ROOT_PASSWORD=$(openssl rand -hex 32)"
echo "REDIS_PASSWORD=$(openssl rand -hex 32)"
echo "NODEBB_APP_SECRET=$(openssl rand -hex 32)"
echo "NODEBB_SESSION_KEY=$(openssl rand -hex 32)"

# 配置 .env
cp .env.example .env
vim .env  # 粘贴上面生成的密钥

# 部署
./scripts/deploy.sh

# 初始化
docker exec -it sub2api-forum ./nodebb setup

# 健康检查
./scripts/health-check.sh
```

## 架构

- 主平台：`sub2api` (独立仓库)
- 论坛：`NodeBB` (本仓库)
- 部署方式：同域名 `/community/` 路径反代
- 账号互通：OAuth2 SSO
- 资产同步：Webhook + 定期对账
- VIP 复用：主平台 V0-V6 → 论坛 vip-0 ~ vip-6

## 目录结构

```
.
├── docker-compose.yml             # Docker Compose 主配置
├── .env.example                   # 环境变量示例
├── nginx-forum.conf               # Nginx 反代配置片段
├── nodebb-config/
│   └── config.json.example        # NodeBB 配置示例
├── mongo-config/
│   └── mongod.conf                # MongoDB 配置
├── scripts/
│   ├── deploy.sh                  # 部署脚本
│   ├── generate-config.sh         # 生成 NodeBB config.json
│   ├── health-check.sh            # 健康检查
│   ├── backup.sh                  # 备份脚本
│   ├── rollback.sh                # 回滚脚本
│   └── update-plugins.sh          # 更新插件
├── plugins/
│   └── nodebb-plugin-sub2api-sso/ # 自定义 SSO 插件
└── .github/workflows/
    └── deploy.yml                 # GitHub Actions 自动部署
```

## 完整文档

详细部署说明、环境变量、API 契约、检查点文档位于 Sub2API 主仓库 `docs/forum-integration/`。

主要文档：
- 部署指南
- 端口冲突排查
- GitHub 配置手册
- 规范文档（架构、API、数据库、配置）
- 检查点追踪

## 端口

- 4567: NodeBB（主机监听 127.0.0.1，由 Nginx 反代）
- 27017: MongoDB（Docker 内部网络）
- 6379: Redis（Docker 内部网络，不与主平台 Redis 冲突）

## License

MIT
