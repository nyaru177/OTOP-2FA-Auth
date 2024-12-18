// /config/mysql.js
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'mysql-container',
  user: 'root',
  password: 'rootpassword',
  database: 'identification',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;
