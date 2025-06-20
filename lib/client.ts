import plist from 'plist';
import nodeFetch from 'node-fetch';
import toughCookie from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

// Cấu hình cookie jar
const cookieJar = new toughCookie.CookieJar();
const fetch = fetchCookie(nodeFetch, cookieJar);

interface AppleResponse {
  status: 'success' | 'failure';
  dsid?: string;
  failureType?: string;
  downloadUrl?: string;
  authType?: string;
  message?: string;
}

class AppleClient {
  private static generateGuid(): string {
    return Array.from({ length: 12 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
  }

  /**
   * Xác thực với Apple ID
   * @param email Apple ID
   * @param password Mật khẩu
   * @param mfaCode Mã 2FA (nếu có)
   */
  static async authenticate(
    email: string,
    password: string,
    mfaCode?: string
  ): Promise<AppleResponse> {
    const guid = this.generateGuid();
    const data = {
      appleId: email,
      attempt: mfaCode ? 2 : 4, // 2 = 2FA attempt, 4 = initial attempt
      createSession: 'true',
      guid,
      password: mfaCode ? `${password}${mfaCode}` : password,
      rmp: 0,
      why: 'signIn',
    };

    const response = await fetch(
      `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${guid}`,
      {
        method: 'POST',
        body: plist.build(data),
        headers: this.getAuthHeaders(),
      }
    );

    const result = plist.parse(await response.text()) as any;
    
    return {
      status: result.failureType ? 'failure' : 'success',
      dsid: result.dsPersonId,
      failureType: result.failureType,
      authType: result.authType,
      message: result.failureMessage,
    };
  }

  /**
   * Tải ứng dụng từ App Store
   * @param appId ID ứng dụng (vd: 123456789)
   * @param dsid DSID từ session đăng nhập
   * @param versionId Phiên bản cụ thể (optional)
   */
  static async download(
    appId: string,
    dsid: string,
    versionId?: string
  ): Promise<AppleResponse> {
    const guid = this.generateGuid();
    const data = {
      creditDisplay: '',
      guid,
      salableAdamId: appId,
      ...(versionId && { externalVersionId: versionId }),
    };

    const response = await fetch(
      `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${guid}`,
      {
        method: 'POST',
        body: plist.build(data),
        headers: {
          ...this.getAuthHeaders(),
          'X-Dsid': dsid,
          'iCloud-DSID': dsid,
        },
      }
    );

    const result = plist.parse(await response.text()) as any;
    
    return {
      status: result.failureType ? 'failure' : 'success',
      downloadUrl: result.downloadUrl,
      failureType: result.failureType,
    };
  }

  private static getAuthHeaders() {
    return {
      'User-Agent': 'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8',
      'Content-Type': 'application/x-apple-plist',
      'Accept': '*/*',
    };
  }
}

export default AppleClient;