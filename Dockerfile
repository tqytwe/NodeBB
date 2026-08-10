# ============================================
# Sub2API NodeBB 论坛 - Zeabur Dockerfile
# 基于官方 NodeBB 镜像 + 自定义插件
# ============================================
FROM ghcr.io/nodebb/nodebb:latest

# 设置工作目录
WORKDIR /usr/src/app

# 复制自定义插件到 NodeBB 模块目录
COPY plugins/nodebb-plugin-sub2api-sso /usr/src/app/node_modules/nodebb-plugin-sub2api-sso

# 安装插件依赖（passport-oauth2）
RUN cd /usr/src/app/node_modules/nodebb-plugin-sub2api-sso && \
    npm install --production --no-audit --no-fund && \
    cd /usr/src/app && \
    chown -R nodebb:nodebb /usr/src/app/node_modules/nodebb-plugin-sub2api-sso

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-4567}/api/sub2api/health || exit 1

# Zeabur 通过 PORT 环境变量分配端口
EXPOSE 4567

# 启动 NodeBB
CMD ["node", "loader.js"]
