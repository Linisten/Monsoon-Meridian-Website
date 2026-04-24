const { ipcRenderer } = require('electron');

// Polyfills for React/Vite apps in Electron
window.global = window;
window.process = {
  env: {
    NODE_ENV: 'production'
  }
};

/**
 * Requirement: Override window.print in preload.js BEFORE page loads
 * This replaces the default browser print dialog with a silent print command
 * sent to the main process via IPC.
 */
window.process = {
  env: {
    NODE_ENV: 'production'
  }
};

window.print = () => {
  console.log('Intercepted window.print() - sending silent-print IPC message');
  ipcRenderer.send('silent-print');
};

console.log('Preload script loaded successfully - window.print overridden');
