import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [step, setStep] = useState<'login' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [dsid, setDsid] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
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
    }
  };

  const handleVerify = async () => {
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
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">IPADL Pro Login</h1>
        
        {error && <div className="text-red-500 mb-4">{error}</div>}

        {step === 'login' ? (
          <>
            <input
              type="email"
              placeholder="Apple ID"
              className="w-full p-2 border mb-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-2 border mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-500 text-white p-2 rounded"
            >
              Sign In
            </button>
          </>
        ) : (
          <>
            <p className="mb-4">Enter 2FA code sent to your device</p>
            <input
              type="text"
              placeholder="6-digit code"
              className="w-full p-2 border mb-4"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
            />
            <button
              onClick={handleVerify}
              className="w-full bg-green-500 text-white p-2 rounded mb-2"
            >
              Verify
            </button>
            <button
              onClick={() => setStep('login')}
              className="w-full bg-gray-200 text-gray-800 p-2 rounded"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}