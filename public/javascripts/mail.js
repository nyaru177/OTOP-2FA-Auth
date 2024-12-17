// public/javascript/mail.js
const nodemailer = require('nodemailer');

// 邮件发送器配置
const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: '1770221228@qq.com', // 你的QQ邮箱地址
    pass: 'ygpuhvzhoryjfbja' // QQ邮箱授权码
  }
});

/**
 * 发送邮件
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} text - 邮件正文
 * @returns {Promise} - 返回发送邮件的 Promise
 */
const sendMail = (to, subject, text) => {
  const mailOptions = {
    from: '1770221228@qq.com',
    to,
    subject,
    text
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendMail;
