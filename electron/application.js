const { EventEmitter } = require('node:events');
const path = require('node:path');
const os = require('node:os');
const { Database } = require('./database');
const { Logger } = require('./services/logger');
const { SettingsManager } = require('./services/settings-manager');
const { CodexManager } = require('./services/codex-manager');
const { BrowserLauncher } = require('./services/browser-launcher');
const { ProjectManager } = require('./services/project-manager');
const { GitManager } = require('./services/git-manager');
const { TerminalManager } = require('./services/terminal-manager');
const { externalUrl } = require('./services/platform');

function createApplication(options = {}) {
  const dataPath = options.dataPath || process.env.ACCOUNT_HUB_DATA_DIR || path.join(process.env.APPDATA || os.homedir(), 'AccountHub');
  const events = new EventEmitter();
  const db = new Database(dataPath);
  db.initializeDefaultSlots();
  const logger = new Logger(dataPath);
  const settings = new SettingsManager(dataPath, db);
  const codex = new CodexManager(dataPath, db, logger, settings);
  const browser = new BrowserLauncher(dataPath, db, logger, settings);
  const projects = new ProjectManager(logger, settings);
  const git = new GitManager(logger, settings.get('worktreesDir'));
  const terminal = options.terminal || new TerminalManager();
  const requireProject = id => { const p = db.getProject(id); if (!p) throw new Error('Proyecto no encontrado.'); return p; };
  const handlers = {
    'settings:getAll': () => settings.getAll(),
    'settings:update': async patch => {
      const before = settings.getAll();
      settings.update(patch);
      try { await options.settingsChanged?.(settings.getAll()); }
      catch (err) { settings.update(before); try { await options.settingsChanged?.(before); } catch {} throw err; }
    },
    'settings:detectTools': () => settings.detectTools(),
    'codex:getAccounts': () => { for (const a of db.getCodexAccounts()) codex.isAccountAuthenticated(a.id); return db.getCodexAccounts(); },
    'codex:getAccount': id => { const a = db.getCodexAccount(id); if (!a) throw new Error('Cuenta no encontrada.'); return a; },
    'codex:updateAccount': (id, patch) => db.updateCodexAccount(id, patch),
    'codex:addAccount': data => db.addCodexAccount(data),
    'codex:launch': (id, projectId) => codex.launchCodex(id, projectId),
    'codex:configure': id => codex.configureCodex(id),
    'codex:getProfilePath': id => codex.getProfilePath(id),
    'codex:isAuthenticated': id => codex.isAccountAuthenticated(id),
    'codex:logout': id => { terminal.killAccount(id); return codex.logoutCodex(id); },
    'codex:importExisting': id => codex.importDefaultCredentials(id),
    'codex:generateLauncher': (id, projectId) => codex.generateBatLauncher(id, projectId),
    'chatgpt:open': id => browser.openChatGPT(id),
    'emails:getAll': () => db.getEmails(),
    'emails:search': query => db.searchEmails(query),
    'emails:getByGroup': group => db.getEmailsByGroup(group),
    'emails:add': data => db.addEmail(data),
    'emails:update': (id, data) => db.updateEmail(id, data),
    'emails:delete': id => db.deleteEmail(id),
    'emails:import': data => db.importEmails(data),
    'emails:open': id => browser.openEmail(id),
    'emails:openMultiple': (ids, interval) => browser.openMultipleEmails(ids, interval, progress => events.emit('emails:openProgress', progress)),
    'emails:cancelBatch': () => browser.cancelBatch(),
    'emails:getProgress': () => browser.progress,
    'groups:getAll': () => db.getGroups(),
    'groups:add': name => db.addGroup(name),
    'groups:delete': id => db.deleteGroup(id),
    'projects:getAll': () => db.getProjects(),
    'projects:add': async data => db.addProject({ ...data, ...await projects.detectProject(data.path), name: data.name }),
    'projects:update': async (id, data) => db.updateProject(id, { ...data, ...(data.path ? await projects.detectProject(data.path) : {}), ...(data.name ? { name:data.name } : {}) }),
    'projects:delete': id => db.deleteProject(id),
    'projects:detect': value => projects.detectProject(value),
    'projects:openFolder': value => projects.openFolder(value),
    'projects:openTerminal': value => projects.openTerminal(value),
    'projects:openVSCode': value => projects.openVSCode(value),
    'projects:openGitHub': value => projects.openGitHub(value),
    'projects:selectDirectory': () => options.selectDirectory?.() ?? null,
    'worktrees:getForProject': id => git.listWorktrees(requireProject(id).path),
    'worktrees:create': (id, accounts) => {
      const p = requireProject(id);
      if (!Array.isArray(accounts) || accounts.some(a => !db.getCodexAccountBySlot(a.slot_number))) throw new Error('Ranura inválida.');
      return git.createWorktrees(p.path, p.name, accounts);
    },
    'worktrees:remove': async value => {
      let known = false;
      for (const p of db.getProjects().filter(p => p.has_git)) {
        try { if ((await git.listWorktrees(p.path)).some(w => path.resolve(w.path).toLowerCase() === path.resolve(value).toLowerCase())) { known = true; break; } } catch {}
      }
      if (!known) throw new Error('El worktree no pertenece a un proyecto registrado.');
      return git.removeWorktree(value);
    },
    'worktrees:getStatus': value => git.getWorktreeStatus(value),
    'worktrees:launch': async (projectId, value, accountId) => {
      const project = requireProject(projectId);
      const worktrees = await git.listWorktrees(project.path);
      const selected = worktrees.find(w => path.resolve(w.path).toLowerCase() === path.resolve(value).toLowerCase());
      if (!selected || selected.error) throw new Error('Worktree no disponible en este proyecto.');
      const ctx = codex.resolveContext(accountId, projectId);
      return codex.launchContext({ ...ctx, cwd:selected.path }, accountId, projectId);
    },
    'terminal:start': ({ accountId, projectId, mode = 'codex' }) => {
      const ctx = codex.resolveContext(accountId, projectId);
      const command = codex.command(mode);
      const id = [accountId, projectId || 'home', mode].join(':');
      const s = terminal.getOrCreateSession(id, { accountId, cwd:ctx.cwd, profilePath:ctx.profilePath, command });
      if (mode === 'codex') codex.recordLaunch(accountId, projectId);
      return { sessionId:s.id, pid:s.pid, isRunning:s.isRunning, cwd:s.cwd };
    },
    'terminal:input': (id, value) => terminal.sendInput(id, value),
    'terminal:output': (id, cursor, generation) => terminal.getOutput(id, cursor, generation),
    'terminal:resize': (id, cols, rows) => terminal.resize(id, cols, rows),
    'terminal:kill': id => terminal.kill(id),
    'terminal:clear': id => terminal.clearOutput(id),
    'process:checkRunning': (type, id) => [...terminal.sessions.values()].some(s => (s.accountId === id || s.id === id) && s.isRunning && ['codex', 'terminal'].includes(type)),
    'logs:getRecent': () => logger.getRecentLogs(100),
    'activity:log': (action, details) => db.logActivity(action, details),
    'dashboard:getStats': () => db.getDashboardStats(),
    'config:exportData': () => db.exportData(),
    'config:importData': data => db.importData(data),
    'config:export': () => options.exportConfig?.(db) ?? false,
    'config:import': () => options.importConfig?.(db) ?? false,
    'onboarding:isComplete': () => settings.get('onboardingComplete') === true,
    'onboarding:complete': () => settings.update({ onboardingComplete:true }),
    'system:openExternal': value => externalUrl(value),
    'launchers:openFolder': () => {
      const dir = options.resourcesPath ? path.join(options.resourcesPath, 'launchers') : path.resolve(__dirname, '../launchers');
      if (options.openPath) return options.openPath(dir);
      return projects.openFolder(dir);
    },
    ...(options.handlers || {}),
  };
  return {
    dataPath, db, logger, settings, codex, browser, projects, git, terminal, events, handlers,
    async invoke(method, args = []) {
      if (typeof method !== 'string' || !Object.hasOwn(handlers, method) || !Array.isArray(args) || args.length > 6) throw new Error('Operación no válida.');
      const result = await handlers[method](...args);
      if (!/^(terminal:|process:|logs:|dashboard:|.*:get|.*:is)/.test(method)) events.emit('changed');
      return result ?? null;
    },
    close() { browser.cancelBatch(); terminal.dispose(); db.close(); },
  };
}
module.exports = { createApplication };
