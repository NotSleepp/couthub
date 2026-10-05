const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID: uuidv4 } = require('node:crypto');
const validate = require('./validation');

class Database {
  constructor(dataPath) {
    this.dataPath = dataPath;
    const dbDir = path.join(dataPath, 'data');
    fs.mkdirSync(dbDir, { recursive: true });
    this.dbPath = path.join(dbDir, 'accounthub.db');
    this.db = new BetterSqlite3(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    const currentVersion = this.db.prepare('SELECT MAX(version) as v FROM schema_version').get();
    let version = currentVersion?.v || 0;

    if (version < 1) {
      this.db.exec(`
        CREATE TABLE codex_accounts (
          id TEXT PRIMARY KEY,
          slot_number INTEGER NOT NULL UNIQUE,
          label TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          alias TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT '#6366f1',
          avatar TEXT DEFAULT NULL,
          status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('available','working','limit','resting','unknown')),
          notes TEXT NOT NULL DEFAULT '',
          last_used TEXT DEFAULT NULL,
          restore_at TEXT DEFAULT NULL,
          current_project_id TEXT DEFAULT NULL,
          profile_path TEXT NOT NULL DEFAULT '',
          configured INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE email_accounts (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          alias TEXT NOT NULL DEFAULT '',
          provider TEXT NOT NULL DEFAULT 'gmail' CHECK(provider IN ('gmail','outlook','other')),
          group_name TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT '#6366f1',
          notes TEXT NOT NULL DEFAULT '',
          browser_profile TEXT NOT NULL DEFAULT '',
          url TEXT NOT NULL DEFAULT '',
          favorite INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          has_git INTEGER NOT NULL DEFAULT 0,
          project_type TEXT NOT NULL DEFAULT '',
          remote_url TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE groups_table (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#6366f1',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        INSERT INTO schema_version (version) VALUES (1);
      `);
      version = 1;
    }

    // Future migrations go here with version checks
  }

  // === Codex Accounts ===
  initializeDefaultSlots() {
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM codex_accounts').get();
    if (existing.count > 0) return;

    const defaultColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    const defaultLabels = ['Principal', 'Desarrollo', 'Desarrollo 2', 'Frontend', 'Extra', 'Extra 2'];

    const insert = this.db.prepare(`
      INSERT INTO codex_accounts (id, slot_number, label, color, profile_path)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < 6; i++) {
        const id = uuidv4();
        const profilePath = path.join(this.dataPath, 'codex-profiles', `codex-${String(i + 1).padStart(2, '0')}`);
        insert.run(id, i + 1, defaultLabels[i], defaultColors[i], profilePath);
      }
    });
    transaction();

    // Default groups
    const defaultGroups = ['Personales', 'Trabajo', 'Desarrollo', 'Clientes', 'Pruebas', 'Servicios', 'Otros'];
    const insertGroup = this.db.prepare('INSERT OR IGNORE INTO groups_table (id, name) VALUES (?, ?)');
    defaultGroups.forEach((g) => insertGroup.run(uuidv4(), g));
  }

  getCodexAccounts() {
    return this.db.prepare('SELECT * FROM codex_accounts ORDER BY slot_number').all();
  }

  getCodexAccount(id) {
    return this.db.prepare('SELECT * FROM codex_accounts WHERE id = ?').get(id);
  }

  getCodexAccountBySlot(slot) {
    return this.db.prepare('SELECT * FROM codex_accounts WHERE slot_number = ?').get(slot);
  }

  addCodexAccount(data = {}, slot) {
    validate.object(data); validate.strings(data);
    const number = slot ?? (this.db.prepare('SELECT MAX(slot_number) AS n FROM codex_accounts').get().n || 0) + 1;
    if (!Number.isInteger(number) || number < 1 || number > 9999) throw new Error('Número de ranura inválido.');
    const id = uuidv4();
    const profile = path.join(this.dataPath, 'codex-profiles', `codex-${String(number).padStart(2, '0')}`);
    this.db.prepare('INSERT INTO codex_accounts (id,slot_number,label,color,profile_path) VALUES (?,?,?,?,?)').run(id,number,data.label || `Cuenta ${number}`,data.color || '#6366f1',profile);
    return id;
  }

  updateCodexAccount(id, data) {
    validate.object(data); validate.strings(data);
    if (!this.getCodexAccount(id)) throw new Error('Cuenta no encontrada.');
    if (data.current_project_id && !this.getProject(data.current_project_id)) throw new Error('Proyecto no encontrado.');
    if (data.restore_at && Number.isNaN(Date.parse(data.restore_at))) throw new Error('Fecha de recuperación inválida.');
    const fields = [];
    const values = [];
    const allowed = ['label', 'email', 'alias', 'color', 'avatar', 'status', 'notes',
      'last_used', 'restore_at', 'current_project_id', 'configured'];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return this.getCodexAccount(id);
    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE codex_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getCodexAccount(id);
  }

  // === Email Accounts ===
  getEmails() {
    return this.db.prepare('SELECT * FROM email_accounts ORDER BY favorite DESC, name ASC').all();
  }

  getEmail(id) {
    return this.db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(id);
  }

  searchEmails(query) {
    const q = `%${query}%`;
    return this.db.prepare(`
      SELECT * FROM email_accounts
      WHERE email LIKE ? OR name LIKE ? OR alias LIKE ? OR group_name LIKE ? OR provider LIKE ? OR notes LIKE ?
      ORDER BY favorite DESC, name ASC
    `).all(q, q, q, q, q, q);
  }

  getEmailsByGroup(group) {
    return this.db.prepare('SELECT * FROM email_accounts WHERE group_name = ? ORDER BY favorite DESC, name ASC').all(group);
  }

  getFavoriteEmails() {
    return this.db.prepare('SELECT * FROM email_accounts WHERE favorite = 1 ORDER BY name ASC').all();
  }

  addEmail(data) {
    data = validate.email(data);
    if (this.db.prepare('SELECT id FROM email_accounts WHERE lower(email) = lower(?)').get(data.email)) throw new Error('Ese correo ya está registrado.');
    if (data.group_name && !this.db.prepare('SELECT id FROM groups_table WHERE name=?').get(data.group_name)) this.addGroup(data.group_name);
    const id = uuidv4();
    const browserProfile = `email-${id}`;
    this.db.prepare(`
      INSERT INTO email_accounts (id, email, name, alias, provider, group_name, color, notes, browser_profile, url, favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.email || '',
      data.name || '',
      data.alias || '',
      data.provider || 'gmail',
      data.group_name || '',
      data.color || '#6366f1',
      data.notes || '',
      browserProfile,
      data.url || getDefaultUrl(data.provider || 'gmail'),
      data.favorite ? 1 : 0
    );
    return id;
  }

  updateEmail(id, data) {
    validate.object(data);
    const existing = this.getEmail(id);
    if (!existing) throw new Error('Correo no encontrado.');
    data = { ...data };
    if (data.provider && data.provider !== existing.provider && !data.url) data.url = getDefaultUrl(data.provider);
    validate.email({ ...existing, ...data });
    if (data.group_name && !this.db.prepare('SELECT id FROM groups_table WHERE name=?').get(data.group_name)) this.addGroup(data.group_name);
    if (data.email && this.db.prepare('SELECT id FROM email_accounts WHERE lower(email)=lower(?) AND id != ?').get(data.email, id)) throw new Error('Ese correo ya está registrado.');
    const fields = [];
    const values = [];
    const allowed = ['email', 'name', 'alias', 'provider', 'group_name', 'color', 'notes', 'url', 'favorite'];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'favorite' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length === 0) return this.getEmail(id);
    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE email_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getEmail(id);
  }

  deleteEmail(id) {
    this.db.prepare('DELETE FROM email_accounts WHERE id = ?').run(id);
  }

  importEmails(emailsData) {
    if (!Array.isArray(emailsData) || emailsData.length > 5000) throw new Error('La importación debe contener una lista de hasta 5000 correos.');
    const inserted = [];
    const insert = this.db.transaction((emails) => {
      for (const data of emails) {
        const id = this.addEmail(data);
        inserted.push(id);
      }
    });
    insert(emailsData);
    return { count: inserted.length, ids: inserted };
  }

  // === Projects ===
  getProjects() {
    return this.db.prepare('SELECT * FROM projects ORDER BY name ASC').all();
  }

  getProject(id) {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  addProject(data) {
    validate.project(data);
    if (this.getProjects().some(p => path.resolve(p.path).toLowerCase() === path.resolve(data.path).toLowerCase())) throw new Error('Esa carpeta ya está registrada.');
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO projects (id, name, path, has_git, project_type, remote_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.path, data.has_git ? 1 : 0, data.project_type || '', data.remote_url || '', data.notes || '');
    return id;
  }

  updateProject(id, data) {
    validate.object(data);
    const existing = this.getProject(id);
    if (!existing) throw new Error('Proyecto no encontrado.');
    validate.project({ ...existing, ...data });
    if (data.path && this.getProjects().some(p => p.id !== id && path.resolve(p.path).toLowerCase() === path.resolve(data.path).toLowerCase())) throw new Error('Esa carpeta ya está registrada.');
    const fields = [];
    const values = [];
    const allowed = ['name', 'path', 'has_git', 'project_type', 'remote_url', 'notes'];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'has_git' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    if (fields.length === 0) return this.getProject(id);
    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getProject(id);
  }

  deleteProject(id) {
    this.db.transaction(() => {
      this.db.prepare('UPDATE codex_accounts SET current_project_id = NULL WHERE current_project_id = ?').run(id);
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    })();
  }

  // === Groups ===
  getGroups() {
    return this.db.prepare('SELECT * FROM groups_table ORDER BY name ASC').all();
  }

  addGroup(name) {
    name = validate.text(name, 'Grupo', 100);
    const id = uuidv4();
    this.db.prepare('INSERT INTO groups_table (id, name) VALUES (?, ?)').run(id, name);
    return id;
  }

  deleteGroup(id) {
    const group = this.db.prepare('SELECT name FROM groups_table WHERE id=?').get(id);
    if (group) this.db.prepare("UPDATE email_accounts SET group_name='' WHERE group_name=?").run(group.name);
    this.db.prepare('DELETE FROM groups_table WHERE id = ?').run(id);
  }

  // === Activity ===
  logActivity(action, details) {
    this.db.prepare('INSERT INTO activity_log (action, details) VALUES (?, ?)').run(action, JSON.stringify(details ?? {}));

    // Rotate logs: keep last 500
    this.db.prepare(`
      DELETE FROM activity_log WHERE id NOT IN (
        SELECT id FROM activity_log ORDER BY id DESC LIMIT 500
      )
    `).run();
  }

  getRecentActivity(limit = 10) {
    return this.db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').all(limit);
  }

  // === Export/Import ===
  exportConfig(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.exportData(), null, 2), 'utf-8');
    return true;
  }

  exportData() {
    return {
      version: '0.2.0',
      exportedAt: new Date().toISOString(),
      codexAccounts: this.getCodexAccounts().map(({ profile_path, configured, ...rest }) => rest),
      emails: this.getEmails(),
      projects: this.getProjects(),
      groups: this.getGroups(),
      settings: this.db.prepare('SELECT * FROM settings').all(),
    };

  }

  importConfig(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return this.importData(JSON.parse(raw));
  }

  importData(data) {
    validate.object(data);
    if (!['0.1.0', '0.2.0'].includes(data.version)) throw new Error('Versión de copia de seguridad no compatible.');
    for (const key of ['emails', 'groups', 'projects', 'codexAccounts', 'settings']) {
      if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].length > 5000)) throw new Error(`Lista inválida: ${key}`);
    }
    const { SettingsManager } = require('./services/settings-manager');

    const transaction = this.db.transaction(() => {
      if (data.emails) {
        for (const email of data.emails) {
          validate.email(email);
          const existing = this.db.prepare('SELECT id FROM email_accounts WHERE lower(email) = lower(?)').get(email.email);
          if (!existing) {
            const id = this.addEmail(email);
            // A backup may reconnect an existing local profile, never an arbitrary path.
            if (/^email-[a-zA-Z0-9_-]+$/.test(email.browser_profile || '') && !this.db.prepare('SELECT id FROM email_accounts WHERE browser_profile=?').get(email.browser_profile)) {
              this.db.prepare('UPDATE email_accounts SET browser_profile=? WHERE id=?').run(email.browser_profile, id);
            }
          } else this.updateEmail(existing.id, email);
        }
      }

      if (data.groups) {
        for (const group of data.groups) {
          validate.text(group.name, 'Grupo', 100);
          if (!this.db.prepare('SELECT id FROM groups_table WHERE name=?').get(group.name)) this.addGroup(group.name);
        }
      }

      const projectIds = new Map();
      if (data.projects) {
        for (const project of data.projects) {
          validate.project(project);
          const existing = this.getProjects().find(p => path.resolve(p.path).toLowerCase() === path.resolve(project.path).toLowerCase());
          const id = existing ? existing.id : this.addProject(project);
          if (existing) this.updateProject(id, project);
          projectIds.set(project.id, id);
        }
      }
      for (const account of data.codexAccounts || []) {
        if (!Number.isInteger(account.slot_number) || account.slot_number < 1 || account.slot_number > 9999) throw new Error('Ranura inválida en la copia.');
        let existing = this.getCodexAccountBySlot(account.slot_number);
        if (!existing) existing = this.getCodexAccount(this.addCodexAccount({}, account.slot_number));
        const { configured, profile_path, ...patch } = account;
        this.updateCodexAccount(existing.id, { ...patch, current_project_id: projectIds.get(account.current_project_id) || null });
      }
      const settings = new SettingsManager(this.dataPath, this);
      const patch = {};
      for (const row of data.settings || []) {
        if (['profilesDir', 'worktreesDir', 'startWithWindows', 'globalShortcut'].includes(row.key)) continue;
        patch[row.key] = JSON.parse(row.value);
      }
      settings.update(patch);
    });

    transaction();
    return true;
  }

  getDashboardStats() {
    const accounts = this.getCodexAccounts();
    const emails = this.getEmails();
    const codex = { total: accounts.length };
    for (const status of ['available', 'working', 'limit', 'resting', 'unknown']) codex[status] = accounts.filter(a => a.status === status).length;
    return { codex, emails: { total: emails.length, favorites: emails.filter(e => e.favorite).length }, projects: { total: this.getProjects().length }, recentActivity: this.getRecentActivity() };
  }

  close() { if (this.db.open) this.db.close(); }
}

function getDefaultUrl(provider) {
  switch (provider) {
    case 'gmail': return 'https://mail.google.com/';
    case 'outlook': return 'https://outlook.live.com/';
    default: return '';
  }
}

module.exports = { Database };
