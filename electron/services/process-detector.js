const { execSync } = require('child_process');

class ProcessDetector {
  constructor() {
    this._cache = new Map();
    this._cacheTimeout = 5000; // 5 seconds cache
  }

  async isRunning(type, identifier) {
    const key = `${type}:${identifier}`;
    const cached = this._cache.get(key);
    if (cached && Date.now() - cached.time < this._cacheTimeout) {
      return cached.value;
    }

    let running = false;
    try {
      const processes = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8', timeout: 5000 });

      switch (type) {
        case 'browser': {
          running = processes.includes('chrome.exe') || processes.includes('msedge.exe');
          break;
        }
        case 'codex': {
          running = processes.includes('codex');
          break;
        }
        case 'terminal': {
          running = processes.includes('WindowsTerminal.exe') || processes.includes('powershell.exe');
          break;
        }
        default:
          running = false;
      }
    } catch {
      running = false;
    }

    this._cache.set(key, { value: running, time: Date.now() });
    return running;
  }
}

module.exports = { ProcessDetector };
