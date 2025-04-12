const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function getHardwareInfo() {
  // Get CPU info
  const cpuInfo = os.cpus()[0];
  const totalCores = os.cpus().length;
  
  // Get memory info (in GB)
// Get memory info (in GB) with 1 decimal place precision
const totalMemory = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
const freeMemory = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
  

  // Get GPU info - this is more complex and platform-specific
  let gpuInfo = { available: false, name: 'None detected' };
  
  try {
    if (process.platform === 'darwin') {
      // macOS
      const { stdout } = await execAsync('system_profiler SPDisplaysDataType');
      const isAppleSilicon = os.cpus()[0].model.includes('Apple');
      
      gpuInfo = {
        available: true,
        name: isAppleSilicon ? 'Apple Silicon' : 'Intel GPU',
        isAppleSilicon,
        supportsMetal: true
      };
      
    } else if (process.platform === 'win32') {
      // Windows
      const { stdout } = await execAsync('wmic path win32_VideoController get name');
      const gpuLines = stdout.trim().split('\n').slice(1);
      
      if (gpuLines.length > 0) {
        const name = gpuLines[0].trim();
        gpuInfo = {
          available: true,
          name: name,
          isNvidia: name.toLowerCase().includes('nvidia'),
          isAMD: name.toLowerCase().includes('amd'),
        };
      }
      
    } else if (process.platform === 'linux') {
      // Linux
      const { stdout } = await execAsync('lspci | grep -i vga');
      if (stdout) {
        const name = stdout.trim();
        gpuInfo = {
          available: true,
          name: name,
          isNvidia: name.toLowerCase().includes('nvidia'),
          isAMD: name.toLowerCase().includes('amd'),
        };
      }
    }
  } catch (error) {
    console.error('Error detecting GPU:', error);
  }
  
  return {
    cpu: {
      model: cpuInfo.model,
      cores: totalCores,
      speed: cpuInfo.speed
    },
    memory: {
      total: totalMemory,
      free: freeMemory
    },
    gpu: gpuInfo,
    platform: process.platform
  };
}

module.exports = {
  getHardwareInfo
};