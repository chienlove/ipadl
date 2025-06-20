import { NextApiRequest, NextApiResponse } from 'next';
import AppleClient from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, code, dsid } = req.body;
    
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Mã xác minh phải có 6 chữ số' });
    }

    const result = await AppleClient.authenticate(email, password, code);

    if (result.status === 'failure') {
      return res.status(401).json({
        error: result.message || 'Mã xác minh không đúng',
        requiresNew2FA: result.failureType === 'invalidSecondFactor'
      });
    }

    res.status(200).json({ 
      success: true,
      dsid: result.dsid || dsid,
      verified2FA: true
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  }
};