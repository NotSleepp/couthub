const { describe,it,before,after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { createApplication } = require('../electron/application');
const { createApiBridge } = require('../electron/api-server');
const { TerminalManager } = require('../electron/services/terminal-manager');
const { psLiteral, encodedCommand, isolatedEnv, spawnDetached } = require('../electron/services/platform');

describe('Real application contracts, persistence and input validation',()=>{
  let root,application;
  before(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-integration-'));application=createApplication({dataPath:root});});
  after(()=>{application.close();fs.rmSync(root,{recursive:true,force:true});});
  it('seeds once and persists account changes through reopening',async()=>{
    const a=(await application.invoke('codex:getAccounts'))[0];
    const changed=await application.invoke('codex:updateAccount',[a.id,{label:"Daniel's & equipo",status:'resting'}]);
    assert.equal(changed.label,"Daniel's & equipo");
    const other=createApplication({dataPath:root});
    assert.equal(other.db.getCodexAccounts().length,6);assert.equal(other.db.getCodexAccount(a.id).label,changed.label);other.close();
  });
  it('adds slots beyond the initial six with unique isolated profiles',async()=>{
    const first=await application.invoke('codex:addAccount');
    const second=await application.invoke('codex:addAccount');
    const a=application.db.getCodexAccount(first),b=application.db.getCodexAccount(second);
    assert.equal(a.slot_number,7);assert.equal(b.slot_number,8);
    assert.notEqual(application.codex.getProfilePath(first),application.codex.getProfilePath(second));
    assert.equal(application.db.getDashboardStats().codex.total,8);
  });
  it('provides six PowerShell launchers with isolated CODEX_HOME and no credential copying',()=>{
    const dir=path.join(__dirname,'..','launchers');
    const source=fs.readFileSync(path.join(dir,'AccountHub-Codex.ps1'),'utf8');
    for(let slot=1;slot<=6;slot++){
      const name=['Principal','Desarrollo','Desarrollo_2','Frontend','Extra','Extra_2'][slot-1];
      const bat=fs.readFileSync(path.join(dir,`Slot-${String(slot).padStart(2,'0')}-${name}.bat`),'utf8');
      assert.match(bat,new RegExp(`-Slot ${slot}\\b`));
      assert.match(bat,/-ProjectPath "%CD%"/);
    }
    assert.match(source,/codex-profiles\\codex-/);
    assert.match(source,/Remove-Item \('Env:' \+ \$name\)/);
    assert.doesNotMatch(source,/npx|auth\.json|Copy-Item/i);
  });
  it('uses the same API for every desktop method and removes listeners',()=>{
    let exposed;const listeners=new Set();
    const renderer={invoke:async()=>({result:null}),on:(_name,fn)=>listeners.add(fn),removeListener:(_name,fn)=>listeners.delete(fn)};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../electron/preload.js'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,api)=>{exposed=api;}},ipcRenderer:renderer})});
    for(const [group,methods] of Object.entries(exposed)) if(group!=='window' && typeof methods==='object') for(const method of Object.keys(methods)) if(method!=='onOpenProgress') assert.ok(application.handlers[group+':'+method],group+':'+method);
    const unsubscribe=exposed.emails.onOpenProgress(()=>{});assert.equal(listeners.size,1);unsubscribe();assert.equal(listeners.size,0);
  });
  it('rejects unknown RPC methods rather than resolving prototype properties',async()=>{
    await assert.rejects(application.invoke('toString'),/válida/);
    await assert.rejects(application.invoke('constructor'),/válida/);
  });
  it('email CRUD returns saved records and enforces case-insensitive uniqueness',async()=>{
    const id=await application.invoke('emails:add',[{email:'person@example.com',name:'Person'}]);
    const changed=await application.invoke('emails:update',[id,{favorite:1,alias:'persisted'}]);
    assert.equal(changed.favorite,1);assert.equal(changed.alias,'persisted');assert.equal(changed.url,'https://mail.google.com/');
    await assert.rejects(application.invoke('emails:add',[{email:'PERSON@example.com'}]),/registrado/);
    assert.equal((await application.invoke('emails:search',['persisted'])).length,1);
  });
  it('provider changes update default URLs and reject unsafe links',async()=>{
    const id=application.db.getEmails()[0].id;
    const changed=await application.invoke('emails:update',[id,{provider:'outlook',url:''}]);
    assert.equal(changed.url,'https://outlook.live.com/');
    await assert.rejects(application.invoke('emails:update',[id,{url:'file:///C:/Windows/system32/cmd.exe'}]),/http/);
    await assert.rejects(application.invoke('emails:add',[{email:'broken'}]),/válida/);
    await assert.rejects(application.invoke('emails:add',[{email:'other@example.com',provider:'other'}]),/URL/);
  });
  it('bulk email imports roll back completely on invalid rows',async()=>{
    const before=application.db.getEmails().length;
    await assert.rejects(application.invoke('emails:import',[[{email:'valid@example.com'},{email:'invalid'}]]));
    assert.equal(application.db.getEmails().length,before);
  });
  it('deleting a group preserves emails and removes stale group names',async()=>{
    const id=application.db.addGroup('Temporary');const mail=application.db.addEmail({email:'group@example.com',group_name:'Temporary'});
    application.db.deleteGroup(id);assert.equal(application.db.getEmail(mail).group_name,'');
  });
  it('detects real projects and clears account links on delete',async()=>{
    const projectDir=path.join(root,"project's & space");fs.mkdirSync(projectDir);fs.writeFileSync(path.join(projectDir,'example.sln'),'');
    const id=await application.invoke('projects:add',[{name:'Project',path:projectDir,has_git:1}]);
    assert.equal(application.db.getProject(id).has_git,0);assert.equal(application.db.getProject(id).project_type,'dotnet');
    const a=application.db.getCodexAccounts()[0];application.db.updateCodexAccount(a.id,{current_project_id:id});
    await assert.rejects(application.invoke('projects:add',[{name:'Duplicate',path:projectDir}]),/registrada/);
    application.db.deleteProject(id);assert.equal(application.db.getCodexAccount(a.id).current_project_id,null);
    assert.ok(fs.existsSync(projectDir));
  });
  it('fails for missing projects and directories without launching a different context',async()=>{
    await assert.rejects(application.invoke('projects:detect',[path.join(root,'missing')]),/carpeta/);
    await assert.rejects(application.invoke('codex:launch',[application.db.getCodexAccounts()[0].id,'missing']),/Proyecto/);
  });
  it('restores account metadata, links, emails, groups and preferences atomically',async()=>{
    const project=application.db.addProject({name:'Backup project',path:root});
    const account=application.db.getCodexAccounts()[0];application.db.updateCodexAccount(account.id,{current_project_id:project});
    application.settings.update({batchOpenInterval:4,preferredBrowser:'edge'});
    const backup=application.db.exportData();assert.ok(!Object.hasOwn(backup.codexAccounts[0],'profile_path'));assert.ok(!Object.hasOwn(backup.codexAccounts[0],'configured'));
    const restoreRoot=path.join(root,'restored'),restore=createApplication({dataPath:restoreRoot});
    try {
      restore.db.importData(backup);
      const restored=restore.db.getCodexAccountBySlot(1);
      assert.equal(restored.label,account.label);assert.notEqual(restored.id,account.id);
      assert.equal(restore.db.getProject(restored.current_project_id).path,root);
      assert.equal(restore.settings.get('batchOpenInterval'),4);assert.equal(restore.settings.get('preferredBrowser'),'edge');
      assert.equal(restore.db.getEmails().length,backup.emails.length);
      const old=restore.db.getEmails()[0];
      assert.throws(()=>restore.db.importData({...backup,emails:[{...old,name:'Bad update'}],settings:[{key:'batchOpenInterval',value:'999'}]}));
      assert.equal(restore.db.getEmail(old.id).name,old.name);
    } finally {restore.close();}
  });
  it('does not mark empty or corrupt credential files as authenticated',()=>{
    const [a,b]=application.db.getCodexAccounts();const profile=application.codex.getProfilePath(a.id);
    fs.writeFileSync(path.join(profile,'auth.json'),'{}');assert.equal(application.codex.isAccountAuthenticated(a.id),false);
    fs.writeFileSync(path.join(profile,'auth.json'),JSON.stringify({tokens:{access_token:'test-access',refresh_token:'test-refresh'}}));
    assert.equal(application.codex.isAccountAuthenticated(a.id),true);assert.equal(application.codex.isAccountAuthenticated(b.id),false);
    const launcher=application.codex.generateBatLauncher(a.id);
    assert.ok(!launcher.content.includes(a.label));assert.ok(!launcher.content.includes('test-access'));
    const decoded=Buffer.from(launcher.content.match(/-EncodedCommand (\S+)/)[1],'base64').toString('utf16le');
    assert.ok(decoded.includes('cli_auth_credentials_store'));assert.ok(decoded.includes('Remove-Item Env:OPENAI_API_KEY'));
  });
  it('protects browser profile boundaries and does not silently fall back to shared browsing',()=>{
    assert.throws(()=>application.browser.getProfileDir('../outside'),/inválido/);
    assert.throws(()=>application.browser.getProfileDir('C:\\outside'),/inválido/);
    assert.notEqual(application.browser.getProfileDir('chatgpt-01'),application.browser.getProfileDir('chatgpt-02'));
  });
  it('batch reports failures and supports cancellation without leaving a stuck busy state',async()=>{
    const original=application.browser.openEmail;
    application.browser.openEmail=async id=>{if(id==='bad') throw new Error('missing browser');return {success:true};};
    try {
      let result=await application.browser.openMultipleEmails(['bad'],1);
      assert.equal(result.failed,1);assert.equal(result.done,true);
      const pending=application.browser.openMultipleEmails(['first','second'],1,p=>{if(p.opened===1)application.browser.cancelBatch();});
      await assert.rejects(application.browser.openMultipleEmails(['third'],1),/curso/);
      result=await pending;assert.equal(result.opened,1);assert.equal(result.cancelled,true);assert.equal(application.browser.batch,null);
    } finally {application.browser.openEmail=original;}
  });
  it('spawn failures reject and labels are literal PowerShell strings',async()=>{
    assert.equal(psLiteral("O'Brien & $(bad)"),"'O''Brien & $(bad)'");
    assert.equal(Buffer.from(encodedCommand('áéí'),'base64').toString('utf16le'),'áéí');
    await assert.rejects(spawnDetached(path.join(root,'missing.exe'),[]));
    const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fixture-only';
    try{const env=isolatedEnv(root);assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.CODEX_HOME,root);}finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
  });
});

describe('Loopback HTTP bridge security and real RPC',()=>{
  let root,bridge,server,base,token;
  before(async()=>{
    root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-http-'));bridge=createApiBridge({dataPath:root});
    server=http.createServer((req,res)=>bridge.handleApiRequest(req,res,()=>{res.writeHead(404);res.end();}));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
    token=(await (await fetch(base+'/api/session')).json()).token;
  });
  after(async()=>{await new Promise(resolve=>server.close(resolve));bridge.close();fs.rmSync(root,{recursive:true,force:true});});
  it('rejects missing tokens, hostile origins and malformed JSON',async()=>{
    assert.equal((await fetch(base+'/api/rpc',{method:'POST'})).status,403);
    assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://untrusted.example'}})).status,403);
    const hostileHost = await new Promise(resolve => {
      http.get(base+'/api/session',{headers:{Host:'untrusted.example:5173'}},res=>{res.resume();resolve(res.statusCode);});
    });
    assert.equal(hostileHost,403);
    const response=await fetch(base+'/api/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-AccountHub-Token':token},body:'{bad'});
    assert.equal(response.status,400);assert.match((await response.json()).error,/JSON/);assert.equal(response.headers.get('access-control-allow-origin'),null);
  });
  it('returns real persisted records and dashboard statistics',async()=>{
    const rpc=async(method,args=[])=>{
      const r=await fetch(base+'/api/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-AccountHub-Token':token},body:JSON.stringify({method,args})});
      assert.equal(r.status,200);return (await r.json()).result;
    };
    const id=await rpc('emails:add',[{email:'http@example.com'}]);assert.ok(id);
    assert.equal((await rpc('emails:getAll'))[0].id,id);
    assert.equal((await rpc('dashboard:getStats')).emails.total,1);
    assert.equal((await rpc('codex:getAccounts')).length,6);
  });
});

describe('Terminal session lifecycle and cursor recovery',()=>{
  it('keeps unique cursors after truncation/clear/restart and never mixes accounts',()=>{
    let data,exit,kills=0,writes=[];
    const manager=new TerminalManager({maxChunks:3,spawn:()=>({pid:123,onData:fn=>{data=fn;},onExit:fn=>{exit=fn;},write:value=>writes.push(value),resize:()=>{},kill:()=>{kills++;}})});
    const options={accountId:'one',profilePath:os.tmpdir(),cwd:os.tmpdir()};
    const session=manager.getOrCreateSession('one',options);
    for(let i=0;i<6;i++)data('chunk '+i);
    let result=manager.getOutput('one',0);assert.equal(result.lines.length,3);assert.equal(result.nextIndex,6);assert.equal(result.truncated,true);
    assert.throws(()=>manager.getOrCreateSession('one',{...options,profilePath:'other'}),/otra/);
    manager.sendInput('one','\x03');assert.equal(writes[0],'\x03');
    manager.clearOutput('one');data('after clear');assert.equal(manager.getOutput('one',6).lines[0].id,6);
    exit({exitCode:0});assert.equal(session.isRunning,false);
    manager.getOrCreateSession('one',options);data('restarted');result=manager.getOutput('one',7,result.generation);
    assert.equal(result.reset,true);assert.equal(result.lines[0].text,'restarted');
    manager.killAccount('one');assert.equal(kills,1);manager.dispose();
  });
});
