import plist from 'plist';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

interface AppleResponse {
  status: 'success' | 'failure';
  dsid?: string;
  failureType?: string;
  downloadUrl?: string;
  authType?: string;
  message?: string;
  requires2FA?: boolean;
}

class AppleClient {
  private static jar = new CookieJar();
  private static client = wrapper(axios.create({ 
    jar: this.jar,
    withCredentials: true,
    headers: this.getAuthHeaders()
  }));

  private static generateGuid(): string {
    return Array.from({ length: 12 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
  }

  static async authenticate(
    email: string,
    password: string,
    mfaCode?: string
  ): Promise<AppleResponse> {
    const guid = this.generateGuid();
    const data = {
      appleId: email,
      attempt: mfaCode ? 2 : 4,
      createSession: 'true',
      guid,
      password: mfaCode ? `${password}${mfaCode}` : password,
      rmp: 0,
      why: 'signIn',
    };

    try {
      const response = await this.client.post(
        `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${guid}`,
        plist.build(data),
        {
          headers: this.getAuthHeaders(),
          responseType: 'text',
          timeout: 10000
        }
      );

      const result = plist.parse(response.data) as any;
      console.log('Raw Apple Auth Response:', result); // Debug quan trọng

      // Cải tiến logic phát hiện 2FA
      const requires2FA = Boolean(
        result.authType ||
        result.failureType === 'invalidSecondFactor' ||
        result.failureMessage?.includes('two-factor') ||
        result.failureMessage?.includes('verification code') ||
        result.failureMessage?.includes('MZFinance.BadLogin.Configurator_message')
      );

      return {
        status: result.failureType ? 'failure' : 'success',
        dsid: result.dsPersonId,
        failureType: result.failureType,
        authType: result.authType,
        message: result.failureMessage,
        requires2FA
      };
    } catch (error: any) {
      console.error('Auth error:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      
      return {
        status: 'failure',
        failureType: 'network_error',
        message: 'Failed to connect to Apple servers'
      };
    }
  }

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

    try {
      const response = await this.client.post(
        `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${guid}`,
        plist.build(data),
        {
          headers: this.getAuthHeaders(),
          responseType: 'text',
          timeout: 10000
        }
      );

      const result = plist.parse(response.data) as any;
      
      // Kiểm tra 2FA khi download
      if (result.failureType === 'invalidSecondFactor') {
        return {
          status: 'failure',
          failureType: 'invalidSecondFactor',
          requires2FA: true,
          message: '2FA verification required for download'
        };
      }

      return {
        status: result.failureType ? 'failure' : 'success',
        dsid: result.dsPersonId,
        failureType: result.failureType,
        downloadUrl: result.downloadUrl,
        authType: result.authType,
        message: result.failureMessage
      };
    } catch (error: any) {
      console.error('Download error:', error.response?.data || error.message);
      return {
        status: 'failure',
        failureType: 'network_error',
        message: 'Failed to connect to Apple servers'
      };
    }
  }

  private static getAuthHeaders() {
    return {
      'User-Agent': 'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8',
      'Content-Type': 'application/x-apple-plist',
      'Accept': '*/*',
      'Connection': 'keep-alive'
    };
  }

  // Helper để debug cookie
  static async debugCookies() {
    const cookies = await this.jar.getCookies('https://auth.itunes.apple.com');
    console.log('Current cookies:', cookies.map(c => ({
      name: c.key,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires
    })));
  }
}

export default AppleClient;