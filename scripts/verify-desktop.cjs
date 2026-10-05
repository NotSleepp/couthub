const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(root, '.audit', 'desktop-'));
const env = { ...process.env, ACCOUNT_HUB_DATA_DIR:fixture, ACCOUNT_HUB_TEST:'1', NODE_ENV:'production' };
delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.argv.includes('--packaged');
(async () => {
  let app;
  const errors = [];
  try {
    app = await electron.launch({ ...(packaged ? {executablePath:path.join(root,'release','win-unpacked','Account Hub.exe'),args:[]} : {args:[root]}), env, timeout:30000 });
    const page = await app.firstWindow();
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
    await expect(page.getByText('Bienvenido a tu centro de multicuentas')).toBeVisible();
    const accounts = await page.evaluate(() => window.electronAPI.codex.getAccounts());
    assert.equal(accounts.length, 6);
    assert.equal(await page.evaluate(() => window.electronAPI.isWeb), false);
    if (packaged) {
      const directory = path.join(root,'release','win-unpacked','resources','launchers');
      for (let slot=1;slot<=6;slot++) {
        const name=['Principal','Desarrollo','Desarrollo_2','Frontend','Extra','Extra_2'][slot-1];
        assert.ok(fs.existsSync(path.join(directory,`Slot-${String(slot).padStart(2,'0')}-${name}.bat`)));
      }
    }
    await page.evaluate(() => window.electronAPI.onboarding.complete());
    await page.reload();
    await expect(page.getByRole('heading',{name:'Panel Principal',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cuentas de Correo',exact:true}).click();
    await page.getByRole('button',{name:'Agregar Correo',exact:true}).click();
    await page.getByPlaceholder('ejemplo@gmail.com').fill('fixture@example.com');
    await page.getByPlaceholder('Juan Pérez').fill('Cuenta de prueba');
    await page.getByRole('button',{name:'Crear Cuenta',exact:true}).click();
    await expect(page.locator('.email-item').filter({hasText:'fixture@example.com'})).toBeVisible();
    await page.screenshot({path:path.join(fixture,'emails.png'),fullPage:true});
    await page.reload();
    await expect(page.locator('.email-item').filter({hasText:'fixture@example.com'})).toBeVisible();
    const backup = await page.evaluate(() => window.electronAPI.config.exportData());
    assert.equal(backup.emails.length,1);
    assert.equal(backup.codexAccounts.length,6);
    await page.getByRole('button',{name:'Cuentas Codex',exact:true}).click();
    await expect(page.locator('.codex-card')).toHaveCount(6);
    await page.screenshot({path:path.join(fixture,'accounts.png'),fullPage:true});
    await page.getByRole('button',{name:'Lanzar Codex',exact:true}).first().click();
    await page.getByRole('button',{name:'Iniciar Terminal',exact:true}).click();
    await expect(page.getByRole('dialog',{name:/Terminal de/})).toBeVisible();
    await page.getByRole('button',{name:'PowerShell',exact:true}).click();
    await expect(page.locator('.terminal-state')).toContainText('Terminal activa',{timeout:20000});
    const id = await page.evaluate(async accountId => (await window.electronAPI.terminal.start({accountId,mode:'shell'})).sessionId,accounts[0].id);
    await page.evaluate(async sessionId => {
      await window.electronAPI.terminal.input(sessionId, "Write-Output ('HUB_' + 'TERMINAL_OK'); Write-Output $env:CODEX_HOME\r");
    },id);
    await expect.poll(async () => page.evaluate(async sessionId => (await window.electronAPI.terminal.output(sessionId,0)).lines.map(l=>l.text).join(''),id),{timeout:20000}).toContain('HUB_TERMINAL_OK');
    await page.screenshot({path:path.join(fixture,'terminal.png'),fullPage:true});
    await page.getByRole('button',{name:'Detener',exact:true}).click();
    await expect(page.locator('.terminal-state')).toContainText('Terminal detenida');
    await page.getByRole('button',{name:'Cerrar terminal',exact:true}).click();
    await page.getByRole('button',{name:'Configuración',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Configuración y Diagnóstico'})).toBeVisible({timeout:30000});
    await page.screenshot({path:path.join(fixture,'settings.png'),fullPage:true});
    assert.deepEqual(errors,[],'Renderer must have no uncaught errors');
    console.log(JSON.stringify({ok:true,packaged,fixture,checks:['desktop preload','SQLite persistence','email UI CRUD','backup data','six accounts','interactive terminal input/output','terminal stop','settings diagnostics'],errors},null,2));
  } finally { if(app) await app.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
