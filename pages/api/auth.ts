import { NextApiRequest, NextApiResponse } from 'next';
import AppleClient from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await AppleClient.authenticate(email, password);
    console.log('Auth result:', JSON.stringify(result, null, 2));

    if (result.status === 'failure') {
      return res.status(401).json({
        error: result.message || 'Authentication failed',
        requires2FA: result.requires2FA,
        authType: result.authType
      });
    }

    return res.status(200).json({ 
      success: true,
      dsid: result.dsid
    });
  } catch (error) {
    console.error('API auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};