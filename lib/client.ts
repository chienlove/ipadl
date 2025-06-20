import plist from 'plist';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

class AppleClient {
    static jar = new CookieJar();
    static client = wrapper(axios.create({ 
        jar: this.jar,
        withCredentials: true,
        timeout: 10000
    }));

    static generateGuid() {
        return Array.from({ length: 12 }, () =>
            Math.floor(Math.random() * 16).toString(16).toUpperCase()
        ).join('');
    }

    static async authenticate(email, password, mfaCode = null) {
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
                    responseType: 'text'
                }
            );

            const result = plist.parse(response.data);
            console.debug('🍎 Raw Apple Response:', JSON.stringify(result, null, 2));

            // Enhanced 2FA detection
            const requires2FA = this.detect2FARequirement(result);
            
            return {
                status: result.failureType ? 'failure' : 'success',
                dsid: result.dsPersonId,
                failureType: result.failureType,
                authType: result.authType,
                message: result.failureMessage || result.customerMessage,
                requires2FA,
                rawResponse: result // For debugging
            };

        } catch (error) {
            console.error('🔴 Auth Error:', {
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

    static detect2FARequirement(result) {
        // Check multiple 2FA indicators
        const message = (result.failureMessage || '').toLowerCase();
        const customerMessage = (result.customerMessage || '').toLowerCase();
        const failureType = (result.failureType || '').toLowerCase();

        return (
            result.authType === 'trusted_device' ||
            result.authType === 'sms' ||
            failureType.includes('mfa') ||
            failureType.includes('secondfactor') ||
            message.includes('two-factor') ||
            message.includes('verification code') ||
            customerMessage.includes('mã xác minh') ||
            customerMessage.includes('two-factor')
        );
    }

    static getAuthHeaders() {
        return {
            'User-Agent': 'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8',
            'Content-Type': 'application/x-apple-plist',
            'Accept': '*/*',
            'Connection': 'keep-alive'
        };
    }

    // Debug methods
    static async debugCookies() {
        const cookies = await this.jar.getCookies('https://auth.itunes.apple.com');
        console.log('🍪 Current Cookies:', cookies.map(c => ({
            key: c.key,
            value: c.value.substring(0, 15) + '...', // Truncate long values
            domain: c.domain,
            expires: c.expires
        })));
    }

    static async debugRequest(response) {
        console.debug('🔧 Request Debug:', {
            status: response.status,
            headers: response.headers,
            data: response.data.substring(0, 200) + '...'
        });
    }
}

module.exports = AppleClient;