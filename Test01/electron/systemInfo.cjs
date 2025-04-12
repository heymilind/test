const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function getHardwareInfo() {
  try {
    const si = require('systeminformation');
    
    // Get CPU information
    const cpuData = await si.cpu();
    const cpu = {
      model: cpuData.manufacturer + ' ' + cpuData.brand,
      cores: cpuData.cores,
      physicalCores: cpuData.physicalCores,
      speed: cpuData.speed
    };
    
    // Get memory information
    const memData = await si.mem();
    const memory = {
      total: Math.round(memData.total / 1024 / 1024 / 1024), // Convert to GB
      free: Math.round(memData.available / 1024 / 1024 / 1024),
      used: Math.round((memData.total - memData.available) / 1024 / 1024 / 1024)
    };
    
    // Get detailed GPU information
    const gpuData = await si.graphics();
    let gpu = {
      name: 'No dedicated GPU detected',
      available: false,
      isNvidia: false,
      isAMD: false,
      isIntel: false,
      isAppleSilicon: false,
      memory: 0,
      controllers: []
    };
    
    if (gpuData && gpuData.controllers && gpuData.controllers.length) {
      // Store all GPU controllers for debugging
      gpu.controllers = gpuData.controllers.map(c => ({
        model: c.model,
        vendor: c.vendor,
        vram: c.vram,
        driver: c.driver
      }));
      
      // Find the best GPU
      let bestGpu = gpuData.controllers[0];
      
      for (const controller of gpuData.controllers) {
        // Skip "llvmpipe" and "software renderers"
        if (controller.model && (
            controller.model.toLowerCase().includes('llvmpipe') || 
            controller.model.toLowerCase().includes('software') ||
            controller.model.toLowerCase().includes('virtual'))
        ) {
          continue;
        }
        
        // Prefer dedicated GPUs with more VRAM
        if (controller.vram > (bestGpu.vram || 0)) {
          bestGpu = controller;
        }
      }
      
      gpu.name = bestGpu.model || 'Unknown GPU';
      gpu.vendor = bestGpu.vendor || 'Unknown';
      gpu.vram = bestGpu.vram || 0;
      gpu.available = true;
      
      // Determine GPU type
      const vendorLower = (bestGpu.vendor || '').toLowerCase();
      gpu.isNvidia = vendorLower.includes('nvidia');
      gpu.isAMD = vendorLower.includes('amd') || vendorLower.includes('advanced micro');
      gpu.isIntel = vendorLower.includes('intel');
      
      // Check for Apple Silicon
      const macModel = await si.system().then(sys => sys.model);
      gpu.isAppleSilicon = macModel && (
        macModel.includes('Mac') && (
          cpu.model.includes('Apple') || 
          gpu.name.toLowerCase().includes('apple') ||
          gpu.vendor.toLowerCase().includes('apple')
        )
      );
      
      // Debug info
      console.log('GPU Controllers:', JSON.stringify(gpu.controllers, null, 2));
      console.log('Best GPU:', JSON.stringify(bestGpu, null, 2));
    }
    
    return { cpu, memory, gpu };
  } catch (error) {
    console.error('Error getting hardware info:', error);
    // Return basic info in case of error
    return {
      cpu: { model: 'Unknown CPU', cores: 0 },
      memory: { total: 0, free: 0, used: 0 },
      gpu: { name: 'Unknown GPU', available: false }
    };
  }
}

module.exports = {
  getHardwareInfo
};