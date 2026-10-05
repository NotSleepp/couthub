const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const runFile = promisify(execFile);

function directory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !fs.statSync(value, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('La carpeta no existe o no es una ruta absoluta.');
  }
  return fs.realpathSync(value);
}
function webUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Ingresá una URL http o https válida.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Solo se permiten enlaces http o https sin credenciales.');
  return url.href;
}
function psLiteral(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }
function encodedCommand(script) { return Buffer.from(script, 'utf16le').toString('base64'); }
function isolatedEnv(profilePath) {
  const env = { ...process.env, CODEX_HOME: profilePath };
  for (const key of Object.keys(env)) {
    if (/^(OPENAI_API_KEY|CODEX_API_KEY|OPENAI_BASE_URL|CODEX_HOME|ELECTRON_RUN_AS_NODE)$/i.test(key)) delete env[key];
  }
  env.CODEX_HOME = profilePath;
  return env;
}
function spawnDetached(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true, ...options, shell: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve({ success: true, pid: child.pid }); });
  });
}
async function launchTerminal(title, cwd, script = '', preference = 'powershell', env = process.env) {
  directory(cwd);
  const command = encodedCommand(`$Host.UI.RawUI.WindowTitle=${psLiteral(title)}; Set-Location -LiteralPath ${psLiteral(cwd)}; ${script}`);
  // Only base64 reaches the child command line; paths and labels remain PowerShell literals.
  let launch = `Start-Process -FilePath 'powershell.exe' -WorkingDirectory ${psLiteral(cwd)} -ArgumentList @('-NoLogo','-NoProfile','-NoExit','-EncodedCommand','${command}') -PassThru`;
  if (preference === 'wt') {
    launch = `Start-Process -FilePath 'wt.exe' -ArgumentList @('powershell.exe','-NoLogo','-NoProfile','-NoExit','-EncodedCommand','${command}') -PassThru`;
  } else if (preference === 'cmd') {
    launch = `Start-Process -FilePath 'cmd.exe' -WorkingDirectory ${psLiteral(cwd)} -ArgumentList @('/k','powershell.exe -NoLogo -NoProfile -EncodedCommand ${command}') -PassThru`;
  }
  const result = await runFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand(`$ErrorActionPreference='Stop'; (${launch}).Id`)], { env, windowsHide: true, timeout: 15000 });
  return { success: true, pid: Number(result.stdout.trim()) };
}
async function externalUrl(value) {
  const url = webUrl(value);
  const shell = require('electron').shell;
  if (shell) await shell.openExternal(url);
  else await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand(`$ErrorActionPreference='Stop'; Start-Process ${psLiteral(url)}`)], { windowsHide: true, timeout: 10000 });
  return { success: true, url };
}
module.exports = { directory, webUrl, psLiteral, encodedCommand, isolatedEnv, spawnDetached, launchTerminal, externalUrl, runFile };
