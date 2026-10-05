const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Database } = require('../electron/database');

describe('Account Hub - Database Suite', () => {
  let tmpDir;
  let db;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounthub-test-'));
    db = new Database(tmpDir);
  });

  after(() => {
    try {
      if (db && db.db) db.db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors on Windows locks
    }
  });

  it('should initialize and migrate schema properly', () => {
    const version = db.db.prepare('SELECT MAX(version) as v FROM schema_version').get();
    assert.strictEqual(version.v, 1);
  });

  it('should seed default 6 Codex account slots', () => {
    db.initializeDefaultSlots();
    const accounts = db.getCodexAccounts();
    assert.strictEqual(accounts.length, 6);
    assert.strictEqual(accounts[0].slot_number, 1);
    assert.strictEqual(accounts[5].slot_number, 6);
    assert.ok(accounts[0].profile_path.includes('codex-01'));
  });

  it('should update account status and details', () => {
    const accounts = db.getCodexAccounts();
    const first = accounts[0];
    db.updateCodexAccount(first.id, {
      status: 'working',
      alias: 'mi-codex-dev',
      email: 'test@openai.com',
      notes: 'Probando límites',
    });

    const updated = db.getCodexAccount(first.id);
    assert.strictEqual(updated.status, 'working');
    assert.strictEqual(updated.alias, 'mi-codex-dev');
    assert.strictEqual(updated.email, 'test@openai.com');
  });

  it('should support email accounts CRUD and search', () => {
    const id = db.addEmail({
      email: 'trabajo@empresa.com',
      name: 'Daniel Trabajo',
      alias: 'corp',
      provider: 'gmail',
      group_name: 'Trabajo',
      favorite: 1,
    });

    assert.ok(id);
    const email = db.getEmail(id);
    assert.strictEqual(email.email, 'trabajo@empresa.com');
    assert.strictEqual(email.favorite, 1);

    const searchResults = db.searchEmails('corp');
    assert.strictEqual(searchResults.length, 1);
    assert.strictEqual(searchResults[0].id, id);

    const favorites = db.getFavoriteEmails();
    assert.ok(favorites.some((f) => f.id === id));
  });

  it('should manage projects and activity log', () => {
    const projId = db.addProject({
      name: 'Mi Repositorio',
      path: 'C:\\Proyectos\\repo1',
      has_git: 1,
      project_type: 'node',
      notes: 'Proyecto web',
    });

    const proj = db.getProject(projId);
    assert.strictEqual(proj.name, 'Mi Repositorio');
    assert.strictEqual(proj.has_git, 1);

    db.logActivity('TEST_ACTION', 'Actividad de prueba registrada');
    const recent = db.getRecentActivity(5);
    assert.ok(recent.length > 0);
    assert.strictEqual(recent[0].action, 'TEST_ACTION');
  });
});
