const mysql = require('mysql2');

// 创建连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'rootpassword',
  database: process.env.MYSQL_DATABASE || 'identification',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// 测试连接
promisePool.getConnection()
  .then(connection => {
    console.log('成功连接到 MySQL 数据库');
    console.log('MySQL 连接地址:', {
      host: pool.config.connectionConfig.host,
      user: pool.config.connectionConfig.user,
      database: pool.config.connectionConfig.database
    });
    connection.release();
  })
  .catch(err => {
    console.error('MySQL 连接错误:', err);
    console.error('MySQL 配置:', {
      host: pool.config.connectionConfig.host,
      user: pool.config.connectionConfig.user,
      database: pool.config.connectionConfig.database
    });
  });

// 添加错误监听
pool.on('error', (err) => {
  console.error('MySQL pool error:', err);
});

module.exports = promisePool;