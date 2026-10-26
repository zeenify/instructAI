/**
 * Role-choice modal screenshots at phone size — Google OAuth + the login
 * endpoint are stubbed before any page script runs, so the real modal
 * component renders with real styling.
 *
 * Usage: node role-modal-shots.mjs [baseURL]   (default http://localhost:5173)
 * Screenshots → tools/browser/shots-mobile-student/role-*.png
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots-mobile-student';
const VW = parseInt(process.env.VW || '390', 10);
const VH = parseInt(process.env.VH || '844', 10);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Keep our google.accounts stub alive: the real GIS script would overwrite it.
await ctx.route(/accounts\.google\.com\/gsi\//, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' }));
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'fake-token' }), 150) }),
      },
    },
  };
  const XO = XMLHttpRequest.prototype.open, XSH = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...a) { this.__u = String(u); return XO.call(this, m, u, ...a); };
  XMLHttpRequest.prototype.send = function (b) {
    if (this.__u && String(this.__u).includes('/login/google')) {
      const body = JSON.stringify({ requires_role: true, email: 'new.person@example.com' });
      Object.defineProperty(this, 'readyState', { get: () => 4 });
      Object.defineProperty(this, 'status', { get: () => 200 });
      Object.defineProperty(this, 'statusText', { get: () => 'OK' });
      Object.defineProperty(this, 'responseText', { get: () => body });
      Object.defineProperty(this, 'response', { get: () => body });
      this.getAllResponseHeaders = () => '';
      this.getResponseHeader = () => null;
      setTimeout(() => { try { if (this.onreadystatechange) this.onreadystatechange(); if (this.onload) this.onload(); if (this.onloadend) this.onloadend(); } catch (e) {} }, 30);
      return;
    }
    return XSH.call(this, b);
  };
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.getByRole('button', { name: /continue with google/i }).first().click({ timeout: 20000 });
await page.locator('.auth-modal').waitFor({ timeout: 10000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/role-modal.png` });

// open the student LRN sub-flow
const studentCard = page.locator('.auth-role-card').nth(1);
await studentCard.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/role-modal-lrn.png` });
console.log('saved role-modal.png + role-modal-lrn.png');
await browser.close();
