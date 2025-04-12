const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const https = require('https');
const http = require('http');
const url = require('url');

// Utility function to fetch URLs with redirect support
async function fetchUrlWithRedirects(urlString, options = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    // Parse the URL to determine http or https
    const parsedUrl = url.parse(urlString);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    // Default headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': '*/*',
      ...(options.headers || {})
    };

    // Make the request
    const req = protocol.get({
      ...parsedUrl,
      headers,
      timeout: options.timeout || 30000
    }, (response) => {
      // Check if it's a redirect (status codes 301, 302, 303, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }

        console.log(`Following redirect: ${response.statusCode} -> ${response.headers.location}`);
        
        // Follow the redirect with one less maxRedirects
        fetchUrlWithRedirects(response.headers.location, options, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      // If we got here, we have a non-redirect response
      resolve(response);
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.timeout) {
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    }
  });
}

class ModelManager {
  constructor() {
    // Create models directory in user data folder
    this.modelsDir = path.join(app.getPath('userData'), 'models');
    console.log('Models directory path:', this.modelsDir);
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      console.log('Created models directory');
    } else {
      console.log('Models directory already exists');
    }
    
    // Sample model data (just to get started)
    this.sampleModels = [
      {
        id: 'tinyllama-1.1b-chat-v1.0',
        name: 'TinyLlama 1.1B Chat',
        description: 'Lightweight chat model, good for testing',
        size: 700000000, // ~700MB
        url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf?download=true',
        alternativeUrls: [
          'https://huggingface.co/api/models/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/tree/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
          'https://huggingface.co/api/models/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
        ],
        params: '1.1B',
        quantization: 'Q4_K_M',
        isDownloaded: false,
        compatibility: {
          promptTemplate: "USER: {prompt}\nASSISTANT:",
          maxLength: 2048,
          temperature: 0.7,
          topP: 0.95
        }
      },
      {
        id: 'phi-2',
        name: 'Phi-2',
        description: 'Microsoft\'s 2.7B parameter model',
        size: 1600000000, // ~1.6GB
        url: 'https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf?download=true',
        alternativeUrls: [
          'https://huggingface.co/api/models/TheBloke/phi-2-GGUF/tree/main/phi-2.Q4_K_M.gguf',
          'https://huggingface.co/api/models/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf'
        ],
        params: '2.7B',
        quantization: 'Q4_K_M',
        isDownloaded: false,
        compatibility: {
          promptTemplate: "<|user|>\n{prompt}\n<|assistant|>\n",
          maxLength: 2048,
          temperature: 0.7,
          topP: 0.9
        }
      },
      {
        id: 'tinyllama-compat',
        name: 'TinyLlama Compatibility Test',
        description: 'Smaller quantized version for compatibility testing',
        size: 420000000, // ~420MB
        url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q2_K.gguf?download=true',
        alternativeUrls: [
          'https://huggingface.co/api/models/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/tree/main/tinyllama-1.1b-chat-v1.0.Q2_K.gguf',
          'https://huggingface.co/api/models/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q2_K.gguf'
        ],
        params: '1.1B',
        quantization: 'Q2_K',
        isDownloaded: false,
        compatibility: {
          promptTemplate: "USER: {prompt}\nASSISTANT:",
          maxLength: 2048,
          temperature: 0.7,
          topP: 0.95
        }
      },
      {
        id: 'orca-mini',
        name: 'Orca Mini',
        description: 'Smaller model based on Llama (3B)',
        size: 1900000000, // ~1.9GB
        url: 'https://huggingface.co/TheBloke/orca_mini_3B-GGUF/resolve/main/orca-mini-3b.q4_0.gguf?download=true',
        alternativeUrls: [
          'https://huggingface.co/api/models/TheBloke/orca_mini_3B-GGUF/resolve/main/orca-mini-3b.q4_0.gguf'
        ],
        params: '3B',
        quantization: 'Q4_0',
        isDownloaded: false,
        compatibility: {
          promptTemplate: "### Human: {prompt}\n### Assistant:",
          maxLength: 2048,
          temperature: 0.7,
          topP: 0.9
        }
      },
      {
        id: 'mistral-7b-instruct',
        name: 'Mistral 7B Instruct v0.1',
        description: 'Highly efficient 7B instruction-tuned model',
        size: 4500000000, // ~4.5GB
        url: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf?download=true',
        alternativeUrls: [
          'https://huggingface.co/api/models/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf'
        ],
        params: '7B',
        quantization: 'Q4_K_M',
        isDownloaded: false,
        compatibility: {
          promptTemplate: "<s>[INST] {prompt} [/INST]",
          maxLength: 4096,
          temperature: 0.7,
          topP: 0.9
        }
      }
    ];
  }
  
  // Get model path
  getModelPath(modelId) {
    const model = this.sampleModels.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    return path.join(this.modelsDir, `${modelId}.gguf`);
  }
  
  // Get all available models
  async getAvailableModels() {
    // Update isDownloaded status based on file existence
    for (const model of this.sampleModels) {
      try {
        const modelPath = this.getModelPath(model.id);
        
        // Check if file exists and has a valid size
        if (fs.existsSync(modelPath)) {
          const stats = fs.statSync(modelPath);
          const isValidSize = stats.size > 1000000; // Minimum size check (1MB)
          
          if (isValidSize) {
            model.isDownloaded = true;
            console.log(`Model ${model.id} verified: ${stats.size} bytes`);
          } else {
            // File exists but is too small (corrupted)
            model.isDownloaded = false;
            console.log(`Model ${model.id} exists but is too small: ${stats.size} bytes. Marking as not downloaded.`);
            
            // Rename corrupted file for debugging
            try {
              fs.renameSync(modelPath, `${modelPath}.corrupted`);
              console.log(`Renamed corrupted model file to ${modelPath}.corrupted`);
            } catch (renameErr) {
              console.error(`Failed to rename corrupted model: ${renameErr.message}`);
            }
          }
        } else {
          model.isDownloaded = false;
          console.log(`Model ${model.id} not found at ${modelPath}`);
        }
      } catch (error) {
        console.error(`Error checking model ${model.id}:`, error);
        model.isDownloaded = false;
      }
    }
    return this.sampleModels;
  }
  
  // Try downloading from alternative URLs if primary URL fails
  async tryDownloadWithFallbacks(model, modelPath, progressCallback) {
    let urls = [model.url, ...(model.alternativeUrls || [])];
    let lastError = null;
    
    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i];
      console.log(`Attempting download from URL ${i+1}/${urls.length}: ${currentUrl}`);
      
      try {
        const tmpPath = `${modelPath}.tmp`;
        
        // Clear any existing tmp files
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
        
        const modelFile = fs.createWriteStream(tmpPath);
        
        // Use our redirect-following utility
        const response = await fetchUrlWithRedirects(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
            'Accept': '*/*'
          },
          timeout: 30000
        });
        
        // Check for successful response
        if (response.statusCode !== 200) {
          modelFile.end();
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
          }
          throw new Error(`HTTP error: ${response.statusCode}`);
        }
        
        // Check file size from headers
        const totalSize = parseInt(response.headers['content-length'], 10);
        if (totalSize && totalSize < 1000000) {
          modelFile.end();
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
          }
          throw new Error(`Invalid file size in headers: ${totalSize} bytes`);
        }
        
        console.log(`Downloading from ${response.req?.host || 'unknown'} - expected size: ${totalSize || 'unknown'} bytes`);
        
        // Download the file
        let downloadedSize = 0;
        
        response.on('data', chunk => {
          downloadedSize += chunk.length;
          if (totalSize) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            if (progressCallback) {
              progressCallback(model.id, progress);
            }
          }
          modelFile.write(chunk);
        });
        
        // Wait for download to complete
        await new Promise((resolve, reject) => {
          response.on('end', () => {
            modelFile.end();
            
            // Verify file size
            try {
              const stats = fs.statSync(tmpPath);
              if (stats.size < 1000000) {
                fs.unlinkSync(tmpPath);
                reject(new Error(`Downloaded file too small: ${stats.size} bytes`));
                return;
              }
              
              // Success - move file to final location
              fs.renameSync(tmpPath, modelPath);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
          
          response.on('error', error => {
            modelFile.end();
            if (fs.existsSync(tmpPath)) {
              fs.unlinkSync(tmpPath);
            }
            reject(error);
          });
          
          modelFile.on('error', error => {
            if (fs.existsSync(tmpPath)) {
              fs.unlinkSync(tmpPath);
            }
            reject(error);
          });
        });
        
        // If we get here, download was successful
        console.log(`Successfully downloaded model ${model.id} from ${currentUrl}`);
        return true;
        
      } catch (error) {
        lastError = error;
        console.error(`Download failed from ${currentUrl}:`, error.message);
      }
    }
    
    // If we get here, all URLs failed
    throw new Error(`All download attempts failed. Last error: ${lastError.message}`);
  }
  
  // Download model
  async downloadModel(modelId, progressCallback) {
    const model = this.sampleModels.find(m => m.id === modelId);
    if (!model) {
      return { success: false, error: `Model ${modelId} not found` };
    }

    const modelPath = this.getModelPath(modelId);
    
    try {
      // Try all URLs until one works
      await this.tryDownloadWithFallbacks(model, modelPath, progressCallback);
      
      // Success!
      model.isDownloaded = true;
      return { success: true, model };
    } catch (error) {
      console.error('All download attempts failed:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  // Delete model
  async deleteModel(modelId) {
    const model = this.sampleModels.find(m => m.id === modelId);
    if (!model) {
      return { success: false, error: `Model ${modelId} not found` };
    }

    const modelPath = this.getModelPath(modelId);
    try {
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
      }
      model.isDownloaded = false;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Recommend models based on hardware
  recommendModels(hardwareInfo) {
    return this.sampleModels.sort((a, b) => a.size - b.size);
  }
  
  // Verify a single model
  async verifyModel(modelId) {
    try {
      const model = this.sampleModels.find(m => m.id === modelId);
      if (!model) {
        return { success: false, error: `Model ${modelId} not found` };
      }
      
      const modelPath = this.getModelPath(modelId);
      
      if (!fs.existsSync(modelPath)) {
        model.isDownloaded = false;
        return { success: false, error: 'Model file not found' };
      }
      
      const stats = fs.statSync(modelPath);
      
      // Min size 1MB, should be much larger for real models
      if (stats.size < 1000000) {
        model.isDownloaded = false;
        return { 
          success: false, 
          error: `Model file is too small (${stats.size} bytes)`, 
          size: stats.size 
        };
      }
      
      model.isDownloaded = true;
      return { success: true, size: stats.size };
      
    } catch (error) {
      console.error(`Error verifying model ${modelId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ModelManager();