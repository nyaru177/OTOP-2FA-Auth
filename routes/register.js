const express = require('express');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const promisePool = require('../config/mysql'); // 假设你使用了 mysql2 的连接池
const sendMail = require('../public/javascripts/mail.js'); // 引入邮件发送模块
const router = express.Router();
const redisClient = require('../config/redis');

// 配置验证码发送限流
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

router.get('/register', (req, res) => {
  res.render('register');
});
// 第一步：验证用户名、邮箱和密码
router.post('/register/step1',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('email').isEmail().withMessage('邮箱格式不正确'),
    body('password')
      .isLength({ min: 8 }).withMessage('密码长度至少为8个字符')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('密码必须包含至少一个大写字母、一个小写字母、一个数字和一个特殊字符(@$!%*?&)'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('两次输入的密码不一致')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      const [rows] = await promisePool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
      if (rows.length > 0) {
        return res.status(400).json({ success: false, message: '用户名或者邮箱已注册' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      req.session.username = username;
      req.session.email = email;
      req.session.password_hash = hashedPassword;

      res.status(200).json({ success: true, message: '验证通过' });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// 带过期和等待时间限制的发送验证码接口
router.post('/register/step2/send-code', verificationCodeLimiter,async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    // 检查是否在等待时间内
    const lastSentTime = await redisClient.get(`lastSentTime:${email}`);
    const currentTime = Date.now();

    if (lastSentTime) {
      const elapsedTime = (currentTime - parseInt(lastSentTime, 10)) / 1000; // 转换为秒

      if (elapsedTime < 60) {
        return res.status(429).json({ 
          success: false, 
          message: `请等待 ${Math.ceil(60 - elapsedTime)} 秒后再请求验证码` 
        });
      }
    }

    // 生成随机验证码
    const code = Math.random().toString(36).substr(2, 6);

    // 保存验证码和发送时间到 Redis，设置3分钟过期时间
    await redisClient.set(`registerVerificationCode:${email}`, code, 'EX', 180);
    await redisClient.set(`lastSentTime:${email}`, currentTime.toString(), 'EX', 60);

    // 使用 sendMail 发送邮件
    await sendMail(email, '邮箱验证码', `您的验证码是：${code}，有效期为3分钟。`);
    console.log('验证码已发送:', code);

    res.status(200).json({ success: true, message: 'Verification code sent to email' });
  } catch (error) {
    console.error('邮件发送失败:', error);
    res.status(500).json({ success: false, message: 'Failed to send verification code' });
  }
});

router.post('/register/step2/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: '请输入邮箱和验证码' });
  }

  try {
    // 从 Redis 中获取存储的验证码
    const storedCode = await redisClient.get(`registerVerificationCode:${email}`);

    if (!storedCode) {
      return res.status(400).json({ success: false, message: '未发送验证码至此邮箱或已过期' });
    }

    // 比较验证码
    if (storedCode === code) {
      // 验证成功，删除存储的验证码
      await redisClient.del(`registerVerificationCode:${email}`);
      res.status(200).json({ success: true, message: 'Verification successful. Proceed to step 3.' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }
  } catch (error) {
    console.error('验证码验证失败:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 第三步: 生成 TOTP 密钥，保存到数据库，并返回二维码
router.get('/register/step3/generate-qr', async (req, res) => {
  const { username, email, password_hash } = req.session;

  if (!username || !email || !password_hash) {
    return res.status(400).json({ success: false, message: 'Missing session data' });
  }

  try {
    const secret = speakeasy.generateSecret({ length: 20 });
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `${username}@OTOP`,
      issuer: 'OTOP SECRET KEY',
      algorithm: 'sha1',
    });

    QRCode.toDataURL(otpauthUrl, async (err, dataUrl) => {
      if (err) {
        console.error('Error generating QR code:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate QR code' });
      }


      await promisePool.query(
        'INSERT INTO users (username, email, password_hash, totp_secret) VALUES (?, ?, ?, ?)',
        [username, email, password_hash, secret.base32]
      );

      req.session.destroy();

      res.status(200).json({ 
        success: true, 
        message: '注册成功.',
        qrCodeUrl: dataUrl 
      });
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
module.exports = router;
