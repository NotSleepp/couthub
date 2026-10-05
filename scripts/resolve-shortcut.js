const { execSync } = require('child_process');

try {
  const p = process.env.APPDATA + '\\Microsoft\\Windows\\Start Menu\\Programs\\Antigravity IDE.lnk';
  const out = execSync(`powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut('${p}'); $s.TargetPath"`).toString().trim();
  console.log('Antigravity Target:', out);
} catch (e) {
  console.error('Err:', e.message);
}
