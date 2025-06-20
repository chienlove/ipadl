import { NextApiRequest, NextApiResponse } from 'next';
import AppleClient from '../../lib/client';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.setHeader('Allow', ['POST']).status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const { appId, dsid, versionId } = req.body;

    // Validate input
    if (!appId || !dsid) {
      return res.status(400).json({
        error: 'Missing required parameters: appId or dsid',
      });
    }

    const result = await AppleClient.download(appId, dsid, versionId);

    if (result.status === 'failure') {
      console.error('Download failed:', result.failureType);
      
      // Xử lý các loại lỗi đặc biệt
      if (result.failureType === 'invalidSecondFactor') {
        return res.status(401).json({
          error: '2FA verification required',
          requires2FA: true,
        });
      }

      return res.status(400).json({
        error: result.failureType || 'Download failed',
      });
    }

    if (!result.downloadUrl) {
      return res.status(500).json({
        error: 'No download URL returned from Apple',
      });
    }

    // Trả về thông tin download
    res.status(200).json({
      success: true,
      downloadUrl: result.downloadUrl,
      metadata: {
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour expiry
      },
    });

  } catch (error) {
    console.error('Download API error:', error);
    
    // Phân loại lỗi
    if (error instanceof TypeError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};