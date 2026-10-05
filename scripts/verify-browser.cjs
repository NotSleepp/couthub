const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const os=require('node:os');
const {execFileSync,spawnSync}=require('node:child_process');
const {Database}=require('../electron/database');
const {Logger}=require('../electron/services/logger');
const {BrowserLauncher}=require('../electron/services/browser-launcher');
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'hub-browser-'));
const seen=new Set();let db;
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
  if(name==='first'||name==='second')seen.add(name);
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Account Hub browser profile verification</title>');
});
(async()=>{
  let profiles=[];
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    db=new Database(fixture);db.initializeDefaultSlots();
    const launcher=new BrowserLauncher(fixture,db,new Logger(fixture));
    launcher.getBrowserPath=()=>[
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      path.join(process.env.LOCALAPPDATA||'', 'Google/Chrome/Application/chrome.exe'),
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
    ].find(candidate=>fs.existsSync(candidate));
    const origin='http://127.0.0.1:'+server.address().port;
    for(const name of ['first','second']) {
      const opened=await launcher.launchBrowser('e2e-'+name,origin+'/'+name,{headless:true});
      profiles.push({name,id:opened.pid,dir:launcher.getProfileDir('e2e-'+name)});
    }
    const deadline=Date.now()+20000;
    while(Date.now()<deadline && seen.size<2) await new Promise(resolve=>setTimeout(resolve,100));
    assert.deepEqual([...seen].sort(),['first','second']);
    for(const profile of profiles) assert.ok(fs.existsSync(path.join(profile.dir,'Local State')),'Chrome created a real isolated profile: '+profile.name);
    console.log(JSON.stringify({ok:true,checks:['real Chrome process','local HTTP navigation','two distinct persistent user-data-dir profiles'],profiles:profiles.map(p=>({name:p.name,persisted:fs.existsSync(path.join(p.dir,'Local State'))}))},null,2));
  } finally {
    for(const profile of profiles) {
      try {
        const row=execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process -Filter "ProcessId = ${profile.id}" | Select-Object -ExpandProperty CommandLine`],{encoding:'utf8',timeout:8000,windowsHide:true});
        if(row.toLowerCase().includes(profile.dir.toLowerCase()) && /chrome(?:\.exe)?/i.test(row)) spawnSync('taskkill.exe',['/PID',String(profile.id),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      } catch {}
    }
    if(db?.db?.open) db.close();
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(fixture,{recursive:true,force:true});
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
