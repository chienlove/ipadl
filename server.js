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

// Config
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 5004;

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Initialize Apple Client
const appleClient = new AppleStoreClient();
const activeSessions = new Map();

// Helper function to download file
async function downloadFile(url, filePath) {
  const response = await fetch(url);
  const fileStream = fs.createWriteStream(filePath);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

// Routes
app.post('/api/authenticate', async (req, res) => {
  try {
    const { appleId, password } = req.body;
    const sessionId = uuidv4();

    const result = await appleClient.authenticate(appleId, password);
    
    if (result._state === 'failed' && result.failureType === 'MFA_REQUIRED') {
      activeSessions.set(sessionId, { appleId, password });
      return res.json({
        status: '2fa_required',
        sessionId,
        message: result.customerMessage
      });
    }

    res.json({ status: 'authenticated', dsPersonId: result.dsPersonId });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/verify-2fa', async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    const result = await appleClient.authenticate(session.appleId, session.password, code);
    activeSessions.delete(sessionId);

    if (result._state !== 'success') {
      return res.status(401).json({ error: result.customerMessage || 'Verification failed' });
    }

    res.json({ status: 'authenticated', dsPersonId: result.dsPersonId });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/download', async (req, res) => {
  try {
    const { appId, appVersionId, dsPersonId } = req.body;
    
    // Create download directory
    const downloadDir = path.join(__dirname, 'downloads', uuidv4());
    await fs.mkdir(downloadDir, { recursive: true });

    // Get download info
    const downloadInfo = await appleClient.download(appId, appVersionId);
    const downloadUrl = downloadInfo.songList[0].URL;
    const metadata = downloadInfo.songList[0].metadata;

    // Download IPA directly (without signing)
    const fileName = `${metadata.bundleDisplayName}_${metadata.bundleShortVersionString}.ipa`;
    const filePath = path.join(downloadDir, fileName);
    await downloadFile(downloadUrl, filePath);

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await fs.rm(downloadDir, { recursive: true });
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 3600000); // 1 hour

    res.json({
      downloadUrl: `/downloads/${path.basename(downloadDir)}/${fileName}`,
      metadata
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});