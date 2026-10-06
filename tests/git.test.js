const { describe,it,before,after }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {GitManager}=require('../electron/services/git-manager');
describe('Git worktrees on actual temporary repositories',()=>{
  let root,repo,manager,created;
  before(()=>{
    root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-git-'));repo=path.join(root,"repo's & spaces ñ");fs.mkdirSync(repo);
    execFileSync('git',['init',repo],{windowsHide:true,stdio:'ignore'});
    fs.writeFileSync(path.join(repo,'tracked.txt'),'original\n');fs.writeFileSync(path.join(repo,'.gitignore'),'ignored.txt\n');
    execFileSync('git',['add','.'],{cwd:repo,windowsHide:true});
    execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','Initial fixture'],{cwd:repo,windowsHide:true,stdio:'ignore'});
    manager=new GitManager({info(){},warn(){}},path.join(root,'worktrees'));
  });
  after(()=>fs.rmSync(root,{recursive:true,force:true}));
  it('creates real isolated branches in paths with spaces and punctuation',async()=>{
    created=await manager.createWorktrees(repo,'same project',[{slot_number:1},{slot_number:2}]);
    assert.ok(created.every(r=>r.success),JSON.stringify(created));
    assert.equal((await manager.listWorktrees(repo)).length,3);
    const replay=await manager.createWorktrees(repo,'same project',[{slot_number:1}]);
    assert.equal(replay[0].path,created[0].path);assert.equal(replay[0].reused,true);
  });
  it('rejects injected or nonnumeric slot values',async()=>{
    await assert.rejects(manager.createWorktrees(repo,'same project',[{slot_number:'1 & echo injected'}]),/válidas/);
  });
  it('reports exact filenames including leading spaces and refuses dirty removal',async()=>{
    fs.writeFileSync(path.join(created[0].path,' file with space.txt'),'untracked');
    const files=await manager.getModifiedFiles(created[0].path);assert.equal(files[0].file,' file with space.txt');
    await assert.rejects(manager.removeWorktree(created[0].path),/cambios/);
    assert.ok(fs.existsSync(created[0].path));
    fs.unlinkSync(path.join(created[0].path,' file with space.txt'));
  });
  it('protects the main checkout, ignored files and unreadable directories',async()=>{
    const listWorktrees=manager.listWorktrees.bind(manager),exec=manager.exec.bind(manager);let removeCwd;
    manager.listWorktrees=async(...args)=>(await listWorktrees(...args)).reverse();
    manager.exec=async(args,cwd)=>{if(args[0]==='worktree'&&args[1]==='remove')removeCwd=cwd;return exec(args,cwd);};
    try {
      const entries=await manager.listWorktrees(repo);
      assert.equal(entries.find(w=>w.path===repo).isMain,true);
      await assert.rejects(manager.removeWorktree(repo),/principal/);
      assert.equal(removeCwd,undefined,'the primary checkout must be rejected before running git worktree remove');
      fs.writeFileSync(path.join(created[0].path,'ignored.txt'),'do not lose');
      await assert.rejects(manager.removeWorktree(created[0].path),/ignorados/);
      fs.unlinkSync(path.join(created[0].path,'ignored.txt'));
      await assert.rejects(manager.removeWorktree(path.join(root,'missing')),/carpeta/);
    } finally {manager.listWorktrees=listWorktrees;manager.exec=exec;}
  });
  it('removes only the selected clean checkout and preserves the branch and main repo',async()=>{
    const listWorktrees=manager.listWorktrees.bind(manager),exec=manager.exec.bind(manager);let removeCwd;
    const previousGitDir=process.env.GIT_DIR,previousGitWorkTree=process.env.GIT_WORK_TREE;
    process.env.GIT_DIR=path.join(repo,'.git');process.env.GIT_WORK_TREE=repo;
    manager.listWorktrees=async(...args)=>(await listWorktrees(...args)).reverse();
    manager.exec=async(args,cwd)=>{if(args[0]==='worktree'&&args[1]==='remove')removeCwd=cwd;return exec(args,cwd);};
    try {
      const entries=await manager.listWorktrees(created[0].path);
      assert.equal(entries.find(w=>w.path===repo).isMain,true,JSON.stringify(entries));
      assert.equal(entries.find(w=>w.path===created[0].path).isMain,false,JSON.stringify(entries));
      await manager.removeWorktree(created[0].path);
    } finally {
      manager.listWorktrees=listWorktrees;manager.exec=exec;
      if(previousGitDir===undefined)delete process.env.GIT_DIR;else process.env.GIT_DIR=previousGitDir;
      if(previousGitWorkTree===undefined)delete process.env.GIT_WORK_TREE;else process.env.GIT_WORK_TREE=previousGitWorkTree;
    }
    assert.equal(path.resolve(removeCwd).toLowerCase(),path.resolve(repo).toLowerCase());
    assert.equal(fs.existsSync(created[0].path),false);
    assert.equal((await manager.listWorktrees(repo)).length,2);assert.ok(fs.existsSync(path.join(repo,'tracked.txt')));
    execFileSync('git',['show-ref','--verify','refs/heads/agent/codex-01'],{cwd:repo,windowsHide:true});
  });
});
