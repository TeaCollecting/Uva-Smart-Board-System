const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');

// Only one copy may run. Launching it again just brings the window back.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const startHidden = process.argv.includes('--hidden'); // set by the Windows auto-start entry
  let win;
  let quitting = false;

  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.on('before-quit', () => { quitting = true; });

  app.whenReady().then(() => {
    // Start automatically (hidden) every time the board's Windows account logs in.
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });

    win = new BrowserWindow({
      width: 440, height: 620, show: false, autoHideMenuBar: true,
      icon: require('path').join(__dirname, 'icon.ico'),
      webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false }
    });
    win.loadFile('index.html');
    // Opened by hand: show it. Opened by auto-start: stay hidden unless the app needs attention.
    win.once('ready-to-show', () => { if (!startHidden) win.show(); });
    // Closing only hides the window, but never block a Windows shutdown/logoff.
    win.on('session-end', () => { quitting = true; });
    win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
  });

  ipcMain.handle('idle', () => powerMonitor.getSystemIdleTime()); // seconds since last touch/mouse/key
  ipcMain.on('hide', () => win && win.hide());
  ipcMain.on('show', () => { if (win) { win.show(); win.focus(); } });
  app.on('window-all-closed', () => {});
}
