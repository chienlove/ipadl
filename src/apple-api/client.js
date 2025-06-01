import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const APPLE_AUTH_URL = process.env.APPLE_AUTH_URL || 'https://idmsa.apple.com/appleauth/auth/signin';
const APPLE_DOWNLOAD_URL = process.env.APPLE_DOWNLOAD_URL || 'https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct';

export class AppleStoreClient {
  constructor() {
    this.sessionId = uuidv4();
    this.scnt = '';
    this.authToken = '';
    this.dsPersonId = '';
  }

  async _makeRequest(url, options, isRetry = false) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 409 && !isRetry) {
        this.scnt = response.headers.get('scnt');
        this.authToken = response.headers.get('x-apple-id-session-id');
        return this._handle2FARequired();
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.customerMessage || `Apple API error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  async authenticate(appleId, password, code = '') {
    const headers = this._getAuthHeaders();
    const body = {
      accountName: appleId,
      password: password,
      rememberMe: true
    };

    if (code) {
      body.verificationCode = code;
      headers['scnt'] = this.scnt;
      headers['X-Apple-ID-Session-Id'] = this.authToken;
    }

    const response = await this._makeRequest(APPLE_AUTH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    this.dsPersonId = response.dsPersonId;
    return response;
  }

  async download(appId, appVersionId) {
    if (!this.authToken || !this.dsPersonId) {
      throw new Error('Authentication required before download');
    }

    const headers = this._getDownloadHeaders();
    const body = {
      creditDisplay: '',
      guid: uuidv4(),
      salableAdamId: appId,
      appExtVrsId: appVersionId
    };

    const response = await this._makeRequest(APPLE_DOWNLOAD_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    return response;
  }

  _getAuthHeaders() {
    return {
      'X-Apple-Id-Flag': 'true',
      'X-Apple-Widget-Key': process.env.APPLE_WIDGET_KEY || 'd39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a816d',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Apple-Api-Key': process.env.APPLE_API_KEY || 'cbf64fd6843ee630b463f358ea0b707b',
      'Accept': 'application/json',
      'User-Agent': 'com.apple.AppStore/1.0 iOS/16.0 model/iPhone14,5'
    };
  }

  _getDownloadHeaders() {
    return {
      'User-Agent': 'iOS/16.0 model/iPhone14,5',
      'X-Apple-Store-Front': process.env.STORE_FRONT || '143465-19,32',
      'X-Dsid': this.dsPersonId,
      'X-Token': this.authToken,
      'Accept': 'application/json',
      'scnt': this.scnt,
      'X-Apple-ID-Session-Id': this.authToken
    };
  }

  _handle2FARequired() {
    return {
      _state: 'failed',
      failureType: 'MFA_REQUIRED',
      customerMessage: 'Two-factor authentication required'
    };
  }
}