document.addEventListener('DOMContentLoaded', () => {
  const step1 = document.querySelector('.step-1');
  const step2 = document.querySelector('.step-2');
  const step3 = document.querySelector('.step-3');
  const nextStep1 = document.getElementById('nextStep1');
  const sendCode = document.getElementById('sendCode');
  const nextStep2 = document.getElementById('nextStep2');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const emailCodeInput = document.getElementById('emailCode');
  const countdownSpan = document.getElementById('countdown');
  let countdown = 60;
  let countdownInterval;

  const steps = document.querySelectorAll('.step');

  function updateStepIndicator(currentStep) {
    steps.forEach((step, index) => {
      if (index < currentStep) {
        step.classList.add('completed');
      } else if (index === currentStep) {
        step.classList.add('active');
      } else {
        step.classList.remove('active', 'completed');
      }
    });
  }

  nextStep1.addEventListener('click', async () => {
    const username = usernameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    try {
      const response = await fetch('/register/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirmPassword }),
      });

      const data = await response.json();

      if (data.success) {
        alert('步骤1完成。正在前往步骤2');
        step1.style.display = 'none';
        step2.style.display = 'block';
        updateStepIndicator(1); // 更新到步骤2
      } else {
        alert(data.message || 'Error: ' + (data.errors ? data.errors.map(e => e.msg).join(', ') : '未知错误'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('发生错误。请重试');
    }
  });

  sendCode.addEventListener('click', async () => {
    const email = emailInput.value;

    if (!email) {
      return alert('请输入有效的邮箱');
    }

    try {
      const response = await fetch('/register/step2/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        alert('验证码已发送至您的邮箱');
        sendCode.disabled = true;
        countdownSpan.textContent = `Wait ${countdown}s`;

        countdownInterval = setInterval(() => {
          countdown--;
          countdownSpan.textContent = `Wait ${countdown}s`;

          if (countdown <= 0) {
            clearInterval(countdownInterval);
            sendCode.disabled = false;
            countdownSpan.textContent = '';
            countdown = 60;
          }
        }, 1000);
      } else {
        alert(data.message || '发送验证码失败');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('发送验证码失败');
    }
  });

  nextStep2.addEventListener('click', async () => {
    const email = emailInput.value;
    const code = emailCodeInput.value;

    if (!email || !code) {
      return alert('请输入邮箱和验证码');
    }

    try {
      const response = await fetch('/register/step2/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (data.success) {
        alert('验证成功。正在前往步骤3');
        step2.style.display = 'none';
        step3.style.display = 'block';
        updateStepIndicator(2); // 更新到步骤3
        generateQRCode();
      } else {
        alert(data.message || '验证码错误');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('验证时发生错误');
    }
  });
  nextStep3.addEventListener('click', () => {
    // 跳转到登录页面
    window.location.href = '/login';
  });
  function generateQRCode() {
    fetch('/register/step3/generate-qr', {
      method: 'GET',
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const qrCodeUrl = data.qrCodeUrl;

          const qrcodeContainer = document.getElementById('qrcode-container');
          qrcodeContainer.innerHTML = '';
          const img = document.createElement('img');
          img.src = qrCodeUrl;
          qrcodeContainer.appendChild(img);
        } else {
          alert('生成二维码失败');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('生成二维码时发生错误');
      });
  }
});