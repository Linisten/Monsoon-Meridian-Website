/**
 * keyboardManager.js
 * Centralized scanner buffer logic to prevent multiple window event listener conflicts.
 */

let scannerBuffer = '';
let scannerTimeout = null;
let activeHandler = null;

const handleKeyDown = (e) => {
  // 1. Detect if the focus is on a readable field
  const activeElem = document.activeElement;
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElem.tagName.toUpperCase()) || 
                  activeElem.isContentEditable ||
                  activeElem.closest('.SearchableSelect');

  if (isInput) return;

  // 2. Barcode Scanner Buffer
  if (e.key === 'Enter') {
    if (scannerBuffer.length > 2 && activeHandler) {
      e.preventDefault(); 
      try {
        activeHandler(scannerBuffer);
      } catch (err) {
        console.error('Scanner Handler Error:', err);
      } finally {
        scannerBuffer = '';
      }
    } else {
      scannerBuffer = ''; // Clear anyway if too short
    }
  } else if (e.key.length === 1) {
    scannerBuffer += e.key;
    if (scannerTimeout) clearTimeout(scannerTimeout);
    // Clear buffer if inactive (prevents manual typing from building up forever)
    scannerTimeout = setTimeout(() => {
      scannerBuffer = '';
    }, 300);
  }
};

export const initKeyboardManager = () => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
};

export const setScannerHandler = (handler) => {
  activeHandler = handler;
};

export const clearScannerHandler = () => {
  activeHandler = null;
};
