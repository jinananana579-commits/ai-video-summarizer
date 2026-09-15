const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let nextProcess;

const port = 3000;
const url = `http://localhost:${port}/studio`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    title: 'MesaIT Studio'
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startNextJs() {
  // Determine the script to run based on environment
  const isDev = !app.isPackaged;
  const scriptPath = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
  
  // In production, we run 'next start', in dev we run 'next dev'
  const command = isDev ? 'dev' : 'start';
  
  nextProcess = spawn('node', [scriptPath, command, '-p', port.toString()], {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit'
  });

  nextProcess.on('error', (err) => {
    console.error('Failed to start Next.js process:', err);
  });
}

function checkServerReady(url, callback) {
  const req = http.get(url, (res) => {
    if (res.statusCode === 200 || res.statusCode === 404) {
      callback();
    } else {
      setTimeout(() => checkServerReady(url, callback), 1000);
    }
  });

  req.on('error', () => {
    setTimeout(() => checkServerReady(url, callback), 1000);
  });
}

app.whenReady().then(() => {
  startNextJs();
  
  // Wait for Next.js to start before opening the window
  console.log('Waiting for Next.js server to start...');
  checkServerReady(url, () => {
    console.log('Next.js server is ready. Opening window.');
    createWindow();
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});
