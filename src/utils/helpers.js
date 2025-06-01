import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createTempDir() {
  const tempDir = path.join(__dirname, '../../temp', Date.now().toString());
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

export async function cleanupTempDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

export function validateAppleId(appleId) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(appleId);
}

export function validateAppId(appId) {
  return /^\d+$/.test(appId);
}

export function generateFileName(metadata) {
  const cleanName = metadata.bundleDisplayName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanName}_v${metadata.bundleShortVersionString}_${Date.now()}.ipa`;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}