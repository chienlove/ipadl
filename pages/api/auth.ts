import { NextApiRequest, NextApiResponse } from 'next';
import AppleStore from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    const result = await AppleStore.authenticate(email, password);

    if (result.status === 'failure') {
      return res.status(401).json({
        error: result.failureType || 'Authentication failed',
        requires2FA: result.failureType === 'invalidSecondFactor',
      });
    }

    res.status(200).json({ success: true, dsid: result.dsid });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};