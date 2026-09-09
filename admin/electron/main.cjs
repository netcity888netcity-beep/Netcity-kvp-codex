const { app, BrowserWindow, Menu, Tray, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const BACKEND_PORT = 18555;
const UI_PORT = 18556;
const LOOPBACK_HOST = '127.0.0.1';

let mainWindow = null;
let uiServer = null;
let backendProcess = null;
let tray = null;
let currentSurface = 'studio';

function argumentValue(prefix) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : '';
}

function surfaceFromArguments(argumentsList) {
  if (argumentsList.some((value) => value === '--surface=settings')) return 'settings';
  return argumentsList.some((value) => value === '--surface=ops') ? 'ops' : 'studio';
}

function safeSurface() {
  return surfaceFromArguments(process.argv);
}

function safeProjectRoot() {
  const requested = argumentValue('--project-root=') || process.env.KVP_PROJECT_ROOT || '';
  const developmentRoot = path.resolve(__dirname, '..', '..');
  const packagedRoot = process.resourcesPath;
  const candidate = requested ? path.resolve(requested) : (app.isPackaged ? packagedRoot : developmentRoot);
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : (app.isPackaged ? packagedRoot : developmentRoot);
}

function backendRoot(projectRoot) {
  return app.isPackaged ? process.resourcesPath : projectRoot;
}

function resourcePath(projectRoot, relativePath) {
  const projectFile = path.join(projectRoot, relativePath);
  if (fs.existsSync(projectFile)) return projectFile;
  return path.join(process.resourcesPath, relativePath);
}

function requestHealth() {
  return new Promise((resolve) => {
    const request = http.get({ host: LOOPBACK_HOST, port: BACKEND_PORT, path: '/api/health', timeout: 900 }, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => { request.destroy(); resolve(false); });
  });
}

function startBackend(projectRoot) {
  const backendScript = resourcePath(projectRoot, path.join('tools', 'kvp-ops-server.ps1'));
  if (!fs.existsSync(backendScript)) throw new Error(`KVP ops server was not found: ${backendScript}`);

  backendProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', backendScript,
    '-Port', String(BACKEND_PORT),
    '-ProjectRoot', backendRoot(projectRoot),
    '-NoConsole',
  ], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  backendProcess.once('exit', () => { backendProcess = null; });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }[extension] || 'application/octet-stream';
}

function proxyApi(request, response) {
  const headers = { ...request.headers, host: `${LOOPBACK_HOST}:${BACKEND_PORT}` };
  const upstream = http.request({
    host: LOOPBACK_HOST,
    port: BACKEND_PORT,
    path: request.url,
    method: request.method,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Local KVP gateway is unavailable.' }));
  });
  request.pipe(upstream);
}

function createUiServer(distRoot) {
  const root = path.resolve(distRoot);
  return http.createServer((request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()');
    if (request.url && request.url.startsWith('/api/')) {
      proxyApi(request, response);
      return;
    }

    let pathname = '/';
    try { pathname = decodeURIComponent(new URL(request.url || '/', `http://${LOOPBACK_HOST}`).pathname); } catch {
      response.writeHead(400); response.end('Bad request'); return;
    }
    const relative = pathname.replace(/^\/+/, '');
    const candidate = path.resolve(root, relative || 'index.html');
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    const filePath = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
    if (!fs.existsSync(filePath)) { response.writeHead(503); response.end('Admin UI build is missing.'); return; }
    response.setHeader('Content-Type', contentType(filePath));
    response.setHeader('Cache-Control', path.basename(filePath) === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
  });
}

function closeResources() {
  if (uiServer) { uiServer.close(); uiServer = null; }
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
  if (tray) { tray.destroy(); tray = null; }
}

function applicationUrl(surface) {
  return `http://${LOOPBACK_HOST}:${UI_PORT}/?workspace=1&surface=${surface}`;
}

async function navigateSurface(surface) {
  currentSurface = surface === 'ops' || surface === 'settings' ? surface : 'studio';
  if (!mainWindow) return;
  await mainWindow.loadURL(applicationUrl(currentSurface));
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  refreshMenus();
}

function workspaceMenuItems() {
  return [
    { label: 'Model Studio', type: 'radio', checked: currentSurface === 'studio', click: () => void navigateSurface('studio') },
    { label: 'Ops HUD', type: 'radio', checked: currentSurface === 'ops', click: () => void navigateSurface('ops') },
    { label: 'Настройки', type: 'radio', checked: currentSurface === 'settings', click: () => void navigateSurface('settings') },
  ];
}

function refreshMenus() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'NetCity KVP', submenu: [
      ...workspaceMenuItems(),
      { type: 'separator' },
      { role: 'reload', label: 'Обновить поверхность' },
      { type: 'separator' },
      { role: 'quit', label: 'Завершить работу' },
    ] },
    { label: 'Окно', submenu: [
      { role: 'minimize', label: 'Свернуть' },
      { role: 'togglefullscreen', label: 'Полный экран' },
    ] },
  ]));
  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть NetCity KVP', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      ...workspaceMenuItems(),
      { type: 'separator' },
      { role: 'quit', label: 'Выход' },
    ]));
  }
}

async function createTray() {
  if (tray) return;
  const icon = await app.getFileIcon(process.execPath, { size: 'small' });
  tray = new Tray(icon);
  tray.setToolTip('NetCity KVP');
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  refreshMenus();
}

async function createMainWindow() {
  const projectRoot = safeProjectRoot();
  const distRoot = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) throw new Error(`Admin UI build is missing: ${distRoot}`);

  // Keep the first-run window inside the active work area. A fixed 1500px
  // canvas is clipped on common 1280px operator displays and hides controls.
  const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.max(320, Math.min(1500, workAreaWidth - 24));
  const windowHeight = Math.max(500, Math.min(960, workAreaHeight - 24));

  if (!(await requestHealth())) {
    startBackend(projectRoot);
    for (let attempt = 0; attempt < 30 && !(await requestHealth()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!(await requestHealth())) throw new Error('KVP ops gateway did not become ready.');

  if (!uiServer) {
    uiServer = createUiServer(distRoot);
    await new Promise((resolve, reject) => {
      uiServer.once('error', reject);
      uiServer.listen(UI_PORT, LOOPBACK_HOST, resolve);
    });
  }

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: Math.min(980, windowWidth),
    minHeight: Math.min(700, windowHeight),
    center: true,
    backgroundColor: '#071012',
    title: 'NetCity KVP',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://${LOOPBACK_HOST}:${UI_PORT}/`)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  currentSurface = safeSurface();
  await mainWindow.loadURL(applicationUrl(currentSurface));
  await createTray();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock({ surface: safeSurface() });
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine, _workingDirectory, additionalData) => {
    const requested = additionalData?.surface === 'ops' || additionalData?.surface === 'settings'
      ? additionalData.surface
      : surfaceFromArguments(commandLine);
    void navigateSurface(requested);
  });
  app.whenReady().then(() => createMainWindow().catch((error) => {
    console.error(error);
    app.quit();
  }));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', closeResources);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow().catch((error) => console.error(error)); });
