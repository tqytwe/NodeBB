# ============================================
# Sub2API NodeBB 论坛 - Zeabur Dockerfile
# ============================================
FROM ghcr.io/nodebb/nodebb:latest

USER root

# 复制自定义插件
COPY plugins/nodebb-plugin-sub2api-sso/ /usr/src/app/node_modules/nodebb-plugin-sub2api-sso/

# 安装插件依赖
RUN cd /usr/src/app/node_modules/nodebb-plugin-sub2api-sso && \
    npm install --production --no-audit --no-fund --unsafe-perm && \
    chown -R nodebb:nodebb /usr/src/app/node_modules/nodebb-plugin-sub2api-sso

# 确保 /opt/config 目录存在
RUN mkdir -p /opt/config && chown -R nodebb:nodebb /opt/config

# 复制启动包装脚本
COPY nodebb-start.sh /usr/local/bin/nodebb-start.sh
RUN chmod +x /usr/local/bin/nodebb-start.sh && chown nodebb:nodebb /usr/local/bin/nodebb-start.sh

USER nodebb

# 覆盖 CMD，直接调用我们的启动脚本
CMD ["/usr/local/bin/nodebb-start.sh"]
