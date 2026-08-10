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

# 复制默认 config.json 模板到 /opt/config/
# 如果 /opt/config/config.json 不存在,使用此文件
RUN mkdir -p /opt/config && chown -R nodebb:nodebb /opt/config

# 复制配置脚本到 /usr/local/bin/
COPY init-config.sh /usr/local/bin/init-config.sh
RUN chmod +x /usr/local/bin/init-config.sh && chown nodebb:nodebb /usr/local/bin/init-config.sh

USER nodebb

# 使用自定义 CMD 直接启动 NodeBB
CMD ["/usr/local/bin/init-config.sh"]
