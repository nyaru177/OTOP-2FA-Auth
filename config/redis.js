const Redis = require('redis');

// 创建 Redis 客户端实例
const redis = Redis.createClient({
  host: 'redis-container', // 本地机器连接时使用 localhost
  port: 6379,        // Redis 容器的端口
});

redis.connect() // 显式调用连接方法
  .then(() => {
    console.log('成功连接到 Redis');
  })
  .catch((err) => {
    console.error('Redis 连接错误:', err);
  });

module.exports = redis; // 导出 Redis 客户端实例
