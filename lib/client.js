import plist from 'plist';
import getMAC from 'getmac';
import fetchCookie from 'fetch-cookie';
import nodeFetch from 'node-fetch';

/**
 * Store client
 * - authenticate(email, password, mfa?)
 * - download(appIdentifier, appVerId?, Cookie, opts?)
 * - purchase(adamId, Cookie, opts?)
 * - purchaseHistory(Cookie)
 */
class Store {
  static get guid() {
    return getMAC().replace(/:/g, '').toUpperCase();
  }

  // ===== Headers động mỗi request =====
  static dynHeaders(extra = {}) {
    let tz = 'Asia/Bangkok';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch {}
    return {
      'User-Agent': 'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8',
      'Accept': '*/*',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'X-Apple-I-Client-Time': new Date().toISOString(),
      'X-Apple-I-TimeZone': tz,
      ...extra
    };
  }

  // wrapper fetch
  static async fetch(url, opts) {
    return Store._fetch(url, opts);
  }

  // ====== detect storefront ======
  static async detectStorefront() {
    if (this._storefront && Date.now() - (this._sfAt || 0) < 15 * 60 * 1000)
      return this._storefront;

    const url = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/storeFront';
    const resp = await this.fetch(url, { method: 'GET', headers: this.dynHeaders() });
    const sf = resp.headers?.get?.('x-apple-store-front');

    if (sf) {
      this._storefront = sf.split(';')[0].trim();
      this._sfAt = Date.now();
      return this._storefront;
    }
    return null;
  }
  static get lastStorefront() {
    return this._storefront || null;
  }

  /* ===================== AUTH ===================== */
  static async authenticate(email, password, mfa) {
    const payload = plist.build({
      appleId: email,
      attempt: mfa ? 2 : 4,
      createSession: 'true',
      guid: this.guid,
      password: `${password}${mfa ?? ''}`,
      rmp: 0,
      why: 'signIn'
    });

    const url = `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${this.guid}`;
    const resp = await this.fetch(url, {
      method: 'POST',
      body: payload,
      headers: this.dynHeaders({ 'Content-Type': 'application/x-apple-plist' })
    });

    const parsed = plist.parse(await resp.text());
    return { ...parsed, _state: parsed.failureType ? 'failure' : 'success' };
  }

  /* ===================== DOWNLOAD ===================== */
  static async download(appIdentifier, appVerId, Cookie, opts = {}) {
    const dataJson = {
      creditDisplay: '',
      guid: this.guid,
      salableAdamId: appIdentifier,
      ...(appVerId ? { externalVersionId: appVerId } : {})
    };

    const storefront = opts.storefront || await this.detectStorefront();
    const url =
      `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`;

    const resp = await this.fetch(url, {
      method: 'POST',
      body: plist.build(dataJson),
      headers: this.dynHeaders({
        'Content-Type': 'application/x-apple-plist',
        'X-Dsid': Cookie.dsPersonId,
        'iCloud-DSID': Cookie.dsPersonId,
        ...(storefront ? { 'X-Apple-Store-Front': storefront } : {})
      })
    });

    const parsed = plist.parse(await resp.text());
    return { ...parsed, _state: parsed.failureType ? 'failure' : 'success' };
  }

  /* ===================== PURCHASE ===================== */
  static async purchase(adamId, Cookie, opts = {}) {
    const base = 'https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa';
    const entryUrl = `${base}/buyProduct?guid=${this.guid}`;
    const MAX_FOLLOWS = 8;

    const storefront = opts.storefront || await this.detectStorefront();

    const commonAuth = {
      'X-Dsid': Cookie.dsPersonId,
      'iCloud-DSID': Cookie.dsPersonId,
      ...(storefront ? { 'X-Apple-Store-Front': storefront } : {})
    };

    const resolveUrl = (url) => {
      if (!url) return `${base}/buyProduct`;
      if (!url.startsWith('http')) return `https://${url}`;
      return url;
    };

    const postForm = async (url, formData) => {
      return this.fetch(resolveUrl(url), {
        method: 'POST',
        headers: this.dynHeaders({
          ...commonAuth,
          'Content-Type': 'application/x-www-form-urlencoded'
        }),
        body: formData
      });
    };

    // ===== B1: request đầu =====
    const body1 = plist.build({
      guid: this.guid,
      salableAdamId: adamId,
      ageCheck: true,
      hasBeenAuthedForBuy: true,
      isInApp: false
    });

    let resp = await this.fetch(entryUrl, {
      method: 'POST',
      headers: this.dynHeaders({
        ...commonAuth,
        'Content-Type': 'application/x-apple-plist'
      }),
      body: body1
    });

    let data = plist.parse(await resp.text());
    if (!data.failureType && !data.dialog)
      return { ...data, _state: 'success', storefrontUsed: storefront };

    // ===== B2: follow dialog =====
    for (let i = 0; i < MAX_FOLLOWS; i++) {
      const dialog = data.dialog || null;
      const metrics = data.metrics || {};
      let done = false;

      // ButtonParams (AskToBuy / Age Check)
      if (dialog?.okButtonAction?.buttonParams) {
        resp = await postForm(metrics?.actionUrl, dialog.okButtonAction.buttonParams);
        data = plist.parse(await resp.text());
        done = true;
      }

      // BuyParams
      else if (dialog?.okButtonAction?.kind === 'Buy' &&
        dialog?.okButtonAction?.buyParams) {
        resp = await postForm(metrics?.actionUrl, dialog.okButtonAction.buyParams);
        data = plist.parse(await resp.text());
        done = true;
      }

      // fallback tiếp theo
      else if (metrics?.actionUrl) {
        const bp = new URLSearchParams();
        bp.append('salableAdamId', adamId);
        bp.append('guid', this.guid);
        bp.append('ageCheck', 'true');
        bp.append('isInApp', 'false');
        bp.append('hasBeenAuthedForBuy', 'true');

        resp = await postForm(metrics.actionUrl, bp.toString());
        data = plist.parse(await resp.text());
        done = true;
      }

      // fallback 2060
      else if (data.failureType === '2060') {
        const bp = new URLSearchParams();
        bp.append('salableAdamId', adamId);
        bp.append('guid', this.guid);
        bp.append('ageCheck', 'true');
        bp.append('isInApp', 'false');
        bp.append('hasBeenAuthedForBuy', 'true');

        resp = await postForm(
          'p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct',
          bp.toString()
        );
        data = plist.parse(await resp.text());
        done = true;
      }

      if (done) {
        if (!data.failureType && !data.dialog)
          return { ...data, _state: 'success', storefrontUsed: storefront };
        continue;
      }

      break;
    }

    // ===== B3: failure result =====
    if (data.failureType) {
      const did = data.metrics?.dialogId || '';
      const isFamilyAge = did === 'MZCommerce.FamilyAgeCheck';
      const isATB = /AskToBuy/i.test(did);

      return {
        ...data,
        _state: 'failure',
        storefrontUsed: storefront,
        failureCode: isFamilyAge
          ? 'ACCOUNT_FAMILY_AGE_CHECK'
          : isATB
            ? 'ACCOUNT_ASK_TO_BUY'
            : data.failureType,
        customerMessage:
          isFamilyAge || isATB
            ? 'Apple yêu cầu xác minh Family/Age hoặc khởi tạo mua hàng trong App Store (tải 1 app miễn phí, đúng quốc gia).'
            : (data.customerMessage || 'Purchase failed')
      };
    }

    return { ...data, _state: 'success', storefrontUsed: storefront };
  }

  /* ===================== PURCHASE HISTORY ===================== */
  static async purchaseHistory(Cookie, opts = {}) {
    const storefront = opts.storefront || await this.detectStorefront();

    const url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/purchaseHistory`;
    const resp = await this.fetch(url, {
      method: 'POST',
      headers: this.dynHeaders({
        'X-Dsid': Cookie.dsPersonId,
        'iCloud-DSID': Cookie.dsPersonId,
        ...(storefront ? { 'X-Apple-Store-Front': storefront } : {})
      })
    });

    return plist.parse(await resp.text());
  }
}

// Cookie jar
Store.cookieJar = new fetchCookie.toughCookie.CookieJar();
Store._fetch = fetchCookie(nodeFetch, Store.cookieJar);

// Compatibility
Store.Headers = Store.dynHeaders();

// ===================== EXPORTS =====================
export { Store };
export default Store;  // <── BẮT BUỘC CHO NEXT.JS + RENDER