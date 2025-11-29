// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static (UI admin)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'purchased.html'));
});

// Helper: chạy lệnh ipatool
function runIpATool(args) {
  return new Promise((resolve) => {
    const child = spawn('ipatool', args, {
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

// Helper: parse input (app id hoặc URL)
function parseInput(inputRaw) {
  const input = String(inputRaw || '').trim();
  if (!input) return { appId: null, bundleId: null };

  // Nếu là URL https://apps.apple.com/.../id1234567890
  const mUrl = input.match(/id(\d+)/);
  if (mUrl) {
    return { appId: mUrl[1], bundleId: null };
  }

  // Toàn số → coi là app-id
  if (/^\d+$/.test(input)) {
    return { appId: input, bundleId: null };
  }

  // Còn lại (có dấu chấm) → coi là bundleId
  if (input.includes('.')) {
    return { appId: null, bundleId: input };
  }

  return { appId: null, bundleId: null };
}

/**
 * POST /purchase
 * body: { APPLE_ID, PASSWORD, CODE?, input, storefront? }
 *
 * Flow:
 * 1. ipatool auth login --email --password [--auth-code] --non-interactive --format json --keychain-passphrase
 * 2. ipatool purchase -b <bundleId> --non-interactive --format json --keychain-passphrase
 */
app.post('/purchase', async (req, res) => {
  try {
    const { APPLE_ID, PASSWORD, CODE, input } = req.body || {};

    if (!APPLE_ID || !PASSWORD || !input) {
      return res.status(400).json({
        success: false,
        error: 'APPLE_ID, PASSWORD và input (App ID / bundle / URL) là bắt buộc.',
      });
    }

    const { appId, bundleId } = parseInput(input);
    // Với ipatool purchase, tốt nhất là xài bundle-identifier
    if (!bundleId) {
      return res.status(400).json({
        success: false,
        error:
          'Vui lòng nhập bundle identifier (vd: mobi.MultiCraft) hoặc URL có id..., không chỉ App ID số.',
      });
    }

    const keychainPass =
      process.env.IPATOOL_KEYCHAIN_PASS || 'change-me-keychain-pass';

    // 1. Login
    const authArgs = [
      'auth',
      'login',
      '--email',
      APPLE_ID,
      '--password',
      PASSWORD,
      '--non-interactive',
      '--format',
      'json',
      '--keychain-passphrase',
      keychainPass,
    ];
    if (CODE) {
      authArgs.push('--auth-code', CODE);
    }

    const authResult = await runIpATool(authArgs);

    if (authResult.code !== 0) {
      // Không log password ra stdout/stderr
      return res.status(400).json({
        success: false,
        error: 'Đăng nhập với ipatool thất bại. Kiểm tra email, mật khẩu, 2FA.',
        step: 'auth',
        exitCode: authResult.code,
        stdout: authResult.stdout,
        stderr: authResult.stderr,
      });
    }

    let authJson = null;
    try {
      authJson = JSON.parse(authResult.stdout || '{}');
    } catch {}

    // 2. Purchase (obtain license)
    const purchaseArgs = [
      'purchase',
      '-b',
      bundleId,
      '--non-interactive',
      '--format',
      'json',
      '--keychain-passphrase',
      keychainPass,
    ];

    const purchaseResult = await runIpATool(purchaseArgs);

    if (purchaseResult.code !== 0) {
      let pJson = null;
      try {
        pJson = JSON.parse(purchaseResult.stdout || '{}');
      } catch {}

      return res.status(400).json({
        success: false,
        error:
          pJson?.error ||
          'ipatool purchase thất bại. Xem stdout/stderr để debug chi tiết.',
        step: 'purchase',
        exitCode: purchaseResult.code,
        stdout: purchaseResult.stdout,
        stderr: purchaseResult.stderr,
      });
    }

    let purchaseJson = null;
    try {
      purchaseJson = JSON.parse(purchaseResult.stdout || '{}');
    } catch {}

    return res.json({
      success: true,
      message: 'Tải ứng dụng vào Apple ID thành công (ipatool purchase).',
      auth: authJson || undefined,
      purchase: purchaseJson || undefined,
      rawAuth: authResult.stdout,
      rawPurchase: purchaseResult.stdout,
      stderrAuth: authResult.stderr || undefined,
      stderrPurchase: purchaseResult.stderr || undefined,
    });
  } catch (err) {
    console.error('purchase error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Server error',
    });
  }
});

// Healthcheck cho Render
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
});