const fs = require('fs');
const path = require('path');
const { Database } = require('../electron/database');
const { Logger } = require('../electron/services/logger');
const { CodexManager } = require('../electron/services/codex-manager');

const dataPath = path.join(process.env.APPDATA || process.env.USERPROFILE || 'C:\\', 'AccountHub');
const logger = new Logger(dataPath);
const db = new Database(dataPath, logger);
const codexManager = new CodexManager(dataPath, db, logger);

const projectLaunchersDir = path.join(__dirname, '..', 'launchers');
fs.mkdirSync(projectLaunchersDir, { recursive: true });

const accounts = db.getCodexAccounts();
console.log(`Generating launchers for ${accounts.length} slots in: ${projectLaunchersDir}`);

for (const acc of accounts) {
  const profilePath = codexManager.getProfilePath(acc.id);
  const safeLabel = acc.label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const batPath = path.join(projectLaunchersDir, `Slot-${String(acc.slot_number).padStart(2, '0')}-${safeLabel}.bat`);

  const content = `@echo off
chcp 65001 >nul
title CODEX ${String(acc.slot_number).padStart(2, '0')} — ${acc.label}
echo =================================================================
echo   ACCOUNT HUB — OpenAI Codex (Slot #${acc.slot_number} — ${acc.label})
echo   CODEX_HOME: ${profilePath}
echo =================================================================
echo.
powershell.exe -NoExit -ExecutionPolicy Bypass -Command "$env:CODEX_HOME='${profilePath}'; if (Get-Command codex -ErrorAction SilentlyContinue) { codex } else { npx -y @openai/codex }"
`;

  fs.writeFileSync(batPath, content, 'utf-8');
  console.log(`Created: ${path.basename(batPath)}`);
}

console.log('All 6 desktop launchers generated successfully.');
