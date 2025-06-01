import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { AppleStoreClient } from './src/apple-api/client.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';

// Config
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 5004;

// Middleware Security
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later'
});
app.use(limiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Initialize Services
const appleClient = new AppleStoreClient();
const activeSessions = new Map();
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout

// Enhanced download function with timeout and retry
async function downloadFile(url, filePath, retries = 3) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying download (${retries} attempts left)...`);
      return downloadFile(url, filePath, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size,
    memoryUsage: process.memoryUsage()
  });
});

// Authentication Endpoint
app.post('/api/authenticate', async (req, res) => {
  try {
    const { appleId, password } = req.body;
    if (!appleId || !password) {
      return res.status(400).json({ error: 'Apple ID and password are required' });
    }

    const sessionId = uuidv4();
    const result = await appleClient.authenticate(appleId, password);
    
    if (result._state === 'failed' && result.failureType === 'MFA_REQUIRED') {
      activeSessions.set(sessionId, { appleId, password, timestamp: Date.now() });
      return res.json({
        status: '2fa_required',
        sessionId,
        message: result.customerMessage || 'Please enter your 2FA code'
      });
    }

    if (result._state !== 'success') {
      return res.status(401).json({ error: result.customerMessage || 'Authentication failed' });
    }

    res.json({ 
      status: 'authenticated', 
      dsPersonId: result.dsPersonId 
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// 2FA Verification Endpoint
app.post('/api/verify-2fa', async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    const session = activeSessions.get(sessionId);
    
    // Session validation
    if (!session) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Clean up old sessions
    if (Date.now() - session.timestamp > 5 * 60 * 1000) { // 5 minutes expiry
      activeSessions.delete(sessionId);
      return res.status(400).json({ error: 'Session expired' });
    }

    const result = await appleClient.authenticate(session.appleId, session.password, code);
    activeSessions.delete(sessionId);

    if (result._state !== 'success') {
      return res.status(401).json({ 
        error: result.customerMessage || 'Verification failed',
        requiresNewAuth: result.failureType === 'MFA_REQUIRED'
      });
    }

    res.json({ 
      status: 'authenticated', 
      dsPersonId: result.dsPersonId 
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

// Download Endpoint
app.post('/api/download', async (req, res) => {
  try {
    const { appId, appVersionId, dsPersonId } = req.body;
    
    // Input validation
    if (!appId || !dsPersonId) {
      return res.status(400).json({ error: 'App ID and authentication are required' });
    }

    // Create unique download directory
    const downloadDir = path.join(__dirname, 'downloads', uuidv4());
    await fs.mkdir(downloadDir, { recursive: true });

    // Get download info
    const downloadInfo = await appleClient.download(appId, appVersionId);
    if (!downloadInfo?.songList?.[0]?.URL) {
      throw new Error('Invalid download information received');
    }

    const { URL: downloadUrl, metadata } = downloadInfo.songList[0];
    const safeName = metadata.bundleDisplayName.replace(/[^\w]/g, '_');
    const fileName = `${safeName}_${metadata.bundleShortVersionString}.ipa`;
    const filePath = path.join(downloadDir, fileName);

    // Download file with timeout and retry
    await downloadFile(downloadUrl, filePath);

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await fs.rm(downloadDir, { recursive: true, force: true });
        console.log(`Cleaned up: ${downloadDir}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }, 3600000); // 1 hour

    res.json({
      success: true,
      downloadUrl: `/downloads/${path.basename(downloadDir)}/${fileName}`,
      metadata: {
        name: metadata.bundleDisplayName,
        version: metadata.bundleShortVersionString,
        size: (await fs.stat(filePath)).size
      }
    });
  } catch (error) {
    console.error('Download failed:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to download application',
      code: error.code
    });
  }
});

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions) {
    if (now - session.timestamp > 5 * 60 * 1000) { // 5 minutes expiry
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // 1 hour

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: req.id
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received - shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});