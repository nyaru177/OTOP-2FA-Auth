#!/bin/bash

# 等待 MySQL 容器启动
echo "Waiting for MySQL to start..."
until mysql -h mysql-container -u root -prootpassword -e "SHOW DATABASES"; do
  sleep 2
done

# 执行数据库初始化
echo "Initializing database..."
mysql -h mysql-container -u root -prootpassword auth_system_db < /app/db_init/init.sql

# 启动 Express 应用
echo "Starting Express application..."
yarn start
