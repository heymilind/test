const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { getHardwareInfo } = require('./systemInfo.cjs');
const modelManager = require('./modelManager.cjs');
const inferenceEngine = require('./inferenceEngine.cjs');

// Set up error logging
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'main-process.log');

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
}

// Catch unhandled exceptions
process.on('uncaughtException', (error) => {
  const errorMessage = `Uncaught Exception: ${error.message}`;
  console.error(errorMessage);
  logToFile(`ERROR: ${errorMessage}`);
  if (error.stack) {
    logToFile(`STACK: ${error.stack}`);
  }
  
  // Show error dialog if window exists
  if (mainWindow) {
    dialog.showErrorBox('Application Error', 
      `An unexpected error occurred: ${error.message}.\n\nCheck the log file for details: ${logFile}`);
  }
  
  // Don't quit the app on errors
  // app.quit();
});

// Set environment variables for model loading options
// Can be overridden by user if needed
process.env.FORCE_CPU = process.env.FORCE_CPU || 'false';  // Set to 'true' to force CPU-only mode
process.env.CONTEXT_SIZE = process.env.CONTEXT_SIZE || '2048';  // Default context size

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
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      sandbox: true
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        ]
      }
    });
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

ipcMain.handle('models:verify', async (event, modelId) => {
  return await modelManager.verifyModel(modelId);
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

// Add these IPC handlers
ipcMain.handle('inference:loadModel', async (event, modelId) => {
  try {
    logToFile(`Received request to load model: ${modelId}`);
    
    // Get hardware info to decide on GPU usage
    const hardwareInfo = await getHardwareInfo();
    
    // Get model path
    const models = await modelManager.getAvailableModels();
    const model = models.find(m => m.id === modelId);
    
    if (!model) {
      const error = `Model ${modelId} not found`;
      logToFile(`ERROR: ${error}`);
      return { success: false, error: error };
    }
    
    if (!model.isDownloaded) {
      const error = `Model ${modelId} is not downloaded`;
      logToFile(`ERROR: ${error}`);
      return { success: false, error: error };
    }
    
    // Determine optimal GPU layers based on hardware
    let gpuLayers = 0;
    
    // Log detailed hardware information
    logToFile(`Hardware info: ${JSON.stringify(hardwareInfo, null, 2)}`);
    
    if (hardwareInfo.gpu.available) {
      if (hardwareInfo.gpu.isNvidia) {
        logToFile('Using NVIDIA GPU layers');
        gpuLayers = 99; // Use all layers on NVIDIA
      } else if (hardwareInfo.gpu.isAppleSilicon) {
        logToFile('Using Apple Silicon Metal (1 layer)');
        gpuLayers = 1; // Use metal on Apple Silicon
      } else {
        logToFile('Using CPU only (GPU not supported)');
      }
    } else {
      logToFile('No GPU available, using CPU only');
    }
    
    // Log memory information
    logToFile(`Available memory: ${hardwareInfo.memory.free}GB / ${hardwareInfo.memory.total}GB total`);
    
    // Try with CPU only first if issues persist
    if (process.env.FORCE_CPU === 'true') {
      logToFile('FORCE_CPU is set, disabling GPU acceleration');
      gpuLayers = 0;
    }
    
    // Get the model path
    const modelPath = modelManager.getModelPath(modelId);
    logToFile(`Full model path: ${modelPath}`);
    
    // Verify model file
    const verifyResult = await modelManager.verifyModel(modelId);
    if (!verifyResult.success) {
      const error = `Model verification failed: ${verifyResult.error}`;
      logToFile(`ERROR: ${error}`);
      return { success: false, error: error };
    }
    
    logToFile(`Model verified successfully, size: ${verifyResult.size} bytes`);
    
    try {
      // Try to load the model - this might crash the process without proper error handling
      const result = await inferenceEngine.loadModel(modelId, modelPath, {
        gpuLayers,
        contextSize: parseInt(process.env.CONTEXT_SIZE, 10),
        modelSettings: model.compatibility || {
          promptTemplate: "USER: {prompt}\nASSISTANT:",
          maxLength: parseInt(process.env.CONTEXT_SIZE, 10),
          temperature: 0.7,
          topP: 0.95
        }
      });
      
      logToFile(`Model load result: ${JSON.stringify(result)}`);
      return result;
    } catch (loadError) {
      const error = `Error during model loading: ${loadError.message}`;
      logToFile(`ERROR: ${error}`);
      if (loadError.stack) {
        logToFile(`STACK: ${loadError.stack}`);
      }
      
      return { 
        success: false, 
        error: `Failed to load model: ${loadError.message}. Check logs at: ${logFile}`
      };
    }
  } catch (error) {
    const errorMsg = `Unexpected error in inference:loadModel handler: ${error.message}`;
    logToFile(`ERROR: ${errorMsg}`);
    if (error.stack) {
      logToFile(`STACK: ${error.stack}`);
    }
    
    return { 
      success: false, 
      error: `Unexpected error: ${error.message}. Check logs at: ${logFile}`
    };
  }
});

ipcMain.handle('inference:generate', async (event, params) => {
  try {
    return await inferenceEngine.generateText(params);
  } catch (error) {
    console.error('Error generating text:', error);
    return { success: false, error: error.message };
  }
});

// Add a new test handler
ipcMain.handle('inference:test', async (event, input) => {
  try {
    logToFile(`Testing inference with input: ${input}`);
    return inferenceEngine.testGenerate(input);
  } catch (error) {
    logToFile(`ERROR in test handler: ${error.message}`);
    console.error('Error in test generation:', error);
    return { success: false, error: error.message };
  }
});