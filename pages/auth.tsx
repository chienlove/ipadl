import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function AuthPage() {
  const [step, setStep] = useState<'login' | 'verify'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [dsid, setDsid] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      console.log('Login response:', data) // Debug log

      if (data.requires2FA) {
        setDsid(data.dsid)
        setStep('verify')
      } else if (data.success) {
        router.push('/')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code, dsid }),
      })

      const data = await response.json()
      if (data.success) {
        router.push('/')
      } else {
        setError(data.error || 'Verification failed')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>IPADL Pro - Login</title>
        <meta name="description" content="Apple ID Login" />
      </Head>
      
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-center text-gray-800">IPADL Pro</h1>
          
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <p>{error}</p>
            </div>
          )}

          {step === 'login' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apple ID
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-colors ${
                  isLoading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
                <p>Please enter the 6-digit verification code sent to your trusted device.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                />
              </div>
              
              <button
                onClick={handleVerify}
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-colors ${
                  isLoading
                    ? 'bg-green-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isLoading ? 'Verifying...' : 'Verify'}
              </button>
              
              <button
                onClick={() => setStep('login')}
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}