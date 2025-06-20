import { NextApiRequest, NextApiResponse } from 'next';
import AppleClient from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    const result = await AppleClient.authenticate(email, password);

    if (result.status === 'failure') {
      let message = 'Đăng nhập thất bại';
      if (result.failureType === 'invalidSecondFactor') {
        message = result.authType === 'trusted_device' 
          ? 'Vui lòng kiểm tra thiết bị tin cậy của bạn' 
          : 'Vui lòng nhập mã xác minh 6 chữ số được gửi đến bạn';
      }

      return res.status(401).json({
        error: message,
        requires2FA: result.failureType === 'invalidSecondFactor',
        message: message,
        authType: result.authType
      });
    }

    res.status(200).json({ success: true, dsid: result.dsid });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  }
};