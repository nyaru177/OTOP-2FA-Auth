const Redis = require('redis');
  // 创建 Redis 客户端实例
const redis = Redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
});

redis.connect() // 显式调用连接方法
  .then(() => {
    console.log('成功连接到 Redis');
    console.log('Redis 连接地址:', process.env.REDIS_HOST);
  })
  .catch((err) => {
    console.error('Redis 连接错误:', err);
  });

module.exports = redis; // 导出 Redis 客户端实例
