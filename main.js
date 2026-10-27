const { app, BrowserWindow, ipcMain, screen, nativeTheme } = require('electron');
const path = require('path');

// includes a 14px transparent margin for the soft shadow
const W = 328;
const H = 432;
let win;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + workArea.width - W - 24,
    y: workArea.y + workArea.height - H - 24,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    // fully transparent so the page can draw its own organic outline + shadow
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Lockodoro',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());
}

ipcMain.on('win:minimize', () => win?.minimize());
ipcMain.on('win:close', () => win?.close());
ipcMain.handle('win:pin', () => {
  const next = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(next);
  return next;
});
ipcMain.on('win:progress', (_e, value) => win?.setProgressBar(value));

// mini mode: shrink/grow while keeping the bottom-right corner where it is
const MINI = { width: 252, height: 96 };
ipcMain.handle('win:compact', (_e, on) => {
  const b = win.getBounds();
  const size = on ? MINI : { width: W, height: H };
  win.setBounds({
    x: b.x + b.width - size.width,
    y: b.y + b.height - size.height,
    ...size,
  });
});

app.setAppUserModelId('com.lockodoro.app');
nativeTheme.themeSource = 'dark'; // keeps the acrylic tint dark
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
