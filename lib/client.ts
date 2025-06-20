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
  private static client = wrapper(axios.create({ jar: this.jar, withCredentials: true }));

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
      return {
        status: result.failureType ? 'failure' : 'success',
        dsid: result.dsPersonId,
        failureType: result.failureType,
        authType: result.authType,
        message: result.failureMessage,
        requires2FA: result.failureType === 'invalidSecondFactor'
      };
    } catch (error: any) {
      console.error('Auth error:', error.response?.data || error.message);
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
      return {
        status: result.failureType ? 'failure' : 'success',
        dsid: result.dsPersonId,
        failureType: result.failureType,
        authType: result.authType,
        message: result.failureMessage,
        requires2FA: result.failureType === 'invalidSecondFactor'
      };
    } catch (error: any) {
      console.error('Auth error:', error.response?.data || error.message);
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
      'Accept': '*/*'
    };
  }
}

export default AppleClient;