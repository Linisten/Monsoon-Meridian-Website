import { app, BrowserWindow, ipcMain } from 'electron';

// Disable hardware acceleration to prevent screen flickering on some Windows machines
app.disableHardwareAcceleration();

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables from the app directory
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Create client ONLY if variables exist to prevent crash
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn("CRITICAL: Supabase credentials missing from .env file. Expiry alerts will be disabled.");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show the window until it's ready
    backgroundColor: '#e2e8f0', // Matches app background for instant "perceived" load
    icon: path.join(__dirname, 'public/icon.png'),
    webPreferences: {
      // Requirements: contextIsolation: false, nodeIntegration: false
      contextIsolation: false, 
      nodeIntegration: false,
      webSecurity: false, // Allow local resource loading and CORS
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show the window when it's ready to prevent white flash
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Hide the menu bar but preserve keyboard shortcuts (Zoom, Refresh, etc.)
  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);

  // Load the local production build
  win.loadFile(path.join(__dirname, 'dist/index.html')).catch((err) => {
    console.error('Failed to load index.html:', err);
  });

  // Handle silent printing request from preload.js
  ipcMain.on('silent-print', (event) => {
    const webContents = event.sender;
    console.log('Received silent-print request');
    
    webContents.print({
      silent: true,
      printBackground: true,
      color: false,
      margins: { marginType: 'none' }
    }, (success, failureReason) => {
      if (!success) {
        console.error('Print failed:', failureReason);
      } else {
        console.log('Print successful');
      }
    });
  });
}

async function checkExpiryAndNotify() {
  console.log('Running Expiry Check...');
  
  const now = new Date();
  const tenDaysFromNow = new Date();
  tenDaysFromNow.setDate(now.getDate() + 10);
  const todayStr = now.toISOString().split('T')[0];
  const tenDaysStr = tenDaysFromNow.toISOString().split('T')[0];

  try {
    const { data: expiringItems, error } = await supabase
      .from('items')
      .select('name, code, expiry_date')
      .lte('expiry_date', tenDaysStr)
      .gte('expiry_date', todayStr);

    if (error) {
      console.error('Supabase fetch error during expiry check:', error);
      return;
    }

    if (expiringItems && expiringItems.length > 0) {
      console.log(`Found ${expiringItems.length} expiring items. Preparing mail...`);
      await sendExpiryEmail(expiringItems);
    } else {
      console.log('No items expiring within 10 days.');
    }
  } catch (err) {
    console.error('Expiry check logic error:', err.message);
  }
}

async function sendExpiryEmail(items) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP credentials missing. Skipping email alert. Please configure .env');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const itemListHtml = items.map(it => 
    `<li><b>${it.name}</b> (Code: ${it.code || '--'}) - Expires on <b>${it.expiry_date}</b></li>`
  ).join('');

  try {
    await transporter.sendMail({
      from: `"Monsoon POS Alerts" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL || process.env.SMTP_USER,
      subject: `⚠ Expiry Alert: ${items.length} Items Expiring Soon`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0f172a;">Monsoon Meridian POS - Expiry Alert</h2>
          <p style="color: #475569;">The following items in your inventory are set to expire within the next 10 days:</p>
          <ul style="color: #1e293b; line-height: 1.6;">${itemListHtml}</ul>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 0.85rem; color: #64748b;">This is an automated alert from your Monsoon POS Desktop Application.</p>
        </div>
      `,
    });
    console.log('Alert email sent successfully.');
  } catch (mailErr) {
    console.error('Failed to send alert email:', mailErr.message);
  }
}

let printServerProcess = null;

function startPrintServer() {
  // In production with asar:false, we can just import the server.
  // This keeps it and its dependencies in the same Node lifecycle.
  // Using dynamic import because main.js is an ESM module
  import('./print-server/server.js').catch(err => {
    console.error('Failed to start print server via import:', err);
  });
}

app.whenReady().then(async () => {
  // Only start the internal print server if we are running the packaged app.
  // In development, we usually run it separately via npm run dev:all.
  if (app.isPackaged) {
    startPrintServer();
  }
  
  createWindow();
  
  // Wait a bit for network/db readiness then check expiry
  setTimeout(checkExpiryAndNotify, 5000);

  // Log printers on startup
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    try {
      const printers = await win.webContents.getPrintersAsync();
      console.log('--- Available Printers ---');
      printers.forEach((printer) => {
        console.log(`- ${printer.name} ${printer.isDefault ? '(Default)' : ''}`);
      });
      const defaultPrinter = printers.find(p => p.isDefault);
      console.log('Default Printer:', defaultPrinter ? defaultPrinter.name : 'None');
      console.log('---------------------------');
    } catch (err) {
      console.error('Failed to get printers:', err);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (printServerProcess) {
    printServerProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
