import { useRouter } from 'next/router';

export default function HomePage() {
  const router = useRouter();

  const handleDownload = async (appId: string) => {
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.downloadUrl;
      } else {
        alert(data.error || 'Download failed');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">IPADL Pro</h1>
      <button 
        onClick={() => router.push('/auth')}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-6"
      >
        Login
      </button>
      
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Download Apps</h2>
        <div className="space-y-4">
          <button 
            onClick={() => handleDownload('123456789')} // Thay bằng App ID thực
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Download Sample App
          </button>
        </div>
      </div>
    </div>
  );
}