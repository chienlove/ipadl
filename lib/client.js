import plist from 'plist';
import getMAC from 'getmac';
import nodeFetch from 'node-fetch';
import toughCookie from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

// Polyfill cho môi trường serverless (Vercel)
const createCookieJar = () => {
  try {
    return new toughCookie.CookieJar();
  } catch (error) {
    console.warn('CookieJar fallback to memory storage');
    return new toughCookie.MemoryCookieStore();
  }
};

class Store {
  static get guid() {
    try {
      // Sử dụng MAC address nếu có (hoạt động trên server)
      const mac = getMAC();
      return mac ? mac.replace(/:/g, '').toUpperCase() : this.generateFallbackGuid();
    } catch (error) {
      // Fallback cho môi trường serverless (Vercel)
      return this.generateFallbackGuid();
    }
  }

  static generateFallbackGuid() {
    return Array.from({ length: 12 }, () => 
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
  }

  static async authenticate(email, password, mfaCode = null) {
    const data = {
      appleId: email,
      attempt: mfaCode ? 2 : 4, // 2 = 2FA attempt, 4 = initial attempt
      createSession: 'true',
      guid: this.guid,
      password: mfaCode ? `${password}${mfaCode}` : password,
      rmp: 0,
      why: 'signIn'
    };

    try {
      const response = await this.fetch(
        `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${this.guid}`,
        {
          method: 'POST',
          body: plist.build(data),
          headers: this.headers
        }
      );

      const result = plist.parse(await response.text());
      
      return {
        status: result.failureType ? 'failure' : 'success',
        dsid: result.dsPersonId,
        ...result
      };
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error('Failed to connect to Apple servers');
    }
  }

  static async download(appId, versionId = null, cookies = {}) {
    const data = {
      creditDisplay: '',
      guid: this.guid,
      salableAdamId: appId,
      ...(versionId && { externalVersionId: versionId })
    };

    try {
      const response = await this.fetch(
        `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`,
        {
          method: 'POST',
          body: plist.build(data),
          headers: {
            ...this.headers,
            'X-Dsid': cookies.dsid || '',
            'iCloud-DSID': cookies.dsid || ''
          }
        }
      );

      const result = plist.parse(await response.text());
      
      return {
        status: result.failureType ? 'failure' : 'success',
        ...result
      };
    } catch (error) {
      console.error('Download error:', error);
      throw new Error('Failed to process download request');
    }
  }

  static async purchase(appId, cookies = {}) {
    const data = {
      guid: this.guid,
      salableAdamId: appId
    };

    try {
      const response = await this.fetch(
        `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct?guid=${this.guid}`,
        {
          method: 'POST',
          body: plist.build(data),
          headers: {
            ...this.headers,
            'X-Dsid': cookies.dsid || '',
            'iCloud-DSID': cookies.dsid || ''
          }
        }
      );

      const result = plist.parse(await response.text());
      return result;
    } catch (error) {
      console.error('Purchase error:', error);
      throw new Error('Failed to process purchase');
    }
  }
}

// Khởi tạo phiên bản fetch với cookie support
Store.cookieJar = createCookieJar();
Store.fetch = fetchCookie(nodeFetch, Store.cookieJar);

// Headers tiêu chuẩn cho Apple API
Store.headers = {
  'User-Agent': 'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8',
  'Content-Type': 'application/x-apple-plist',
  'Accept': '*/*',
  'Connection': 'keep-alive'
};

export default Store;