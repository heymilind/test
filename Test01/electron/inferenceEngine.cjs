const path = require('path');
const { app } = require('electron');
const fs = require('fs');
const os = require('os');

// Set up file logging
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'inference-engine.log');

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
}

// Log both to console and file
function log(message) {
  console.log(message);
  logToFile(message);
}

function logError(message, error) {
  const errorMsg = error ? `${message}: ${error.toString()}` : message;
  console.error(errorMsg);
  logToFile(`ERROR: ${errorMsg}`);
  if (error && error.stack) {
    logToFile(`STACK: ${error.stack}`);
  }
}

// Safely load the native module
let llmNative;
try {
  const nativeModulePath = path.join(__dirname, '../build/llm_inference.node');
  log(`Loading native module from: ${nativeModulePath}`);
  log(`Native module exists: ${fs.existsSync(nativeModulePath)}`);
  
  llmNative = require(nativeModulePath);
  log('Native module loaded successfully');
} catch (error) {
  logError('Failed to load native module', error);
  // Create a mock implementation that will return errors instead of crashing
  llmNative = {
    LLMInference: class MockLLMInference {
      loadModel() { 
        return false; 
      }
      isModelLoaded() { 
        return false; 
      }
      generate() { 
        return "ERROR: Native module not available"; 
      }
    }
  };
}

class InferenceEngine {
  constructor() {
    try {
      log('Creating LLMInference instance');
      this.llm = new llmNative.LLMInference();
      this.activeModel = null;
      this.modelSettings = null;
      log('LLMInference instance created successfully');
    } catch (error) {
      logError('Failed to create LLMInference instance', error);
      // Create a mock implementation to prevent crashes
      this.llm = {
        loadModel: () => false,
        isModelLoaded: () => false,
        generate: () => "ERROR: LLM instance not available"
      };
    }
  }
  
  async loadModel(modelId, modelPath, options = {}) {
    try {
      const gpuLayers = options.gpuLayers || 0;
      const contextSize = options.contextSize || 2048;
      
      log(`Loading model ${modelId} from ${modelPath}`);
      log(`GPU Layers: ${gpuLayers}, Context Size: ${contextSize}`);
      log(`File exists: ${fs.existsSync(modelPath)}`);
      
      // Check if the model file exists
      if (!fs.existsSync(modelPath)) {
        logError(`Model file not found at ${modelPath}`);
        return { success: false, error: 'Model file not found' };
      }
      
      // Check file size to ensure it's a valid model
      const stats = fs.statSync(modelPath);
      log(`File size: ${stats.size} bytes`);
      log(`Available memory: ${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`);
      log(`Total memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`);
      
      if (stats.size < 1000000) { // Arbitrary small size check
        logError(`Model file is too small, possibly corrupted: ${stats.size} bytes`);
        return { success: false, error: 'Model file may be corrupted (too small)' };
      }

      // Verify we have enough memory to load the model
      // A good rule of thumb is to have at least 2x the model file size in available RAM
      const requiredMemoryGB = stats.size / (1024 * 1024 * 1024) * 2;
      const availableMemoryGB = os.freemem() / (1024 * 1024 * 1024);
      
      if (availableMemoryGB < requiredMemoryGB) {
        log(`WARNING: Low memory available (${availableMemoryGB.toFixed(2)}GB) - model may require ${requiredMemoryGB.toFixed(2)}GB`);
      }
      
      // Store the model settings if provided
      if (options.modelSettings) {
        this.modelSettings = options.modelSettings;
        log(`Stored model settings: ${JSON.stringify(this.modelSettings)}`);
      } else {
        // Default settings
        this.modelSettings = {
          promptTemplate: "USER: {prompt}\nASSISTANT:",
          maxLength: contextSize,
          temperature: 0.7,
          topP: 0.95
        };
        log(`Using default model settings: ${JSON.stringify(this.modelSettings)}`);
      }
      
      let success = false;
      
      // First try with configured GPU/CPU settings
      try {
        log(`Attempting to load model with ${gpuLayers} GPU layers`);
        // Wrap native calls in try/catch to prevent crashes
        success = this.llm.loadModel(modelPath, gpuLayers, contextSize);
        log(`Model load result: ${success}`);
      } catch (err) {
        logError('Error in primary model loading attempt', err);
      }
      
      // If failed and we were using GPU, try CPU-only as fallback
      if (!success && gpuLayers > 0) {
        log('Initial load failed, trying CPU-only as fallback...');
        try {
          success = this.llm.loadModel(modelPath, 0, contextSize);
          log(`CPU fallback load result: ${success}`);
        } catch (fallbackErr) {
          logError('Error in CPU fallback attempt', fallbackErr);
        }
      }
      
      if (success) {
        this.activeModel = modelId;
        log(`Successfully loaded model: ${modelId}`);
        return { success: true, modelId };
      } else {
        logError('Native module failed to load model');
        return { 
          success: false, 
          error: 'Failed to load model. This could be due to insufficient memory, GPU compatibility issues, or an unsupported model format.\nCheck logs at: ' + logFile
        };
      }
    } catch (error) {
      logError('Unexpected error loading model', error);
      return { success: false, error: `Unexpected error: ${error.message}\nCheck logs at: ${logFile}` };
    }
  }
  
  isModelLoaded() {
    try {
      return this.llm.isModelLoaded();
    } catch (error) {
      logError('Error checking if model is loaded', error);
      return false;
    }
  }
  
  // Sanitize and clean up model output
  sanitizeModelOutput(text) {
    if (!text || typeof text !== 'string') {
      return "Error: No valid response generated";
    }

    try {
      // Remove non-printable characters except for whitespace
      let cleaned = text.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
      
      // Keep only Latin, common punctuation, and a few common scripts
      cleaned = cleaned.replace(/[^\x20-\x7E\u00A0-\u00FF\u2000-\u206F\u3000-\u303F]/g, ' ');
      
      // Replace multiple spaces with a single space
      cleaned = cleaned.replace(/\s+/g, ' ');
      
      // Remove markdown code block markers and common code syntax
      cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
      
      // Remove HTML tags
      cleaned = cleaned.replace(/<[^>]*>/g, '');
      
      // Remove URL fragments
      cleaned = cleaned.replace(/(https?:\/\/[^\s]+)/g, '[URL]');
      
      // Trim whitespace
      cleaned = cleaned.trim();
      
      if (!cleaned) {
        return "I apologize, but I couldn't generate a proper response. Please try again.";
      }
      
      return cleaned;
    } catch (error) {
      logError('Error sanitizing model output', error);
      return "I apologize, but I couldn't generate a proper response. Please try again.";
    }
  }
  
  async generateText(params) {
    if (!this.isModelLoaded()) {
      return { success: false, error: 'No model loaded' };
    }
    
    try {
      const { 
        prompt, 
        maxTokens = this.modelSettings?.maxLength || 512, 
        temperature = this.modelSettings?.temperature || 0.8, 
        topP = this.modelSettings?.topP || 0.95 
      } = params;
      
      if (!prompt) {
        return { success: false, error: 'Prompt is required' };
      }
      
      log(`Generating text with params: maxTokens=${maxTokens}, temp=${temperature}, topP=${topP}`);
      
      // Format prompt using the model-specific template
      let formattedPrompt;
      if (this.modelSettings && this.modelSettings.promptTemplate) {
        formattedPrompt = this.modelSettings.promptTemplate.replace('{prompt}', prompt.trim());
        log(`Using model-specific prompt template: ${this.modelSettings.promptTemplate}`);
      } else {
        // Default fallback template
        formattedPrompt = `USER: ${prompt.trim()}\nASSISTANT:`;
        log(`Using default prompt template`);
      }
      
      log(`Formatted prompt: ${formattedPrompt}`);
      
      let response;
      try {
        response = await this.llm.generate(formattedPrompt, maxTokens, temperature, topP);
      } catch (genError) {
        logError('Error in native generate call', genError);
        return { 
          success: false, 
          error: `Generation failed: ${genError.message}` 
        };
      }
      
      if (!response) {
        logError('Failed to generate response');
        return { success: false, error: 'Failed to generate response' };
      }
      
      // Log the raw response for debugging
      log(`Raw model response length: ${response.length} chars`);
      
      // Extract just the assistant's response (remove the prompt)
      let assistantResponse = response.substring(formattedPrompt.length).trim();
      
      // Sanitize the response to handle token decoding issues
      const cleanedResponse = this.sanitizeModelOutput(assistantResponse);
      
      log(`Cleaned response: ${cleanedResponse.substring(0, 100)}...`);
      
      return { 
        success: true, 
        fullText: response,
        response: cleanedResponse
      };
    } catch (error) {
      logError('Error generating text', error);
      return { success: false, error: error.message };
    }
  }

  // Add this new method to the InferenceEngine class
  testGenerate(input) {
    try {
      log(`Testing generation with input: ${input}`);
      if (!this.llm || typeof this.llm.testGenerate !== 'function') {
        log('Test method not available in native module');
        return { success: false, error: 'Test method not available' };
      }
      
      const response = this.llm.testGenerate(input);
      log(`Test response: ${response}`);
      
      return { 
        success: true, 
        response: response
      };
    } catch (error) {
      logError('Error in test generation', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new InferenceEngine();


