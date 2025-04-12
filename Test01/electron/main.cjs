const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { getHardwareInfo } = require('./systeminfo.cjs');
const modelManager = require('./modelManager.cjs');

// Handle creating/removing shortcuts on Windows
if (require('electron-squirrel-startup')) app.quit();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    // Load from dev server in development
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Load from file in production
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when content is ready to avoid blank window
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.center();
    
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  // Log any load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorDescription);
  });
}

// Hardware info IPC handler
ipcMain.handle('system:getHardwareInfo', async () => {
  return await getHardwareInfo();
});

// Model management IPC handlers
ipcMain.handle('models:getAvailable', async () => {
  return await modelManager.getAvailableModels();
});

ipcMain.handle('models:download', async (event, modelId) => {
  const progressCallback = (id, progress) => {
    event.sender.send('models:downloadProgress', { id, progress });
  };
  
  return await modelManager.downloadModel(modelId, progressCallback);
});

ipcMain.handle('models:delete', async (event, modelId) => {
  return await modelManager.deleteModel(modelId);
});

ipcMain.handle('models:recommend', async () => {
  const hardwareInfo = await getHardwareInfo();
  return modelManager.recommendModels(hardwareInfo);
});

// Basic app info handler
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});