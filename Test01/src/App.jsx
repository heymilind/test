import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // State variables
  const [appVersion, setAppVersion] = useState('Unknown');
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [models, setModels] = useState([]);
  const [recommendedModels, setRecommendedModels] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [selectedModel, setSelectedModel] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Get app version
    const getVersion = async () => {
      if (window.electronAPI) {
        const version = await window.electronAPI.getAppVersion();
        setAppVersion(version);
      }
    };
    
    // Get hardware info
    const getHardwareInfo = async () => {
      if (window.electronAPI) {
        const info = await window.electronAPI.getHardwareInfo();
        setHardwareInfo(info);
      }
    };
    
    // Get available models
    const getModels = async () => {
      if (window.electronAPI?.models) {
        const availableModels = await window.electronAPI.models.getAvailable();
        console.log('Loaded models:', availableModels); // Debug log
        setModels(availableModels);
        
        // Get recommended models
        const recommended = await window.electronAPI.models.getRecommended();
        setRecommendedModels(recommended);
      }
    };
    
    // Load initial data
    getVersion();
    getHardwareInfo();
    getModels();
    
    // Set up download progress listener
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('models:downloadProgress', (data) => {
        setDownloadProgress(prev => ({
          ...prev,
          [data.id]: data.progress
        }));
      });
    }
  }, []);
  
  // Handle model download
  const handleDownloadModel = async (modelId) => {
    if (!window.electronAPI?.models) return;
    
    try {
      // Initialize progress
      setDownloadProgress(prev => ({
        ...prev,
        [modelId]: 0
      }));
      
      // Download model
      const result = await window.electronAPI.models.download(modelId);
      
      if (result.success) {
        // Refresh model list
        const availableModels = await window.electronAPI.models.getAvailable();
        setModels(availableModels);
        
        // Clear progress
        setDownloadProgress(prev => {
          const newProgress = {...prev};
          delete newProgress[modelId];
          return newProgress;
        });
      } else {
        alert(`Error downloading model: ${result.error}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download error: ${error.message}`);
    }
  };
  
  // Handle model deletion
  const handleDeleteModel = async (modelId) => {
    if (!window.electronAPI?.models) return;
    
    if (window.confirm('Are you sure you want to delete this model?')) {
      try {
        const result = await window.electronAPI.models.delete(modelId);
        
        if (result.success) {
          // If selected model was deleted, unselect it
          if (selectedModel === modelId) {
            setSelectedModel(null);
          }
          
          // Refresh model list
          const availableModels = await window.electronAPI.models.getAvailable();
          setModels(availableModels);
        } else {
          alert(`Error deleting model: ${result.error}`);
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert(`Delete error: ${error.message}`);
      }
    }
  };
  
  // Select a model
  const handleSelectModel = (modelId) => {
    console.log('Selecting model:', modelId); // Debug log
    setSelectedModel(modelId);
  };
  
  // Format size in GB
  const formatSize = (bytes) => {
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };
  
  // Handle sending a message
  const handleSendMessage = () => {
    if (!selectedModel || isGenerating || !inputText.trim()) return;
    
    // Add user message
    const userMessage = { role: 'user', content: inputText };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Clear input and show generating state
    setInputText('');
    setIsGenerating(true);
    
    // Simulate AI response for now (will integrate real inference later)
    setTimeout(() => {
      const modelName = models.find(m => m.id === selectedModel)?.name || 'AI';
      const aiMessage = { 
        role: 'assistant', 
        content: `This is a simulated response from ${modelName}. In the next step, we'll implement real inference with llama.cpp.` 
      };
      setChatMessages(prev => [...prev, aiMessage]);
      setIsGenerating(false);
    }, 1000);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold">Local AI</h1>
          <p className="text-sm text-gray-500">Run AI models locally</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {/* System Info Panel */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">System</h2>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              {hardwareInfo ? (
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">CPU:</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {hardwareInfo.cpu.model} ({hardwareInfo.cpu.cores} cores)
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Memory:</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {hardwareInfo.memory.free} GB free / {hardwareInfo.memory.total} GB total
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">GPU:</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {hardwareInfo.gpu.name}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Loading system information...</p>
              )}
            </div>
          </div>
          
          {/* Models Panel */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Models</h2>
            
            {recommendedModels.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Recommended for your system:</p>
                <div className="text-xs text-blue-500">
                  {recommendedModels[0].name}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {models.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-500">Loading models...</p>
                </div>
              ) : (
                models.map((model) => (
                  <div 
                    key={model.id}
                    className={`p-3 rounded-lg border ${
                      selectedModel === model.id 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                    } ${model.isDownloaded ? 'cursor-pointer' : ''}`}
                    onClick={(e) => {
                      console.log('Model clicked:', model.id, 'isDownloaded:', model.isDownloaded); // Debug log
                      model.isDownloaded && handleSelectModel(model.id);
                    }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-medium">{model.name}</h3>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                        {model.params}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-2">{model.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {formatSize(model.size)}
                      </span>
                      
                      {model.isDownloaded ? (
                        <button
                          className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModel(model.id);
                          }}
                        >
                          Delete
                        </button>
                      ) : downloadProgress[model.id] !== undefined ? (
                        <div className="flex items-center">
                          <span className="text-xs text-blue-500 mr-2">
                            {downloadProgress[model.id].toFixed(0)}%
                          </span>
                          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${downloadProgress[model.id]}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadModel(model.id);
                          }}
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="p-2 text-xs text-center text-gray-500 border-t border-gray-200 dark:border-gray-700">
          Version: {appVersion}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold">Chat</h2>
          {selectedModel && (
            <p className="text-sm text-gray-500">
              Using: {models.find(m => m.id === selectedModel)?.name}
            </p>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <h3 className="text-xl font-semibold mb-2">Welcome to Local AI</h3>
                <p className="text-gray-500 mb-4">
                  Your personal AI assistant that runs entirely on your computer.
                  No internet connection required!
                </p>
                <p className="text-sm text-gray-500">
                  {selectedModel 
                    ? "Type a message below to get started." 
                    : "Select a model from the sidebar to get started."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {chatMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white ml-auto' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {isGenerating && (
                <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-700 max-w-[80%]">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-150"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex space-x-2">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={selectedModel ? "Type a message..." : "Select a model first"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isGenerating && selectedModel && handleSendMessage()}
              disabled={!selectedModel || isGenerating}
            />
            <button
              className={`px-4 py-2 rounded-lg ${
                selectedModel && !isGenerating
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              onClick={handleSendMessage}
              disabled={!selectedModel || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;