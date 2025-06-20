import { NextApiRequest, NextApiResponse } from 'next';
import AppleStore from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, code, dsid } = req.body;
    const result = await AppleStore.authenticate(email, password, code);

    if (result.status === 'failure') {
      return res.status(401).json({
        error: result.failureType || 'Verification failed',
        requiresNew2FA: result.failureType === 'invalidSecondFactor'
      });
    }

    // Cập nhật dsid mới nếu có
    const newDsid = result.dsid || dsid;
    
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