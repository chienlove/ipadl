import { Store } from '../lib/client';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { APPLE_ID, PASSWORD } = req.body;
    const result = await Store.authenticate(APPLE_ID, PASSWORD);

    if (result._state === 'failure') {
      return res.status(401).json({ 
        error: result.failureType || 'Authentication failed',
        require2FA: result.failureType === 'invalidSecondFactor'
      });
    }

    const cookies = Store.cookieJar.getCookiesSync('https://apple.com');
    const dsid = cookies.find(c => c.key === 'dsPersonId')?.value;

    res.status(200).json({ 
      success: true,
      dsid,
      require2FA: false
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};