document.addEventListener('DOMContentLoaded', function() {
    const twoFactorForm = document.querySelector('form[action="/twoFactorVerify"]');
    const otpInput = document.getElementById('otp');

    twoFactorForm.addEventListener('submit', async function(e) {
        e.preventDefault(); // 阻止表单默认提交

        const otp = otpInput.value;
        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        try {
            const response = await fetch('/twoFactorVerify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ 
                    otp,
                    _csrf: csrfToken 
                })
            });

            const data = await response.json(); // 解析返回的 JSON 数据

            if (response.ok && data.success) {
                // 验证成功，跳转到用户主页或仪表盘
                window.location.href = '/dashboard'; // 示例跳转
            } else {
                // 弹出错误信息
                alert(data.message || '验证码错误，请重试');
            }
        } catch (error) {
            // 捕获请求中的任何错误
            console.error('请求失败:', error);
            alert('请求失败，请稍后再试');
        }
    });
});