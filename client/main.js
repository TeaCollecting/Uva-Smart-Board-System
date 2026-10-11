const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');

// Only one copy may run. Launching it again just brings the window back.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win;
  let quitting = false;

  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.on('before-quit', () => { quitting = true; });

  app.whenReady().then(() => {
    app.setLoginItemSettings({ openAtLogin: true }); // start with Windows
    win = new BrowserWindow({
      width: 420, height: 420, autoHideMenuBar: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false }
    });
    win.loadFile('index.html');
    // Closing only hides the window, but never block a Windows shutdown/logoff.
    win.on('session-end', () => { quitting = true; });
    win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
  });

  ipcMain.handle('idle', () => powerMonitor.getSystemIdleTime()); // seconds since last touch/mouse/key
  ipcMain.on('hide', () => win && win.hide());
  app.on('window-all-closed', () => {});
}
