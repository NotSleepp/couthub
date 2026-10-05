const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, globalShortcut, dialog, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createApplication } = require('./application');
const { webUrl } = require('./services/platform');

let mainWindow=null, tray=null, application=null, quitting=false;
const isDev=!app.isPackaged && process.env.NODE_ENV==='development';
const devUrl=process.env.ACCOUNT_HUB_DEV_URL || 'http://127.0.0.1:5173';
const entry=pathToFileURL(path.join(__dirname,'../dist/index.html')).href;
if(process.env.ACCOUNT_HUB_DATA_DIR) app.setPath('userData',path.resolve(process.env.ACCOUNT_HUB_DATA_DIR,'electron'));
const locked=app.requestSingleInstanceLock();
function showWindow() { if(!mainWindow) createWindow(); mainWindow.show(); if(mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
function allowed(url) {
  try { const u=new URL(url); return isDev ? u.origin===new URL(devUrl).origin : u.protocol==='file:' && u.pathname===new URL(entry).pathname; } catch { return false; }
}
function report(err) {
  application?.logger.error('Error de aplicación',{message:err.message});
  dialog.showErrorBox('Account Hub',err.message || String(err));
}
function safeAction(fn) { return ()=>Promise.resolve().then(fn).catch(report); }
function createWindow() {
  mainWindow=new BrowserWindow({
    width:1280,height:860,minWidth:900,minHeight:600,title:'Account Hub',backgroundColor:'#09090b',
    show:false,frame:false,icon:path.join(__dirname,'../build/icon.ico'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
  });
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    try { shell.openExternal(webUrl(url)).catch(report); } catch {}
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(!allowed(url)) event.preventDefault();});
  mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
  mainWindow.webContents.on('render-process-gone',(_event,details)=>application.logger.error('Interfaz interrumpida',details));
  mainWindow.once('ready-to-show',()=>{if(!application.settings.get('startMinimized') || !tray) mainWindow?.show();});
  mainWindow.on('close',event=>{
    if(!quitting && tray && application.settings.get('minimizeToTray')) {event.preventDefault();mainWindow.hide();}
  });
  mainWindow.on('closed',()=>{mainWindow=null;});
  (isDev ? mainWindow.loadURL(devUrl) : mainWindow.loadFile(path.join(__dirname,'../dist/index.html'))).catch(report);
}
function updateTray() {
  if(!tray || !application) return;
  const accounts=application.db.getCodexAccounts();
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Abrir Account Hub',click:showWindow},
    {label:'Codex',submenu:accounts.map(a=>({label:'#'+a.slot_number+' — '+a.label,click:safeAction(()=>application.codex.launchCodex(a.id,a.current_project_id))}))},
    {label:'ChatGPT',submenu:accounts.map(a=>({label:'#'+a.slot_number+' — '+a.label,click:safeAction(()=>application.browser.openChatGPT(a.id))}))},
    {label:'Correos favoritos',submenu:application.db.getFavoriteEmails().slice(0,20).map(e=>({label:e.email,click:safeAction(()=>application.browser.openEmail(e.id))}))},
    {type:'separator'},{label:'Salir',click:()=>app.quit()}
  ]));
}
function applySettings(settings) {
  // Fixtures never alter the user's startup registration or global shortcuts.
  if(process.env.ACCOUNT_HUB_TEST==='1') return;
  if(app.isPackaged) app.setLoginItemSettings({openAtLogin:settings.startWithWindows,path:process.execPath,args:[]});
  globalShortcut.unregisterAll();
  if(settings.globalShortcut && !globalShortcut.register(settings.globalShortcut,showWindow)) throw new Error('El atajo global ya está ocupado. Elegí otro o cerrá la otra instancia.');
}
async function initialize() {
  application=createApplication({
    resourcesPath:app.isPackaged ? process.resourcesPath : undefined,
    openPath:async value=>{const failure=await shell.openPath(value);if(failure)throw new Error(failure);return true;},
    settingsChanged:applySettings,
    selectDirectory:async()=>{
      const r=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory']});
      return r.canceled ? null : r.filePaths[0];
    },
    exportConfig:async db=>{
      const r=await dialog.showSaveDialog(mainWindow,{defaultPath:'account-hub-backup-'+new Date().toISOString().slice(0,10)+'.json',filters:[{name:'JSON',extensions:['json']}]});
      return r.canceled ? false : db.exportConfig(r.filePath);
    },
    importConfig:async db=>{
      const r=await dialog.showOpenDialog(mainWindow,{filters:[{name:'JSON',extensions:['json']}],properties:['openFile']});
      if(r.canceled) return false;
      db.importConfig(r.filePaths[0]);
      applySettings(application.settings.getAll());
      return true;
    },
    handlers:{
      'window:minimize':()=>mainWindow?.minimize(),
      'window:maximize':()=>mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(),
      'window:close':()=>mainWindow?.close(),
      'window:isMaximized':()=>mainWindow?.isMaximized() || false,
    }
  });
  ipcMain.handle('account-hub:rpc',async(event,method,args)=>{
    try {
      if(event.sender!==mainWindow?.webContents || event.senderFrame!==mainWindow?.webContents.mainFrame || !allowed(event.senderFrame.url)) throw new Error('Origen no autorizado.');
      return {result:await application.invoke(method,args)};
    } catch(err) {return {error:err.message || 'La operación no pudo completarse.'};}
  });
  application.events.on('emails:openProgress',progress=>mainWindow?.webContents.send('emails:openProgress',progress));
  application.events.on('changed',updateTray);
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  try {
    const icon=nativeImage.createFromPath(path.join(__dirname,'../build/tray-icon.png'));
    tray=new Tray(icon); tray.setToolTip('Account Hub'); tray.on('double-click',showWindow); updateTray();
  } catch(err) {application.logger.warn('Bandeja no disponible',{message:err.message});}
  createWindow();
  try {applySettings(application.settings.getAll());} catch(err) {application.logger.warn('Integración con Windows',{message:err.message});}
  application.logger.info('Account Hub iniciado',{version:app.getVersion()});
}
if(!locked) app.quit();
else {
  app.on('second-instance',showWindow);
  app.whenReady().then(initialize).catch(err=>{report(err);app.quit();});
  app.on('activate',showWindow);
}
app.on('before-quit',()=>{quitting=true;});
app.on('window-all-closed',()=>{if(!tray || !application?.settings.get('minimizeToTray')) app.quit();});
app.on('will-quit',()=>{globalShortcut.unregisterAll();application?.close();tray?.destroy();});
