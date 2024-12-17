var express = require('express');
var router = express.Router();

// 处理首页请求
router.get('/', (req, res) => {
  if (!req.session.user || (!req.session.is2faVerified && !req.session.isEmailVerified)) {
    return res.redirect('/login'); // 如果用户没有登录或未通过2FA验证或邮箱验证，重定向到登录页面
  }

  // 用户已登录，显示首页内容
  res.render('index', { user: req.session.user });
});

// 处理仪表盘请求
router.get('/dashboard', (req, res) => {
  if (!req.session.user || (!req.session.is2faVerified && !req.session.isEmailVerified)) {
    return res.redirect('/login'); // 如果用户没有登录或未通过2FA验证或邮箱验证，重定向到登录页面
  }

  // 用户已登录，显示仪表盘内容
  res.render('index', { user: req.session.user });
});

module.exports = router;