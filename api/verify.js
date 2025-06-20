import { Store } from '../lib/client';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { APPLE_ID, PASSWORD, CODE, dsid } = req.body;
    const result = await Store.authenticate(APPLE_ID, PASSWORD, CODE);

    if (result._state === 'failure') {
      return res.status(401).json({ 
        error: result.failureType || 'Verification failed' 
      });
    }

    const cookies = Store.cookieJar.getCookiesSync('https://apple.com');
    const newDsid = cookies.find(c => c.key === 'dsPersonId')?.value || dsid;

    res.status(200).json({ 
      success: true,
      dsid: newDsid,
      verified2FA: true
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};