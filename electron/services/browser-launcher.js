const path = require('node:path');
const fs = require('node:fs');
const { spawnDetached, webUrl } = require('./platform');
class BrowserLauncher {
  constructor(dataPath, db, logger, settings) {
    Object.assign(this, { dataPath, db, logger, settings });
    this.profilesDir = path.join(dataPath, 'browser-profiles');
    fs.mkdirSync(this.profilesDir, { recursive:true });
    this.batch = null;
    this.progress = { opened:0, total:0, failed:0, errors:[], cancelled:false, done:true };
  }
  getBrowserPath() {
    let preferred = this.settings?.get('preferredBrowser');
    if (!preferred) {
      try { preferred = JSON.parse(this.db.db.prepare("SELECT value FROM settings WHERE key='preferredBrowser'").get()?.value || '"chrome"'); } catch { preferred = 'chrome'; }
    }
    const candidates = preferred === 'edge' ? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'] : [path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'];
    const result = candidates.find(p=>fs.existsSync(p));
    if (!result) throw new Error('El navegador elegido no está instalado. Cambialo en Configuración.');
    return result;
  }
  getProfileDir(name) {
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(name)) throw new Error('Nombre de perfil inválido.');
    const dir = path.join(this.profilesDir,name);
    fs.mkdirSync(dir,{ recursive:true });
    if (fs.realpathSync(dir).toLowerCase() !== path.resolve(dir).toLowerCase()) throw new Error('El perfil de navegador no puede ser un enlace a otra carpeta.');
    return dir;
  }
  async launchBrowser(profileName, url, options = {}) {
    const target = webUrl(url);
    const args = ['--user-data-dir=' + this.getProfileDir(profileName),'--new-window','--no-first-run','--no-default-browser-check'];
    if (options.headless === true) args.push('--headless=new','--disable-gpu');
    args.push(target);
    const result = await spawnDetached(this.getBrowserPath(), args);
    this.logger.info('Navegador abierto', { profile:profileName });
    return result;
  }
  async openChatGPT(id) {
    const account = this.db.getCodexAccount(id);
    if (!account) throw new Error('Cuenta no encontrada.');
    const result = await this.launchBrowser('chatgpt-' + String(account.slot_number).padStart(2,'0'),'https://chatgpt.com/');
    this.db.logActivity('ChatGPT abierto',{ accountId:id, slot:account.slot_number });
    return result;
  }
  async openEmail(id) {
    const email = this.db.getEmail(id);
    if (!email) throw new Error('Correo no encontrado.');
    const result = await this.launchBrowser(email.browser_profile, email.url || (email.provider === 'outlook' ? 'https://outlook.live.com/' : 'https://mail.google.com/'));
    this.db.logActivity('Correo abierto',{ emailId:id });
    return result;
  }
  async openMultipleEmails(ids, intervalSeconds = this.settings?.get('batchOpenInterval') || 2, callback) {
    if (this.batch) throw new Error('Ya hay un lote de correos en curso.');
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id=>typeof id !== 'string')) throw new Error('Seleccioná hasta 100 correos.');
    if (!Number.isFinite(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 10) throw new Error('Intervalo inválido (1–10 segundos).');
    const unique = [...new Set(ids)];
    const batch = { cancelled:false, wake:null };
    this.batch = batch;
    this.progress = { opened:0, total:unique.length, failed:0, errors:[], cancelled:false, done:false };
    const publish = () => callback?.({ ...this.progress });
    try {
      publish();
      for (let i=0;i<unique.length;i++) {
        if (batch.cancelled) break;
        try { await this.openEmail(unique[i]); this.progress.opened++; }
        catch (err) { this.progress.failed++; this.progress.errors.push({ id:unique[i], error:err.message }); }
        publish();
        if (i<unique.length-1 && !batch.cancelled) await new Promise(resolve => {
          const timer = setTimeout(resolve, intervalSeconds*1000);
          batch.wake = () => { clearTimeout(timer); resolve(); };
        });
      }
      return { ...this.progress, cancelled:batch.cancelled, done:true };
    } finally {
      this.progress = { ...this.progress, cancelled:batch.cancelled, done:true };
      this.batch = null; publish();
    }
  }
  cancelBatch() { if (this.batch) { this.batch.cancelled=true; this.batch.wake?.(); } }
}
module.exports = { BrowserLauncher };
