# 使用 Node.js 22 作为基础镜像
FROM node:22

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock 文件
COPY package.json yarn.lock ./

# 安装依赖
RUN yarn install

# 复制整个项目到容器中
COPY . .

# 安装 mysql-client 和 redis-client，以便与 MySQL 和 Redis 进行交互
RUN apt-get update && apt-get install -y mysql-client-core-8.0 redis-tools

# 复制初始化脚本
COPY db_init/init.sql /app/db_init/init.sql
COPY init-db.sh /app/init-db.sh

# 赋予脚本执行权限
RUN chmod +x /app/init-db.sh

# 启动 Express 应用，并执行数据库初始化
CMD /app/init-db.sh && yarn start

# 容器监听的端口
EXPOSE 3000
