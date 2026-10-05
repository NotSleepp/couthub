const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { psLiteral, encodedCommand, isolatedEnv, launchTerminal, directory } = require('./platform');

class CodexManager {
  constructor(dataPath, db, logger, settings) {
    Object.assign(this, { dataPath, db, logger, settings });
    this.profilesDir = path.join(dataPath, 'codex-profiles');
    fs.mkdirSync(this.profilesDir, { recursive: true });
  }
  getProfilePath(accountId) {
    const account = this.db.getCodexAccount(accountId);
    if (!account) throw new Error('Cuenta no encontrada.');
    const expected = path.join(this.profilesDir, 'codex-' + String(account.slot_number).padStart(2, '0'));
    if (account.profile_path && path.resolve(account.profile_path).toLowerCase() !== path.resolve(expected).toLowerCase()) throw new Error('El perfil de esta cuenta está fuera de su carpeta aislada.');
    fs.mkdirSync(expected, { recursive: true });
    if (fs.realpathSync(expected).toLowerCase() !== path.resolve(expected).toLowerCase()) throw new Error('El perfil no puede ser un enlace a otra carpeta.');
    return expected;
  }
  isAccountAuthenticated(accountId) {
    const profile = this.getProfilePath(accountId);
    let authenticated = false;
    try {
      const auth = JSON.parse(fs.readFileSync(path.join(profile, 'auth.json'), 'utf8'));
      authenticated = !!((typeof auth.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.trim()) || (typeof auth.tokens?.access_token === 'string' && auth.tokens.access_token.trim() && typeof auth.tokens?.refresh_token === 'string' && auth.tokens.refresh_token.trim()));
    } catch { /* Missing or incomplete credentials are not a completed login. */ }
    const account = this.db.getCodexAccount(accountId);
    if (!!account.configured !== authenticated) this.db.updateCodexAccount(accountId, { configured: authenticated ? 1 : 0 });
    return authenticated;
  }
  isAuthenticated(id) { return this.isAccountAuthenticated(id); }
  async logoutCodex(accountId) {
    fs.rmSync(path.join(this.getProfilePath(accountId), 'auth.json'), { force: true });
    this.db.updateCodexAccount(accountId, { configured: 0, status: 'unknown' });
    return { success: true };
  }
  resolveContext(accountId, projectId) {
    const account = this.db.getCodexAccount(accountId);
    const profilePath = this.getProfilePath(accountId);
    const project = projectId ? this.db.getProject(projectId) : null;
    if (projectId && !project) throw new Error('Proyecto no encontrado.');
    const cwd = directory(project?.path || os.homedir());
    return { account, profilePath, cwd, project };
  }
  command(mode = 'codex') {
    if (!['codex', 'login', 'browser-login', 'shell'].includes(mode)) throw new Error('Modo de terminal inválido.');
    if (mode === 'shell') return '';
    const args = mode === 'login' ? 'login --device-auth' : mode === 'browser-login' ? 'login' : '';
    return "if (Get-Command codex -ErrorAction SilentlyContinue) { codex -c 'cli_auth_credentials_store=\"file\"' " + args + " } else { Write-Error 'Codex CLI no está instalado. Instalalo y volvé a intentar.' }";
  }
  script(context, mode) {
    return '$env:CODEX_HOME=' + psLiteral(context.profilePath) + '; Remove-Item Env:OPENAI_API_KEY,Env:CODEX_API_KEY,Env:OPENAI_BASE_URL,Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; ' + this.command(mode);
  }
  recordLaunch(accountId, projectId) {
    this.db.updateCodexAccount(accountId, { last_used: new Date().toISOString(), current_project_id: projectId || null });
    this.db.logActivity('Codex iniciado', { accountId, projectId: projectId || null });
  }
  async launchCodex(accountId, projectId) {
    const ctx = this.resolveContext(accountId, projectId);
    return this.launchContext(ctx, accountId, projectId);
  }
  async launchContext(ctx, accountId, projectId) {
    const result = await launchTerminal('Codex #' + ctx.account.slot_number + ' — ' + ctx.account.label, ctx.cwd, this.script(ctx, 'codex'), this.settings?.get('preferredTerminal'), isolatedEnv(ctx.profilePath));
    this.recordLaunch(accountId, projectId);
    return result;
  }
  async configureCodex(accountId) {
    const ctx = this.resolveContext(accountId);
    return launchTerminal('Login Codex #' + ctx.account.slot_number, ctx.cwd, this.script(ctx, 'login'), this.settings?.get('preferredTerminal'), isolatedEnv(ctx.profilePath));
  }
  async importDefaultCredentials(accountId) {
    const source = path.join(os.homedir(), '.codex', 'auth.json');
    const target = path.join(this.getProfilePath(accountId), 'auth.json');
    if (fs.existsSync(target)) throw new Error('Esta ranura ya tiene credenciales. Cerrá su sesión antes de importar otra cuenta.');
    if (!fs.existsSync(source)) throw new Error('No se encontró auth.json en la cuenta predeterminada. Usá Login CLI.');
    const auth = JSON.parse(fs.readFileSync(source, 'utf8'));
    if (!auth.tokens?.access_token && !auth.OPENAI_API_KEY) throw new Error('El archivo de credenciales está incompleto.');
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    this.isAccountAuthenticated(accountId);
    return { success: true };
  }
  generateBatLauncher(accountId, projectId) {
    const ctx = this.resolveContext(accountId, projectId);
    const command = encodedCommand('Set-Location -LiteralPath ' + psLiteral(ctx.cwd) + '; ' + this.script(ctx, 'codex'));
    const dir = path.join(this.dataPath, 'launchers');
    fs.mkdirSync(dir, { recursive: true });
    const filename = 'Slot-' + String(ctx.account.slot_number).padStart(2, '0') + '.bat';
    const content = '@echo off\r\npowershell.exe -NoLogo -NoProfile -NoExit -EncodedCommand ' + command + '\r\n';
    const batPath = path.join(dir, filename);
    fs.writeFileSync(batPath, content);
    return { filename, content, batPath };
  }
}
module.exports = { CodexManager };
