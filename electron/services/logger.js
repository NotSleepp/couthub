const path = require('path');
const fs = require('fs');

class Logger {
  constructor(dataPath) {
    this.logDir = path.join(dataPath, 'logs');
    fs.mkdirSync(this.logDir, { recursive: true });
    this.logFile = path.join(this.logDir, `accounthub-${new Date().toISOString().slice(0, 10)}.log`);
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.maxFiles = 10;
    this.rotateIfNeeded();
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
  }

  write(level, message, data) {
    this.rotateIfNeeded();
    // Filter out sensitive data
    const safeData = data ? this.sanitize(data) : undefined;
    const line = this.formatMessage(level, message, safeData);

    try {
      fs.appendFileSync(this.logFile, line, 'utf-8');
    } catch {
      // Silently fail - don't crash app over logging
    }
  }

  sanitize(data) {
    if (Array.isArray(data)) return data.map(value => this.sanitize(value));
    if (!data || typeof data !== 'object') return data;
    const sensitiveKeys = ['token', 'password', 'cookie', 'secret', 'key', 'credential', 'refresh_token'];
    const result = { ...data };

    for (const key of Object.keys(result)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        result[key] = '***REDACTED***';
      } else result[key] = this.sanitize(result[key]);
    }

    return result;
  }

  info(message, data) {
    this.write('INFO', message, data);
  }

  warn(message, data) {
    this.write('WARN', message, data);
  }

  error(message, data) {
    this.write('ERROR', message, data);
  }

  rotateIfNeeded() {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const stat = fs.statSync(this.logFile);
      if (stat.size > this.maxFileSize) {
        const rotatedName = this.logFile.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(this.logFile, rotatedName);
      }

      // Clean old logs
      const files = fs.readdirSync(this.logDir)
        .filter((f) => f.startsWith('accounthub-') && f.endsWith('.log'))
        .sort()
        .reverse();

      for (let i = this.maxFiles; i < files.length; i++) {
        fs.unlinkSync(path.join(this.logDir, files[i]));
      }
    } catch {
      // Ignore rotation errors
    }
  }

  getRecentLogs(count = 50) {
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      return lines.slice(-count);
    } catch {
      return [];
    }
  }
}

module.exports = { Logger };
