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

# 启动 Express 应用
CMD yarn start

# 容器监听的端口
EXPOSE 3020
