import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [step, setStep] = useState<'login' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [dsid, setDsid] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Thêm state loading
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
      if (data.requires2FA) {
        setDsid(data.dsid);
        setStep('verify');
      } else if (data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
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
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">IPADL Pro Login</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {step === 'login' ? (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Apple ID</label>
              <input
                type="email"
                className="w-full px-3 py-2 border rounded-md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleLogin}
              className={`w-full py-2 px-4 rounded-md text-white ${isLoading ? 'bg-blue-400' : 'bg-blue-500 hover:bg-blue-600'}`}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Sign In'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">Enter 2FA code sent to your device</p>
              <input
                type="text"
                placeholder="6-digit code"
                className="w-full px-3 py-2 border rounded-md"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleVerify}
              className={`w-full py-2 px-4 rounded-md text-white mb-2 ${isLoading ? 'bg-green-400' : 'bg-green-500 hover:bg-green-600'}`}
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => setStep('login')}
              className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              disabled={isLoading}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}