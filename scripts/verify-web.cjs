const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'.audit'),{recursive:true});
const fixture = fs.mkdtempSync(path.join(root,'.audit','web-'));
const production = process.argv.includes('--production');
const port = production ? 5188 : 5187;
const base = 'http://127.0.0.1:'+port;
const env = { ...process.env, ACCOUNT_HUB_DATA_DIR:fixture, ACCOUNT_HUB_TEST:'1', ACCOUNT_HUB_WEB_PORT:String(port) };
delete env.ELECTRON_RUN_AS_NODE;
const command = production ? path.join(root,'scripts/web-server.cjs') : path.join(root,'node_modules/vite/bin/vite.js');
const args = production ? [command] : [command,'--port',String(port)];
const server = spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
(async()=>{
  let browser;
  try {
    let health;
    for(let i=0;i<100;i++){
      try { health=await fetch(base+'/api/session'); if(health.ok) break; } catch {}
      if(i===99) throw new Error('El servidor web local no inició: '+output);
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(production) {
      assert.match(health.headers.get('content-type') || '',/application\/json/i);
      assert.match(health.headers.get('cache-control') || '',/no-store/i);
      const index=await fetch(base+'/');
      assert.match(index.headers.get('content-security-policy') || '',/frame-ancestors 'none'/);
      assert.equal((await fetch(base+'/settings')).status,200);
    }
    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:950}});
    const errors=[],browserConsole=[];page.on('pageerror',err=>errors.push(err.message));page.on('console',msg=>browserConsole.push(msg.type()+': '+msg.text()));
    await page.goto(base);
    await expect(page.getByText('Bienvenido a tu centro de multicuentas')).toBeVisible();
    assert.equal(await page.evaluate(()=>window.electronAPI.isWeb),true);
    await page.evaluate(()=>window.electronAPI.onboarding.complete());await page.reload();
    await page.getByRole('button',{name:'Cuentas de Correo',exact:true}).click();
    await page.getByRole('button',{name:'Agregar Correo',exact:true}).click();
    await page.getByPlaceholder('ejemplo@gmail.com').fill('web@example.com');
    await page.getByRole('button',{name:'Crear Cuenta',exact:true}).click();
    await expect(page.locator('.email-item').filter({hasText:'web@example.com'})).toBeVisible();
    await page.getByRole('button',{name:'Importar',exact:true}).click();
    await page.getByPlaceholder('Pegá aquí el JSON...').fill(JSON.stringify([{email:'bulk1@example.com'},{email:'bulk2@example.com',provider:'outlook'}]));
    await page.getByRole('button',{name:'Importar Datos',exact:true}).click();
    await expect(page.locator('.email-item')).toHaveCount(3);
    await page.getByRole('button',{name:'Importar',exact:true}).click();
    await page.getByPlaceholder('Pegá aquí el JSON...').fill('text3@example.com\ntext4@example.com\n');
    await page.getByRole('button',{name:'Importar Datos',exact:true}).click();
    await expect(page.locator('.email-item')).toHaveCount(5);
    await page.getByRole('button',{name:'Importar',exact:true}).click();
    await page.getByPlaceholder('Pegá aquí el JSON...').fill('email,name,group,provider,favorite\n"csv5@example.com","Prueba, uno",Pruebas,gmail,yes\ncsv6@example.com,Outlook,Trabajo,outlook,no');
    await page.getByRole('button',{name:'Importar Datos',exact:true}).click();
    await expect(page.locator('.email-item')).toHaveCount(7);
    await page.reload();await expect(page.locator('.email-item')).toHaveCount(7);
    const group=await page.evaluate(()=>window.electronAPI.groups.add('Test web'));
    assert.ok(group);
    await page.getByRole('button',{name:'Proyectos Locales',exact:true}).click();
    await page.getByRole('button',{name:'Registrar Proyecto',exact:true}).click();
    if(production) {
      await expect(page.getByText('En el navegador, ingresá la ruta completa de una carpeta de esta misma PC.')).toBeVisible();
      page.once('dialog',dialog=>dialog.accept(fixture));
      await page.getByRole('button',{name:'Ingresar ruta...',exact:true}).click();
      await expect(page.getByRole('dialog').getByRole('textbox').nth(0)).toHaveValue(fixture);
      await expect(page.getByRole('button',{name:/Registrar Proyecto/})).toBeVisible();
      await page.getByPlaceholder('Mi Proyecto Web').fill('Web fixture');
      const projectResponse = page.waitForResponse(response => response.url().endsWith('/api/rpc') && response.request().method()==='POST' && response.request().postData()?.includes('projects:add'),{timeout:15000});
      await page.getByRole('button',{name:'Registrar',exact:true}).click();
      const projectResult = await projectResponse;
      const projectPayload = await projectResult.json();
      if (!projectResult.ok() || projectPayload.error) throw new Error('La API web rechazó el alta del proyecto: '+(projectPayload.error || projectResult.status()));
      await expect(page.getByRole('dialog')).toBeHidden({timeout:15000});
    } else {
      await page.evaluate(async dir=>{await window.electronAPI.projects.add({name:'Web fixture',path:dir});},fixture);
    }
    if(production) await expect(page.getByText('Web fixture',{exact:true})).toBeVisible({timeout:15000});
    await page.reload();await expect(page.getByText('Web fixture',{exact:true})).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'Configuración',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Configuración y Diagnóstico'})).toBeVisible({timeout:30000});
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Exportar Copia de Seguridad'}).click();
    const download=await downloadPromise;await download.saveAs(path.join(fixture,'backup.json'));
    const backup=JSON.parse(fs.readFileSync(path.join(fixture,'backup.json'),'utf8'));
    assert.equal(backup.emails.length,7);assert.equal(backup.projects.length,1);
    await page.screenshot({path:path.join(fixture,'web-settings.png'),fullPage:true});
    if(production) assert.deepEqual(browserConsole.filter(message=>message.startsWith('error:')),[]);
    // Explicit backend errors must reject, never mutate an offline shadow database.
    const failure=await page.evaluate(async()=>{
      try{await window.electronAPI.projects.detect('C:\\not-a-real-project-accounthub');return false;}catch{return true;}
    });assert.equal(failure,true);
    assert.equal(await page.evaluate(()=>localStorage.length),0);
    await page.route('**/api/session',route=>route.abort());
    await page.reload();await expect(page.getByRole('heading',{name:'No se pudo conectar con Account Hub'})).toBeVisible();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({ok:true,production,fixture,checks:['web onboarding','SQLite email CRUD','bulk import','reload persistence','project registration','backup download','no simulated fallback','offline error recovery',...(production?['production HTTP server','SPA direct routes','security response headers']:[])],errors},null,2));
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
