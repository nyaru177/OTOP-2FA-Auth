var express = require('express');  // 引入 express
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var createError = require('http-errors');
const session = require('express-session');
const {RedisStore} = require("connect-redis")
const redis = require('./config/redis');  // 引入 Redis 客户端实例
var csurf = require('csurf');

// 创建 express 应用实例
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');  // 如果你想使用 pug，可以改为 'pug'

// 使用日志、cookie 解析、body 解析等中间件
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
  store: new RedisStore({ client: redis }),  // 创建 RedisStore 实例，并传入 Redis 客户端
  secret: '2021141490273_wanglei',  // 用来加密 session ID
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,  // 禁止 JavaScript 访问 cookie
    maxAge: 3600000,  // 设置 session 有效期为1小时
  }
}));
// 配置CSRF保护
app.use(csurf());

// 引入路由模块
var indexRouter = require('./routes/index');  // 首页路由
var registerRouter = require('./routes/register') //注册路由
var loginRouter = require('./routes/login') //登录路由// 路由配置
app.use('/', indexRouter);  // 首页路由
app.use('',registerRouter) // 注册路由
app.use('',loginRouter) // 登录路由
// 捕获 404 错误并转发到错误处理器
app.use(function(req, res, next) {
  next(createError(404));
});

// 错误处理器
app.use(function(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    // CSRF令牌验证失败
    res.status(403);
    res.send('表单已过期，请刷新页面后重试');
  } else {
    // 其他错误
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
  }
});
/*

  启动服务器集成到了bin/www文件中
*/
// // 启动服务器
// var http = require('http');
// const { log } = require('console');
// var debug = require('debug')('myapp:server');

// // 设置端口
// var port = normalizePort(process.env.PORT || '3020');
// app.set('port', port);

// // 创建 HTTP 服务器并监听端口
// var server = http.createServer(app);
// server.listen(port);
// server.on('error', onError);
// server.on('listening', onListening);

// 端口转换函数
function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
}

// 错误事件处理
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// 监听事件处理
function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

// 导出app实例
module.exports = app;
