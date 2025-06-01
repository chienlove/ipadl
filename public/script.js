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
    
    const appleId = document.getElementById('appleId').value;
    const password = document.getElementById('password').value;
    
    try {
      const response = await fetch('/api/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appleId, password })
      });
      
      const data = await response.json();
      
      if (data.status === '2fa_required') {
        currentSessionId = data.sessionId;
        twoFaMessage.textContent = data.message || 'Vui lòng nhập mã xác thực';
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
    
    const code = document.getElementById('code').value;
    
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
    
    const appId = document.getElementById('appId').value;
    const appVersionId = document.getElementById('appVersionId').value;
    
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          appId, 
          appVersionId,
          dsPersonId 
        })
      });
      
      const data = await response.json();
      
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
  });

  // Hiển thị form tải ứng dụng
  function showDownloadForm() {
    document.getElementById('twoFaContainer').classList.add('hidden');
    document.getElementById('downloadContainer').classList.remove('hidden');
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
    `;
    
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = data.downloadUrl;
    downloadLink.textContent = `Tải xuống (${formatFileSize(data.metadata.fileSize)})`;
    
    resultSection.classList.remove('hidden');
  }

  // Hiển thị lỗi
  function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    errorSection.classList.remove('hidden');
  }

  // Định dạng kích thước file
  function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
  }
});