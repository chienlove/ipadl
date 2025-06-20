// pages/api/auth.ts
import { NextApiRequest, NextApiResponse } from 'next'; // Thêm dòng này
import AppleClient from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    const result = await AppleClient.authenticate(email, password);

    console.log('Raw Apple API response:', result);

    if (result.requires2FA || result.authType || result.failureType === 'invalidSecondFactor') {
      return res.status(200).json({
        success: true,
        requires2FA: true,
        dsid: result.dsid,
        message: result.authType === 'trusted_device' 
          ? 'Vui lòng kiểm tra thiết bị tin cậy' 
          : 'Vui lòng nhập mã từ SMS',
        authType: result.authType || 'sms'
      });
    }

    if (result.status === 'failure') {
      return res.status(401).json({
        error: result.message || 'Authentication failed',
        requires2FA: false
      });
    }

    res.status(200).json({ 
      success: true,
      dsid: result.dsid,
      requires2FA: false
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};