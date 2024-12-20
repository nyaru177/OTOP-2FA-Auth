document.addEventListener('DOMContentLoaded', function() {
    const usernamePasswordLoginForm = document.getElementById('username-password-login-form');
    const emailVerificationLoginForm = document.getElementById('email-verification-login-form');
    const changeLoginMethodLink = document.getElementById('change-login-method');
    const sendVerificationCodeBtn = document.getElementById('send-verification-code');
    const emailVerificationInput = document.getElementById('email-verification');
    const verificationCodeInput = document.getElementById('verification-code');
    const emailVerificationForm = document.getElementById('email-verification-form');

    // 默认显示用户名/邮箱密码登录
    usernamePasswordLoginForm.style.display = 'block';
    emailVerificationLoginForm.style.display = 'none';

    // 切换登录方式
    changeLoginMethodLink.addEventListener('click', function(e) {
        e.preventDefault();

        if (usernamePasswordLoginForm.style.display === 'block') {
            usernamePasswordLoginForm.style.display = 'none';
            emailVerificationLoginForm.style.display = 'block';
            changeLoginMethodLink.textContent = '切换到用户名/邮箱密码登录';
        } else {
            usernamePasswordLoginForm.style.display = 'block';
            emailVerificationLoginForm.style.display = 'none';
            changeLoginMethodLink.textContent = '切换到邮箱验证码登录';
        }
    });
    document.getElementById('username-password-login-form').addEventListener('submit', async function(e) {
        e.preventDefault(); // 阻止表单默认提交
    
        const usernameOrEmail = document.getElementById('usernameOrEmail').value;
        const password = document.getElementById('password').value;
        const csrfToken = document.querySelector('input[name="_csrf"]').value; // 获取CSRF令牌
    
        try {
          const response = await fetch('/login-with-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': csrfToken  // 在请求头中添加CSRF令牌
            },
            body: JSON.stringify({ 
                usernameOrEmail, 
                password,
                _csrf: csrfToken  // 在请求体中也添加CSRF令牌
            })
          });
    
          const data = await response.json(); // 解析返回的 JSON 数据
    
          if (response.ok) {
            if (data.success) {
              // 登录成功，跳转到 2FA 页面或其他逻辑
              window.location.href = '/twoFactorVerify'; // 或者其他的逻辑处理
            } else {
              // 弹出错误信息
              alert(data.message);
            }
          } else {
            // 捕获 429 错误并显示相应的消息
            if (response.status === 429) {
              const errorMessage = data.message || '此账户登录尝试次数过多，请15分钟后后再试';
              alert(errorMessage);
            } else {
              // 其他错误
              alert(data.message);
            }
          }
        } catch (error) {
          // 捕获请求中的任何错误
          console.error(error);
          alert('请求失败，请稍后再试');
        }
    });
    
      document.getElementById('email-verification-login-form').addEventListener('submit', async function(e) {
        e.preventDefault(); // 阻止表单默认提交
        
        const email = emailVerificationInput.value;
        const verificationCode = verificationCodeInput.value;
        const csrfToken = document.querySelector('input[name="_csrf"]').value;
    
        try {
            const response = await fetch('/login-with-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ 
                    email, 
                    'verification-code': verificationCode,
                    _csrf: csrfToken
                })
            });
    
            const data = await response.json(); // 解析返回的 JSON 数据
    
            if (data.success) {
                // 登录成功，跳转到其他页面或执行其他逻辑
                window.location.href = '/'; // 示例跳转到用户主页或仪表盘
            } else {
                // 弹出错误信息
                alert(data.message);  // 弹窗错误信息，不执行跳转
            }
        } catch (error) {
            // 捕获请求中的任何错误
            console.error(error);
            alert('请求失败，请稍后再试');
        }
    });
    // 发送验证码功能
    sendVerificationCodeBtn.addEventListener('click', function() {
        const email = emailVerificationInput.value;
        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        if (!email) {
            alert('请输入有效的邮箱地址');
            return;
        }

        // 发送请求到后端生成并发送验证码
        fetch('/send-verification-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ 
                email: email,
                _csrf: csrfToken
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('验证码已发送至 ' + email);
                startCountdown();
            } else {
                alert('发送验证码失败: ' + data.message);  // 弹出错误信息
            }
        })
        .catch(error => {
            console.error('请求失败:', error);
            alert('请求失败，请稍后再试');
        });
    });

    // 邮箱验证码登录


    // 启动倒计时
    let countdownTimer;
    function startCountdown() {
        let remainingTime = 60;  // 初始倒计时60秒
        sendVerificationCodeBtn.disabled = true;  // 禁用按钮

        countdownTimer = setInterval(function() {
            sendVerificationCodeBtn.textContent = `重新发送（${remainingTime}秒)`;  // 更新按钮文字
            remainingTime--;

            if (remainingTime <= 0) {
                clearInterval(countdownTimer);
                sendVerificationCodeBtn.disabled = false;  // 启用按钮
                sendVerificationCodeBtn.textContent = '发送验证码';
            }
        }, 1000); // 每秒更新一次
    }
});
