import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AuthPage() {
  const [step, setStep] = useState<'login' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [dsid, setDsid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authType, setAuthType] = useState<'sms' | 'trusted_device' | ''>('');
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
      console.log('Login response:', data);

      if (data.requires2FA) {
        setDsid(data.dsid);
        setAuthType(data.authType || 'sms');
        setStep('verify');
        setError(`Mã xác minh đã được gửi đến ${data.authType === 'trusted_device' ? 'thiết bị tin cậy' : 'SMS'}`);
      } else if (data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối mạng');
      console.error('Login error:', err);
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
        setError(data.error || 'Mã xác minh không đúng');
      }
    } catch (err) {
      setError('Lỗi kết nối mạng');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>IPADL Pro - Đăng nhập</title>
      </Head>
      
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-center text-gray-800">IPADL Pro</h1>
            
            {error && (
              <div className={`p-3 rounded-lg ${
                error.includes('Mã xác minh') 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {error}
              </div>
            )}

            {step === 'login' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apple ID</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    placeholder="your@appleid.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="••••••••"
                  />
                </div>
                
                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                    isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <p className="text-blue-700">
                    Nhập mã 6 số đã gửi đến {authType === 'trusted_device' ? 'thiết bị tin cậy' : 'số điện thoại'} của bạn
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="w-48 px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    disabled={isLoading}
                    placeholder="______"
                  />
                </div>
                
                <button
                  onClick={handleVerify}
                  disabled={isLoading || code.length !== 6}
                  className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                    isLoading || code.length !== 6 ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isLoading ? 'Đang xác minh...' : 'Xác thực'}
                </button>
                
                <button
                  onClick={() => {
                    setStep('login');
                    setError('');
                  }}
                  disabled={isLoading}
                  className="w-full py-2 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}