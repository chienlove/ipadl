document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('authForm');
  const twoFaForm = document.getElementById('twoFaForm');
  const downloadForm = document.getElementById('downloadForm');
  const resultSection = document.getElementById('resultSection');
  const errorSection = document.getElementById('errorSection');
  
  const loginForm = document.getElementById('loginForm');
  const twoFaMessage = document.getElementById('twoFaMessage');
  const retryButton = document.getElementById('retryButton');
  
  let currentSessionId = null;
  let dsPersonId = null;

  // Xử lý đăng nhập
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appleId = document.getElementById('appleId').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate client-side
    if (!appleId || !password) {
      showError('Vui lòng nhập Apple ID và mật khẩu');
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(appleId)) {
      showError('Apple ID không hợp lệ. Vui lòng nhập email đúng định dạng');
      return;
    }
    
    try {
      const response = await fetch('/api/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appleId, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại');
      }
      
      if (data.status === '2fa_required') {
        currentSessionId = data.sessionId;
        twoFaMessage.textContent = data.message || 'Vui lòng nhập mã xác thực 6 số từ thiết bị của bạn';
        loginForm.classList.add('hidden');
        document.getElementById('twoFaContainer').classList.remove('hidden');
      } else if (data.status === 'authenticated') {
        dsPersonId = data.dsPersonId;
        showDownloadForm();
      } else {
        throw new Error(data.error || 'Đăng nhập thất bại');
      }
    } catch (error) {
      showError(error.message);
    }
  });

  // Xử lý 2FA
  twoFaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('code').value.trim();
    
    if (!code || !/^\d{6}$/.test(code)) {
      showError('Vui lòng nhập mã xác thực 6 số');
      return;
    }
    
    try {
      const response = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sessionId: currentSessionId, 
          code 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Xác thực 2FA thất bại');
      }
      
      if (data.status === 'authenticated') {
        dsPersonId = data.dsPersonId;
        document.getElementById('twoFaContainer').classList.add('hidden');
        showDownloadForm();
      } else {
        throw new Error(data.error || 'Xác thực thất bại');
      }
    } catch (error) {
      showError(error.message);
    }
  });

  // Xử lý tải ứng dụng
  downloadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appId = document.getElementById('appId').value.trim();
    const appVersionId = document.getElementById('appVersionId').value.trim();
    
    if (!appId || !/^\d+$/.test(appId)) {
      showError('Vui lòng nhập App ID hợp lệ (chỉ chứa số)');
      return;
    }
    
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          appId, 
          appVersionId: appVersionId || '0',
          dsPersonId 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Tải ứng dụng thất bại');
      }
      
      if (data.downloadUrl) {
        showResult(data);
      } else {
        throw new Error(data.error || 'Tải ứng dụng thất bại');
      }
    } catch (error) {
      showError(error.message);
    }
  });

  // Nút thử lại
  retryButton.addEventListener('click', () => {
    errorSection.classList.add('hidden');
    loginForm.classList.remove('hidden');
    document.getElementById('twoFaContainer').classList.add('hidden');
    document.getElementById('downloadContainer').classList.add('hidden');
    resultSection.classList.add('hidden');
    
    // Reset form
    document.getElementById('appleId').value = '';
    document.getElementById('password').value = '';
    document.getElementById('code').value = '';
    document.getElementById('appId').value = '';
    document.getElementById('appVersionId').value = '';
  });

  // Hiển thị form tải ứng dụng
  function showDownloadForm() {
    document.getElementById('twoFaContainer').classList.add('hidden');
    document.getElementById('downloadContainer').classList.remove('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
  }

  // Hiển thị kết quả
  function showResult(data) {
    downloadForm.classList.add('hidden');
    
    const appInfo = document.getElementById('appInfo');
    appInfo.innerHTML = `
      <p><strong>Tên ứng dụng:</strong> ${data.metadata.bundleDisplayName}</p>
      <p><strong>Phiên bản:</strong> ${data.metadata.bundleShortVersionString}</p>
      <p><strong>Nhà phát triển:</strong> ${data.metadata.artistName}</p>
      <p><strong>ID gói:</strong> ${data.metadata.softwareVersionBundleId}</p>
      <p><strong>Kích thước:</strong> ${formatFileSize(data.metadata.fileSize)}</p>
    `;
    
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = data.downloadUrl;
    downloadLink.textContent = `Tải xuống (${formatFileSize(data.metadata.fileSize)})`;
    
    resultSection.classList.remove('hidden');
  }

  // Hiển thị lỗi
  function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.innerHTML = message;
    
    if (message.includes('Account locked')) {
      errorEl.innerHTML += '<br><a href="https://iforgot.apple.com" target="_blank">Mở khóa tài khoản</a>';
    } else if (message.includes('Invalid Apple ID')) {
      errorEl.innerHTML += '<br>Vui lòng kiểm tra lại email của bạn';
    }
    
    errorSection.classList.remove('hidden');
  }

  // Định dạng kích thước file
  function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
});