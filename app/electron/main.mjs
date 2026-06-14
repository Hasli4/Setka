import { app, BrowserWindow } from 'electron';
import { startServer } from '../server.mjs';

let mainWindow;
let serverHandle;

async function createWindow() {
  serverHandle = await startServer({ allowFallback: true });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    title: 'Setka',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(serverHandle.url);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  serverHandle?.server.close();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
