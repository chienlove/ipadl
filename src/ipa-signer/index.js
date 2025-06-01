import fs from 'fs/promises';
import path from 'path';
import plist from 'plist';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { tmpdir } from 'os';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class IPASigner {
  constructor(metadata, appleId) {
    this.metadata = metadata;
    this.appleId = appleId;
    this.tempDir = path.join(tmpdir(), `ipa_temp_${Date.now()}`);
  }

  async sign(ipaBuffer) {
    try {
      // Tạo thư mục tạm
      await fs.mkdir(this.tempDir, { recursive: true });

      // Giải nén IPA
      const extractedPath = await this._extractIPA(ipaBuffer);

      // Thêm metadata
      await this._injectMetadata(extractedPath);

      // Ký ứng dụng
      await this._codesign(extractedPath);

      // Đóng gói lại IPA
      const signedIpaPath = await this._repackIPA(extractedPath);

      return signedIpaPath;
    } finally {
      // Dọn dẹp
      await this._cleanup();
    }
  }

  async _extractIPA(ipaBuffer) {
    const ipaPath = path.join(this.tempDir, 'temp.ipa');
    await fs.writeFile(ipaPath, ipaBuffer);

    const zip = new AdmZip(ipaPath);
    const extractPath = path.join(this.tempDir, 'extracted');
    zip.extractAllTo(extractPath, true);

    return extractPath;
  }

  async _injectMetadata(extractedPath) {
    const appDir = (await fs.readdir(path.join(extractedPath, 'Payload'))).find(dir => dir.endsWith('.app'));
    if (!appDir) throw new Error('No .app directory found');

    const infoPlistPath = path.join(extractedPath, 'Payload', appDir, 'Info.plist');
    const infoPlistContent = await fs.readFile(infoPlistPath, 'utf8');
    const plistData = plist.parse(infoPlistContent);

    // Thêm metadata
    plistData['iTunesMetadata'] = {
      'appleId': this.appleId,
      'purchaseDate': new Date().toISOString(),
      ...this.metadata
    };

    await fs.writeFile(infoPlistPath, plist.build(plistData));
  }

  async _codesign(extractedPath) {
    const appDir = (await fs.readdir(path.join(extractedPath, 'Payload'))).find(dir => dir.endsWith('.app'));
    const appPath = path.join(extractedPath, 'Payload', appDir);

    // Tạo entitlements tạm
    const entitlements = {
      'application-identifier': 'YOUR_TEAM_ID.' + this.metadata['softwareVersionBundleId'],
      'get-task-allow': false,
      'keychain-access-groups': ['YOUR_TEAM_ID.' + this.metadata['softwareVersionBundleId']
    };

    const entitlementsPath = path.join(this.tempDir, 'entitlements.plist');
    await fs.writeFile(entitlementsPath, plist.build(entitlements));

    // Thực hiện codesign
    try {
      execSync(`codesign -f -s "iPhone Developer" --entitlements "${entitlementsPath}" "${appPath}"`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('Codesign failed, trying without entitlements...');
      execSync(`codesign -f -s "iPhone Developer" "${appPath}"`, {
        stdio: 'inherit'
      });
    }
  }

  async _repackIPA(extractedPath) {
    const signedIpaPath = path.join(this.tempDir, 'signed.ipa');
    const zip = new AdmZip();
    
    const payloadPath = path.join(extractedPath, 'Payload');
    zip.addLocalFolder(payloadPath, 'Payload');

    await zip.writeZip(signedIpaPath);
    return signedIpaPath;
  }

  async _cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}