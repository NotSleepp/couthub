const path = require('node:path');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { runFile, directory } = require('./platform');

class GitManager {
  constructor(logger, baseDir) {
    this.logger=logger || console;
    this.baseDir=baseDir || path.join(process.env.LOCALAPPDATA || require('node:os').tmpdir(),'AccountHub','worktrees');
    this.pending=new Set();
  }
  async exec(args,cwd) {
    try { return (await runFile('git',args,{ cwd,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024 })).stdout; }
    catch (err) { throw new Error('Git: '+(err.stderr?.trim() || err.message)); }
  }
  async isGitRepo(dir) { try { return (await this.exec(['rev-parse','--is-inside-work-tree'],dir)).trim()==='true'; } catch { return false; } }
  async getRemoteUrl(dir) { try { return (await this.exec(['remote','get-url','origin'],dir)).trim(); } catch { return ''; } }
  async getCurrentBranch(dir) { return (await this.exec(['branch','--show-current'],dir)).trim(); }
  async getLastCommit(dir) { try { return (await this.exec(['log','-1','--format=%h %s','--no-color'],dir)).trim(); } catch { return ''; } }
  async getModifiedFiles(dir) {
    const output=await this.exec(['status','--porcelain=v1','-z','--untracked-files=all'],dir);
    const entries=output.split('\0').filter(Boolean), files=[];
    for(let i=0;i<entries.length;i++) {
      const line=entries[i]; const status=line.slice(0,2);
      files.push({status:status.trim(),file:line.slice(3)});
      if (/[RC]/.test(status)) i++;
    }
    return files;
  }
  async isDirty(dir) { return (await this.getModifiedFiles(dir)).length>0; }
  async listWorktrees(repo) {
    directory(repo);
    const output=await this.exec(['worktree','list','--porcelain','-z'],repo);
    const items=[]; let current=null;
    for (const line of output.split('\0')) {
      if(line.startsWith('worktree ')) { if(current) items.push(current); current={path:path.resolve(line.slice(9))}; }
      else if(current && line.startsWith('HEAD ')) current.head=line.slice(5);
      else if(current && line.startsWith('branch ')) current.branch=line.slice(7).replace(/^refs\/heads\//,'');
      else if(current && line==='detached') current.detached=true;
      else if(current && line==='bare') current.bare=true;
      else if(current && line.startsWith('locked')) current.locked=true;
    }
    if(current) items.push(current);
    return Promise.all(items.map(async wt=>{
      try {
        const gitDir=path.resolve(wt.path,(await this.exec(['rev-parse','--git-dir'],wt.path)).trim());
        const commonDir=path.resolve(wt.path,(await this.exec(['rev-parse','--git-common-dir'],wt.path)).trim());
        const files=await this.getModifiedFiles(wt.path);
        return {...wt,isMain:gitDir.toLowerCase()===commonDir.toLowerCase(),dirty:files.length>0,lastCommit:await this.getLastCommit(wt.path),modifiedFiles:files.length};
      }
      catch(err) { return {...wt,isMain:false,dirty:true,lastCommit:'',modifiedFiles:0,error:err.message}; }
    }));
  }
  async createWorktrees(repoPath,projectName,accounts) {
    const repo=directory(repoPath);
    if(!Array.isArray(accounts) || accounts.length===0 || accounts.length>30 || accounts.some(a=>!Number.isInteger(a.slot_number) || a.slot_number<1 || a.slot_number>9999)) throw new Error('Seleccioná entre 1 y 30 ranuras válidas.');
    if(this.pending.has(repo)) throw new Error('Ya hay una creación de worktrees en curso.');
    this.pending.add(repo);
    try {
      await this.exec(['rev-parse','--verify','HEAD'],repo);
      const hash=createHash('sha256').update(repo.toLowerCase()).digest('hex').slice(0,12);
      const base=path.join(this.baseDir,projectName.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)+'-'+hash);
      fs.mkdirSync(base,{recursive:true});
      const results=[];
      for(const slot of [...new Set(accounts.map(a=>a.slot_number))]) {
        const suffix=String(slot).padStart(2,'0'), branch='agent/codex-'+suffix, dest=path.join(base,'worker-'+suffix);
        try {
          const existing=(await this.listWorktrees(repo)).find(w=>w.branch===branch);
          if(existing) { results.push({slot,success:true,path:existing.path,branch,reused:true}); continue; }
          if(fs.existsSync(dest)) throw new Error('La carpeta de destino ya existe: '+dest);
          let exists=false;
          try { await this.exec(['show-ref','--verify','--quiet','refs/heads/'+branch],repo); exists=true; } catch {}
          await this.exec(exists ? ['worktree','add','--',dest,branch] : ['worktree','add','-b',branch,'--',dest,'HEAD'],repo);
          results.push({slot,success:true,path:dest,branch});
          this.logger.info('Worktree creado',{slot,path:dest});
        } catch(err) { results.push({slot,success:false,error:err.message}); }
      }
      return results;
    } finally { this.pending.delete(repo); }
  }
  async removeWorktree(value) {
    const target=directory(value);
    const list=await this.listWorktrees(target);
    const main=list.find(w=>w.isMain);
    const wt=list.find(w=>path.resolve(w.path).toLowerCase()===target.toLowerCase());
    if(!main || !wt || wt.isMain || wt.bare) throw new Error('No se puede eliminar la carpeta principal del repositorio.');
    if(wt.locked) throw new Error('El worktree está bloqueado.');
    if(wt.dirty || wt.error) throw new Error('El worktree tiene cambios o no pudo comprobarse. Guardalos antes de eliminarlo.');
    if((await this.exec(['ls-files','--others','--ignored','--exclude-standard','-z'],target)).length) throw new Error('El worktree contiene archivos ignorados por Git. Respaldalos o retiralos antes de eliminarlo.');
    // Never force: Git also protects untracked/ignored files, submodules and races.
    await this.exec(['worktree','remove','--',target],main.path);
    return {success:true};
  }
  async getWorktreeStatus(value) {
    const dir=directory(value);
    const files=await this.getModifiedFiles(dir);
    return {branch:await this.getCurrentBranch(dir),lastCommit:await this.getLastCommit(dir),dirty:files.length>0,modifiedFiles:files};
  }
}
module.exports={GitManager};
