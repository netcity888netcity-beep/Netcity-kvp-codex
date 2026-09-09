const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const adminRoot = path.join(repoRoot, 'admin');
const electronRoot = path.join(adminRoot, 'node_modules', 'electron', 'dist');
const releaseRoot = path.join(adminRoot, 'release');
const appRoot = path.join(releaseRoot, 'resources', 'app');
const resourcesRoot = path.join(releaseRoot, 'resources');
const outputExe = path.join(releaseRoot, 'NetCity-KVP-portable.exe');

function copy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

if (!fs.existsSync(path.join(adminRoot, 'dist', 'index.html'))) throw new Error('Admin UI build is missing. Run npm run build first.');
if (!fs.existsSync(path.join(electronRoot, 'electron.exe'))) throw new Error('Electron runtime is missing. Run npm install and electron install first.');

fs.rmSync(releaseRoot, { recursive: true, force: true });
fs.mkdirSync(appRoot, { recursive: true });
copy(path.join(adminRoot, 'dist'), path.join(appRoot, 'dist'));
copy(path.join(adminRoot, 'electron'), path.join(appRoot, 'electron'));
copy(path.join(adminRoot, 'package.json'), path.join(appRoot, 'package.json'));
copy(path.join(adminRoot, 'model-studio.json'), path.join(resourcesRoot, 'admin', 'model-studio.json'));
copy(path.join(repoRoot, 'tools', 'kvp-ops-server.ps1'), path.join(resourcesRoot, 'tools', 'kvp-ops-server.ps1'));
const auditScript = fs.existsSync(path.join(repoRoot, 'kvp-security-audit.ps1'))
  ? path.join(repoRoot, 'kvp-security-audit.ps1')
  : path.join(repoRoot, '..', 'kvp-security-audit.ps1');
if (!fs.existsSync(auditScript)) throw new Error('Security audit script is missing.');
copy(auditScript, path.join(resourcesRoot, 'kvp-security-audit.ps1'));
copy(path.join(electronRoot, 'electron.exe'), outputExe);

for (const entry of fs.readdirSync(electronRoot)) {
  if (entry === 'electron.exe') continue;
  const source = path.join(electronRoot, entry);
  const destination = path.join(releaseRoot, entry);
  copy(source, destination);
}

console.log(outputExe);
