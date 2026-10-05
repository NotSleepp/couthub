const path = require('node:path');
const fs = require('node:fs');
const { directory, runFile, launchTerminal, spawnDetached, externalUrl } = require('./platform');
class ProjectManager {
  constructor(logger, settings) { Object.assign(this,{ logger:logger || console, settings }); }
  async detectProject(value) {
    const dirPath = directory(value);
    const result = { name:path.basename(dirPath), path:dirPath, has_git:false, project_type:'', remote_url:'' };
    try {
      await runFile('git',['rev-parse','--is-inside-work-tree'],{ cwd:dirPath, windowsHide:true, timeout:10000 });
      result.has_git=true;
      try { result.remote_url=(await runFile('git',['remote','get-url','origin'],{ cwd:dirPath, windowsHide:true, timeout:10000 })).stdout.trim(); } catch {}
    } catch {}
    const files = fs.readdirSync(dirPath);
    const types = [];
    for (const [type,names] of Object.entries({ node:['package.json'],rust:['Cargo.toml'],python:['requirements.txt','pyproject.toml'],go:['go.mod'],godot:['project.godot'],java:['pom.xml','build.gradle'] })) if (names.some(n=>files.includes(n))) types.push(type);
    if (files.some(n=>/\.(sln|slnx|csproj|fsproj)$/.test(n))) types.push('dotnet');
    result.project_type=types.join(',');
    return result;
  }
  async openFolder(value) {
    const dir = directory(value);
    const shell = require('electron').shell;
    if (shell) { const error = await shell.openPath(dir); if (error) throw new Error(error); return { success:true }; }
    return spawnDetached('explorer.exe',[dir]);
  }
  openTerminal(value) {
    const dir = directory(value);
    return launchTerminal('Terminal — '+path.basename(dir),dir,'',this.settings?.get('preferredTerminal'));
  }
  async openVSCode(value) {
    const dir=directory(value);
    const cursor=this.settings?.get('preferredEditor') === 'cursor';
    const candidates=cursor ? [path.join(process.env.LOCALAPPDATA || '', 'Programs/Cursor/Cursor.exe'),'C:/Program Files/Cursor/Cursor.exe'] : [path.join(process.env.LOCALAPPDATA || '', 'Programs/Microsoft VS Code/Code.exe'),'C:/Program Files/Microsoft VS Code/Code.exe','C:/Program Files (x86)/Microsoft VS Code/Code.exe'];
    const editor=candidates.find(p=>fs.existsSync(p));
    if (!editor) throw new Error('El editor seleccionado no está instalado. Instalalo o elegí otro en Configuración.');
    return spawnDetached(editor,[dir]);
  }
  async openGitHub(value) {
    const dir=directory(value);
    const { stdout }=await runFile('git',['remote','get-url','origin'],{ cwd:dir, windowsHide:true, timeout:10000 });
    let url=stdout.trim();
    if (/^git@[^:]+:/.test(url)) url=url.replace(/^git@([^:]+):/,'https://$1/');
    else if (url.startsWith('ssh://')) { const u=new URL(url); url='https://'+u.hostname+u.pathname; }
    return externalUrl(url.replace(/\.git$/,''));
  }
}
module.exports={ ProjectManager };
