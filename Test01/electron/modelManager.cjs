const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ModelManager {
  constructor() {
    // Create models directory in user data folder
    this.modelsDir = path.join(app.getPath('userData'), 'models');
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    
    // Sample model data (just to get started)
    this.sampleModels = [
      {
        id: 'tinyllama-1.1b-chat-v1.0',
        name: 'TinyLlama 1.1B Chat',
        description: 'Lightweight chat model, good for testing',
        size: 700000000, // ~700MB
        url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        params: '1.1B',
        quantization: 'Q4_K_M',
        isDownloaded: true
      },
      {
        id: 'phi-2',
        name: 'Phi-2',
        description: 'Microsoft\'s 2.7B parameter model',
        size: 1600000000, // ~1.6GB
        url: 'https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf',
        params: '2.7B',
        quantization: 'Q4_K_M',
        isDownloaded: true
      }
    ];
  }
  
  // Get all available models
  async getAvailableModels() {
    return this.sampleModels;
  }
  
  // Simulate model download (for testing)
  async downloadModel(modelId, progressCallback) {
    const model = this.sampleModels.find(m => m.id === modelId);
    if (!model) {
      return { success: false, error: `Model ${modelId} not found` };
    }
    
    // Simulate download progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progressCallback) {
        progressCallback(modelId, progress);
      }
      if (progress >= 100) clearInterval(interval);
    }, 500);
    
    // Simulate download completion
    return new Promise(resolve => {
      setTimeout(() => {
        model.isDownloaded = true;
        resolve({ success: true, model });
      }, 5000);
    });
  }
  
  // Simulate model deletion
  async deleteModel(modelId) {
    const model = this.sampleModels.find(m => m.id === modelId);
    if (!model) {
      return { success: false, error: `Model ${modelId} not found` };
    }
    
    model.isDownloaded = false;
    return { success: true };
  }
  
  // Recommend models based on hardware
  recommendModels(hardwareInfo) {
    return this.sampleModels.sort((a, b) => a.size - b.size);
  }
}

module.exports = new ModelManager();