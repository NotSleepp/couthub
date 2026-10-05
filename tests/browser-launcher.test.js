const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Database } = require('../electron/database');
const { BrowserLauncher } = require('../electron/services/browser-launcher');
const { Logger } = require('../electron/services/logger');

describe('Account Hub - Browser Launcher Isolation Suite', () => {
  let tmpDir;
  let db;
  let launcher;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounthub-launcher-test-'));
    db = new Database(tmpDir);
    db.initializeDefaultSlots();
    const logger = new Logger(tmpDir);
    launcher = new BrowserLauncher(tmpDir, db, logger);
  });

  after(() => {
    try {
      if (db && db.db) db.db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  it('should isolate browser profiles under dedicated user-data-dir paths', () => {
    const profileDir = launcher.getProfileDir('chatgpt-01');
    assert.ok(fs.existsSync(profileDir));
    assert.ok(profileDir.includes('browser-profiles'));
    assert.ok(profileDir.includes('chatgpt-01'));
  });

  it('should create independent profile folders for email accounts', () => {
    const emailProfileDir = launcher.getProfileDir('email-trabajo-01');
    assert.ok(fs.existsSync(emailProfileDir));
    assert.ok(emailProfileDir.includes('email-trabajo-01'));
  });
});
