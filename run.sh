#!/bin/bash

# 构建 Docker 镜像
docker-compose build

# 启动 Docker 容器
docker-compose up -d

# 打印容器状态
docker ps

echo "应用已成功启动！"
