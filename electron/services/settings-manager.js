const path = require('node:path');
const fs = require('node:fs');
const { runFile, encodedCommand } = require('./platform');
const { object } = require('../validation');
class SettingsManager {
  constructor(dataPath, db) {
    Object.assign(this, { dataPath, db });
    this.defaults = { preferredBrowser: 'chrome', preferredTerminal: 'powershell', preferredEditor: 'vscode', profilesDir: path.join(dataPath, 'browser-profiles'), worktreesDir: path.join(dataPath, 'worktrees'), theme: 'dark', startWithWindows: false, startMinimized: false, minimizeToTray: true, batchOpenInterval: 2, globalShortcut: 'Alt+Shift+A', onboardingComplete: false };
    const insert = db.db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
    for (const [key,value] of Object.entries(this.defaults)) insert.run(key, JSON.stringify(value));
  }
  get(key) {
    const row = this.db.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    try { return row ? JSON.parse(row.value) : this.defaults[key]; } catch { return this.defaults[key]; }
  }
  getAll() { return Object.fromEntries(Object.keys(this.defaults).map(key => [key, this.get(key)])); }
  update(patch) {
    object(patch);
    const enums = { preferredBrowser: ['chrome','edge'], preferredTerminal: ['wt','powershell','cmd'], preferredEditor: ['vscode','code','cursor'], theme: ['dark'] };
    for (const [key,value] of Object.entries(patch)) {
      if (!(key in this.defaults)) throw new Error('Configuración desconocida: ' + key);
      if (enums[key] && !enums[key].includes(value)) throw new Error('Opción inválida: ' + key);
      if (typeof this.defaults[key] === 'boolean' && typeof value !== 'boolean') throw new Error('Opción inválida: ' + key);
      if (key === 'batchOpenInterval' && (!Number.isFinite(value) || value < 1 || value > 10)) throw new Error('El intervalo debe estar entre 1 y 10 segundos.');
      if (['profilesDir','worktreesDir'].includes(key) && value !== this.get(key)) throw new Error('Las carpetas de perfiles no se pueden cambiar sin migrar los datos.');
      if (key === 'globalShortcut' && (typeof value !== 'string' || value.length > 80)) throw new Error('Atajo inválido.');
    }
    this.db.db.transaction(() => {
      const upsert = this.db.db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      for (const [key,value] of Object.entries(patch)) upsert.run(key, JSON.stringify(value));
    })();
  }
  async detectTools() {
    const version = async (exe,args) => {
      try { const r = await runFile(exe,args,{ windowsHide:true, timeout:8000 }); return { found:true, path:exe, version:r.stdout.trim() }; }
      catch { return { found:false }; }
    };
    const find = candidates => { const p = candidates.find(p=>fs.existsSync(p)); return { found:!!p, ...(p ? { path:p } : {}) }; };
    const [git,codex,powershell,node] = await Promise.all([
      version('git',['--version']),
      version('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encodedCommand("$ErrorActionPreference='Stop'; codex --version; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }")]),
      version('powershell.exe',['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()']),
      version('node',['--version'])
    ]);
    if (codex.found) codex.path = 'codex (PATH)';
    return { git,codex,powershell,node,
      chrome:find([path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'), 'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']),
      edge:find(['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']),
      vscode:find([path.join(process.env.LOCALAPPDATA || '', 'Programs/Microsoft VS Code/Code.exe'),'C:/Program Files/Microsoft VS Code/Code.exe',path.join(process.env.LOCALAPPDATA || '', 'Programs/Cursor/Cursor.exe')]),
      windowsTerminal:find([path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WindowsApps/wt.exe')])
    };
  }
}
module.exports = { SettingsManager };
