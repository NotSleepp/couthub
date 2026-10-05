import type { ElectronAPI, OpenProgress } from '../types/electron';

let tokenPromise: Promise<string> | null = null;
async function token(): Promise<string> {
  if (!tokenPromise) tokenPromise = fetch('/api/session', { credentials:'same-origin', signal:AbortSignal.timeout(10000) }).then(async r => {
    if (!r.ok) throw new Error('No se pudo conectar con Account Hub. Abrí la aplicación o iniciá el servidor local.');
    const data = await r.json();
    if (!data.token) throw new Error('El servicio local no respondió correctamente.');
    return data.token as string;
  }).catch(err => { tokenPromise=null; throw err; });
  return tokenPromise;
}
async function invoke<T>(method: string, ...args: unknown[]): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/rpc', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-AccountHub-Token':await token()}, body:JSON.stringify({method,args}), signal:AbortSignal.timeout(method==='emails:openMultiple' ? 1100000 : 120000) });
  } catch (err) { throw new Error(err instanceof Error ? err.message : 'Se perdió la conexión con el servicio local.'); }
  const data=await response.json();
  if (!response.ok || data.error) {
    if (response.status===403) tokenPromise=null;
    throw new Error(data.error || 'La operación no pudo completarse.');
  }
  return data.result;
}
export function downloadFile(filename: string, content: string, type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function initWebAdapter() {
  if (window.electronAPI) return;
  const methods: Record<string,string[]> = {
    window:['minimize','maximize','close','isMaximized'],
    settings:['getAll','update','detectTools'],
    codex:['getAccounts','getAccount','addAccount','updateAccount','launch','configure','getProfilePath','isAuthenticated','logout','importExisting','generateLauncher'],
    chatgpt:['open'],emails:['getAll','search','getByGroup','add','update','delete','import','open','openMultiple','cancelBatch','getProgress'],
    groups:['getAll','add','delete'],projects:['getAll','add','update','delete','detect','openFolder','openTerminal','openVSCode','openGitHub','selectDirectory'],
    worktrees:['getForProject','create','remove','getStatus','launch'],terminal:['start','input','output','resize','kill','clear'],
    process:['checkRunning'],logs:['getRecent'],activity:['log'],dashboard:['getStats'],
    config:['export','import','exportData','importData'],onboarding:['isComplete','complete'],system:['openExternal'],launchers:['openFolder'],
  };
  const bridge: Record<string,unknown>={isWeb:true};
  for (const [group,names] of Object.entries(methods)) bridge[group]=Object.fromEntries(names.map(name=>[name,(...args:unknown[])=>invoke(group+':'+name,...args)]));
  const api=bridge as unknown as ElectronAPI;
  api.window={minimize:async()=>{},maximize:async()=>{},close:async()=>{},isMaximized:async()=>false};
  api.projects.selectDirectory=async()=>window.prompt('Ingresá la ruta completa de la carpeta del proyecto:') || null;
  api.emails.onOpenProgress=(callback:(progress:OpenProgress)=>void)=>{
    let active=true, busy=false, last='';
    const timer=setInterval(async()=>{
      if (busy) return; busy=true;
      try { const p=await api.emails.getProgress(); const value=JSON.stringify(p); if(active && p.total>0 && value!==last) { last=value; callback(p); } } catch {} finally {busy=false;}
    },500);
    return ()=>{active=false;clearInterval(timer);};
  };
  api.config.export=async()=>{
    const data=await api.config.exportData();
    downloadFile('account-hub-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2));
    return true;
  };
  api.config.import=()=>new Promise<boolean>((resolve,reject)=>{
    const input=document.createElement('input'); input.type='file'; input.accept='.json';
    input.oncancel=()=>resolve(false);
    input.onchange=async()=>{
      const file=input.files?.[0]; if(!file) return resolve(false);
      try {
        if(file.size>2*1024*1024) throw new Error('La copia supera 2 MB.');
        const data=JSON.parse(await file.text());
        resolve(await api.config.importData(data));
      } catch(err) {reject(err);}
    };
    input.click();
  });
  window.electronAPI=api;
}
