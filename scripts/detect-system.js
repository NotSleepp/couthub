const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== SYSTEM DIAGNOSTIC ===');

// Check git
try {
  console.log('git:', execSync('where.exe git').toString().trim().split('\n')[0]);
} catch (e) {
  console.log('git: NOT FOUND');
}

// Check where wt / powershell / cmd
try {
  console.log('wt:', execSync('where.exe wt').toString().trim().split('\n')[0]);
} catch (e) {
  console.log('wt: NOT IN PATH');
}

try {
  console.log('powershell:', execSync('where.exe powershell').toString().trim().split('\n')[0]);
} catch (e) {
  console.log('powershell: NOT IN PATH');
}

// Check VS Code / Cursor / editors
const checkPaths = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Cursor', 'Cursor.exe'),
  'C:\\Program Files\\Microsoft VS Code\\Code.exe',
  'C:\\Program Files\\Cursor\\Cursor.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
];

for (const cp of checkPaths) {
  if (fs.existsSync(cp)) {
    console.log('FOUND EDITOR:', cp);
  }
}

// Check codex commands
try {
  const res = execSync('where.exe codex').toString().trim();
  console.log('codex in PATH:', res);
} catch (e) {
  console.log('codex in PATH: NOT FOUND');
}

// Check if codex is in npm
try {
  const npmRoot = execSync('npm root -g').toString().trim();
  console.log('npm root -g:', npmRoot);
  const codexPkg = path.join(npmRoot, '@openai', 'codex');
  console.log('@openai/codex exists:', fs.existsSync(codexPkg));
} catch (e) {
  console.log('npm error:', e.message);
}
