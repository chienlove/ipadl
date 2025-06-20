import { Store } from '../lib/client';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { APPID, appVerId, dsid } = req.body;
    const result = await Store.download(APPID, appVerId, { dsPersonId: dsid });

    if (result._state === 'failure') {
      return res.status(400).json({ 
        error: result.failureType || 'Download failed',
        require2FA: result.failureType === 'invalidSecondFactor'
      });
    }

    res.status(200).json({ 
      success: true,
      downloadUrl: result.downloadUrl,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};