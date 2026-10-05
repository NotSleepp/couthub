const { contextBridge, ipcRenderer } = require('electron');
const methods = {
  window:['minimize','maximize','close','isMaximized'],
  settings:['getAll','update','detectTools'],
  codex:['getAccounts','getAccount','addAccount','updateAccount','launch','configure','getProfilePath','isAuthenticated','logout','importExisting','generateLauncher'],
  chatgpt:['open'],
  emails:['getAll','search','getByGroup','add','update','delete','import','open','openMultiple','cancelBatch','getProgress'],
  groups:['getAll','add','delete'],
  projects:['getAll','add','update','delete','detect','openFolder','openTerminal','openVSCode','openGitHub','selectDirectory'],
  worktrees:['getForProject','create','remove','getStatus','launch'],
  terminal:['start','input','output','resize','kill','clear'],
  process:['checkRunning'],logs:['getRecent'],activity:['log'],dashboard:['getStats'],
  config:['export','import','exportData','importData'],onboarding:['isComplete','complete'],system:['openExternal'],launchers:['openFolder']
};
const api={isWeb:false};
for(const [group,names] of Object.entries(methods)) {
  api[group]={};
  for(const name of names) api[group][name]=async (...args)=>{
    const response=await ipcRenderer.invoke('account-hub:rpc',group+':'+name,args);
    if(response.error) throw new Error(response.error);
    return response.result;
  };
}
api.emails.onOpenProgress=callback=>{
  const listener=(_event,progress)=>callback(progress);
  ipcRenderer.on('emails:openProgress',listener);
  return ()=>ipcRenderer.removeListener('emails:openProgress',listener);
};
contextBridge.exposeInMainWorld('electronAPI',api);
