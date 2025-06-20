import { NextApiRequest, NextApiResponse } from 'next';
import AppleClient from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    const result = await AppleClient.authenticate(email, password);

    console.log('Raw Apple API response:', result);

    // Phát hiện 2FA bằng nhiều điều kiện như mã gốc
    const needs2FA = (
      result.message?.toLowerCase().includes('mã xác minh') ||
      result.message?.toLowerCase().includes('two-factor') ||
      result.message?.toLowerCase().includes('mfa') ||
      result.failureType?.toLowerCase().includes('mfa') ||
      result.authType // Thêm điều kiện authType từ Apple
    );

    if (needs2FA) {
      return res.status(200).json({
        success: true, // Vẫn trả success=true để frontend xử lý
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
        success: false,
        error: result.message || 'Authentication failed'
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