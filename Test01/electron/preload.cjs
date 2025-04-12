const { contextBridge, ipcRenderer } = require('electron');

// Change "api" to "electronAPI" to avoid conflicts
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // System info
  getHardwareInfo: () => ipcRenderer.invoke('system:getHardwareInfo'),
  
  // Model management
  models: {
    getAvailable: () => ipcRenderer.invoke('models:getAvailable'),
    download: (modelId) => ipcRenderer.invoke('models:download', modelId),
    delete: (modelId) => ipcRenderer.invoke('models:delete', modelId),
    getRecommended: () => ipcRenderer.invoke('models:recommend')
  },
  
  // Events
  on: (channel, callback) => {
    const validChannels = ['models:downloadProgress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data));
    }
  },
  
  // Utilities
  platform: process.platform
});