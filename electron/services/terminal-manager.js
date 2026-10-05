const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { isolatedEnv, encodedCommand, directory } = require('./platform');

class TerminalManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.spawn = options.spawn || ((...args) => require('node-pty').spawn(...args));
    this.maxChunks = options.maxChunks || 2000;
  }
  getOrCreateSession(id, options) {
    const existing = this.sessions.get(id);
    if (existing?.isRunning) {
      if (existing.profilePath !== options.profilePath || existing.cwd !== options.cwd) throw new Error('La sesión pertenece a otra cuenta o proyecto.');
      return existing;
    }
    if (this.sessions.size >= 30) {
      for (const [key, session] of this.sessions) if (!session.isRunning) this.sessions.delete(key);
      if (this.sessions.size >= 30) throw new Error('Cerrá una terminal antes de abrir otra (máximo 30).');
    }
    directory(options.cwd);
    const args = ['-NoLogo', '-NoProfile', '-NoExit'];
    if (options.command) args.push('-EncodedCommand', encodedCommand(options.command));
    const proc = this.spawn('powershell.exe', args, { name: 'xterm-256color', cols: 100, rows: 28, cwd: options.cwd, env: isolatedEnv(options.profilePath), useConpty: true, useConptyDll: true });
    const session = { id, generation: randomUUID(), accountId: options.accountId, profilePath: options.profilePath, cwd: options.cwd, proc, pid: proc.pid, isRunning: true, output: [], nextIndex: 0, bytes: 0, exitCode: null };
    this.sessions.set(id, session);
    proc.onData(data => this.append(session, data));
    proc.onExit(({ exitCode }) => {
      session.isRunning = false; session.exitCode = exitCode;
      this.append(session, '\r\n[Sesión finalizada: ' + exitCode + ']\r\n');
      this.emit('exit', session);
    });
    return session;
  }
  append(session, text) {
    session.output.push({ id: session.nextIndex++, text });
    session.bytes += text.length;
    while (session.output.length > this.maxChunks || (session.bytes > 2 * 1024 * 1024 && session.output.length > 1)) session.bytes -= session.output.shift().text.length;
  }
  active(id) {
    const session = this.sessions.get(id);
    if (!session?.isRunning) throw new Error('La terminal no está activa. Volvé a abrirla.');
    return session;
  }
  sendInput(id, input) {
    if (typeof input !== 'string' || input.length > 65536) throw new Error('Entrada de terminal inválida.');
    this.active(id).proc.write(input);
  }
  resize(id, cols, rows) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || cols > 500 || rows > 250) throw new Error('Tamaño de terminal inválido.');
    this.active(id).proc.resize(cols, rows);
  }
  getOutput(id, cursor = 0, generation) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Sesión no encontrada.');
    if (!Number.isInteger(cursor) || cursor < 0) throw new Error('Cursor inválido.');
    const reset = !!generation && generation !== s.generation;
    if (reset) cursor = 0;
    const truncated = !!s.output.length && cursor < s.output[0].id;
    return { lines: s.output.filter(line => line.id >= cursor), nextIndex: s.nextIndex, generation: s.generation, reset, truncated, isRunning: s.isRunning, pid: s.pid, exitCode: s.exitCode };
  }
  kill(id) {
    const s = this.sessions.get(id);
    if (s?.isRunning) { s.proc.kill(); s.isRunning = false; }
  }
  killAccount(accountId) { for (const s of this.sessions.values()) if (s.accountId === accountId) this.kill(s.id); }
  clearOutput(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Sesión no encontrada.');
    s.output = []; s.bytes = 0;
    return { nextIndex: s.nextIndex };
  }
  dispose() { for (const id of this.sessions.keys()) this.kill(id); this.sessions.clear(); }
}
module.exports = { TerminalManager };
