const express = require('express');
const bcrypt = require('bcrypt');
const sendMail = require('../public/javascripts/mail.js'); // 引入邮件发送模块
const promisePool = require('../config/mysql'); // MySQL 连接池
const redisClient = require('../config/redis'); // 引入 Redis 客户端实例
const crypto = require('crypto');
const router = express.Router();
const speakeasy = require('speakeasy');  // 用于生成和验证TOTP
const rateLimit = require('express-rate-limit');

// 配置限流
const verificationCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟时间窗口
  max: 5, // 每个邮箱在15分钟内最多发送5次
  handler: (req, res) => {
    res.status(429).json({ 
      success: false, 
      message: '验证码请求过于频繁，请15分钟后再试' 
    });
  },
  keyGenerator: (req) => req.body.email, // 使用邮箱地址作为限流的 key
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录页面路由
router.get('/login', (req, res) => {
  const csrfToken = req.csrfToken();
  res.render('login', { csrfToken });  // 将CSRF令牌传递给视图
  // console.log(csrfToken);
});

// 邮箱和密码登录验证
router.post('/login-with-password', async (req, res) => {
  // console.log("req.body._csrf",req.body._csrf);
  const { usernameOrEmail, password } = req.body;
  const key = `loginAttempts:${usernameOrEmail}`;

  try {
    // 检查 Redis 连接
    if (!redisClient.isOpen) {
      console.error('Redis 客户端已关闭');
      return res.status(500).json({ success: false, message: '服务器错误' });
    }

    // 获取登录失败次数
    const attempts = await redisClient.get(key);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    // 检查是否已被锁定
    if (attemptCount > 5) {
      return res.status(429).json({ 
        success: false, 
        message: '此账户登录尝试次数过多，请15分钟后重试' 
      });
    }

    // 查询用户，这里查询了存放的所有信息
    const [rows] = await promisePool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    );

    // 准备警告信息
    let warningMessage = '';
    if (attemptCount >= 3) {
      warningMessage = `再错误${5 - attemptCount}次，账户将被锁定 15 分钟。`;
    }

    if (rows.length === 0) {
      // 用户名或邮箱不存在
      await redisClient.incr(key);
      await redisClient.expire(key, 900); // 15分钟过期
      
      return res.status(400).json({ 
        success: false, 
        message: `用户名或密码错误。${warningMessage}`.trim() // 合并警告信息
      });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // 密码错误
      await redisClient.incr(key);
      await redisClient.expire(key, 900);
      
      return res.status(400).json({ 
        success: false, 
        message: `用户名或密码错误。${warningMessage}`.trim() // 合并警告信息
      });
    }

    // 登录成功，清除失败计数
    await redisClient.del(key);
    // 只存储必要的信息，避免存储密钥等文件
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    
    if (isPasswordValid) {
      // 生成 nonce
      const nonce = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
  
      // 生成用户指纹 (包含 IP、User-Agent 等信息的哈希值)
      const fingerprint = crypto
        .createHash('sha256')
        .update(`${req.ip}-${req.headers['user-agent']}-${user.id}`)
        .digest('hex');

      // 存储到 session
      req.session.nonce = nonce;
      req.session.timestamp = timestamp;
      req.session.fingerprint = fingerprint;

      return res.status(200).json({ 
        success: true, 
        message: '登录成功，跳转到 2FA 页面',
        nonce,
        timestamp,
        fingerprint
      });
    }

  } catch (error) {
    console.error('登录验证时发生错误:', error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 发送验证码的路由
router.post('/send-verification-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: '邮箱地址不能为空' });
  }

  try {
    // 生成验证码（6位数字）
    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    
    // 生成安全特征
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent']}-${email}`)
      .digest('hex');

    // 将安全特征存储到session
    req.session.emailVerification = {
      nonce,
      timestamp,
      fingerprint,
      email
    };

    // 只存储验证码到Redis
    await redisClient.set(`loginVerificationCode:${email}`, verificationCode, 'EX', 180);

    // 发送验证码邮件
    await sendMail(email, '登录验证码', `您的验证码是：${verificationCode}`);

    res.status(200).json({ 
      success: true, 
      message: '验证码已发送，请检查您的邮箱'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '验证码发送失败，请稍后再试' });
  }
});

// 验证验证码
router.post('/login-with-email', verificationCodeLimiter, async (req, res) => {
  const { email, 'verification-code': verificationCode } = req.body;

  if (!email || !verificationCode) {
    return res.status(400).json({ success: false, message: '邮箱和验证码是必需的' });
  }

  try {
    // 从session中获取验证信息
    const verificationData = req.session.emailVerification;
    if (!verificationData || verificationData.email !== email) {
      return res.status(400).json({ success: false, message: '验证信息无效' });
    }

    // 验证安全特征
    const currentFingerprint = crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent']}-${email}`)
      .digest('hex');

    // 验证所有特征
    if (verificationData.fingerprint !== currentFingerprint ||
        Math.abs(Date.now() - verificationData.timestamp) > 180000) { // 3分钟超时
      return res.status(400).json({ 
        success: false, 
        message: '验证信息无效或已过期' 
      });
    }

    // 从Redis获取验证码
    const storedCode = await redisClient.get(`loginVerificationCode:${email}`);

    if (!storedCode) {
      return res.status(400).json({ success: false, message: '验证码已过期' });
    }

    // 比较验证码
    if (storedCode === verificationCode) {
      // 验证成功，清除验证数据
      await redisClient.del(`loginVerificationCode:${email}`);
      delete req.session.emailVerification;

      // 查询数据库以获取用户信息
      const [rows] = await promisePool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: '用户不存在' });
      }

      const user = rows[0];

      // 设置会话
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email
      };

      // 设置邮箱验证标志，表示已完成验证
      req.session.isEmailVerified = true;

      // 设置cookie并返回成功信息
      res.cookie('user', user.username, { httpOnly: true, maxAge: 3600000 }); // 设置一个小时的有效期
      return res.status(200).json({ success: true, message: '验证码验证成功，登录成功' });
    } else {
      return res.status(400).json({ success: false, message: '无效的验证码' });
    }
  } catch (error) {
    console.error('验证码验证失败:', error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
});

router.get('/twoFactorVerify', (req, res) => {
  const csrfToken = req.csrfToken();
  res.render('twoFactor', { csrfToken });  // 将CSRF令牌传递给视图
});

// 2FA 验证路由
router.post('/twoFactorVerify', async (req, res) => {
  const { otp } = req.body;  // 从请求体中获取TOTP

  if (!otp) {
    return res.status(400).json({ success: false, message: '验证码是必需的' });
  }

  try {
    // 从session中获取用户名或邮箱(这里选择用户名，上一步查询到的)
    const usernameOrEmail = req.session.user.username;

    if (!usernameOrEmail) {
      return res.status(400).json({ success: false, message: '用户未登录' });
    }

    // 查询数据库：通过用户名或邮箱来查找用户
    const [rows] = await promisePool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    );
    console.log(rows);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: '用户不存在' });
    }

    const user = rows[0];

    // 在 2FA 验证时检查所有特征
    const nonce = req.session.nonce;
    const timestamp = req.session.timestamp;
    const storedFingerprint = req.session.fingerprint;

    // 重新生成当前请求的指纹
    const currentFingerprint = crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent']}-${user.id}`)
      .digest('hex');

    // 验证所有特征
    if (!nonce || !timestamp || !storedFingerprint || 
        storedFingerprint !== currentFingerprint ||
        Math.abs(Date.now() - timestamp) > 300000) { // 5分钟超时
      return res.status(400).json({ 
        success: false, 
        message: '验证失败，请重新登录' 
      });
    }

    // 使用speakeasy来验证TOTP
    const isValidOtp = speakeasy.totp.verify({
      secret: user.totp_secret,  // 从数据库中获取存储的TOTP密钥
      encoding: 'base32',
      token: otp,
    });

    if (!isValidOtp) {
      return res.status(400).json({ success: false, message: '无效的验证码' });
    }

    // 验证通过，清除nonce和时间戳
    delete req.session.nonce;
    delete req.session.timestamp;
    req.session.is2faVerified = true;
    // 返回成功信息
    res.cookie('user', user.username, { httpOnly: true, maxAge: 3600000 }); // 设置一个小时的有效期
    return res.status(200).json({ success: true, message: '2FA 验证成功，登录成功' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
});

router.get('/logout', (req, res) => {
  // 清除 session 和 cookie
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('退出失败');
    }

    res.clearCookie('user');
    res.redirect('/'); // 重定向到首页
  });
});


module.exports = router;
