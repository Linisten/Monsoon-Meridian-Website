import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('🚀 Starting Definitive Manual Build...');

  // 1. Ensure dist directories exist
  console.log('📂 Preparing dist directories...');
  if (!fs.existsSync('dist')) fs.mkdirSync('dist');
  if (!fs.existsSync('dist-electron')) fs.mkdirSync('dist-electron');
  
  // Try to clear assets if possible, but don't crash if locked
  try {
    if (fs.existsSync('dist/assets')) {
      fs.readdirSync('dist/assets').forEach(file => {
        try { fs.unlinkSync(path.join('dist/assets', file)); } catch(e) {}
      });
    } else {
      fs.mkdirSync('dist/assets');
    }
  } catch (e) {
    console.log('⚠️ Note: Could not fully clear dist/assets (files might be in use). Overwriting...');
  }

  // 2. Build JavaScript with esbuild (Bypass Vite/LightningCSS)
  console.log('📦 Bundling renderer with esbuild...');
  try {
    await esbuild.build({
      entryPoints: ['src/main.jsx'],
      bundle: true,
      minify: true,
      sourcemap: false,
      outfile: 'dist/assets/index.js',
      format: 'esm',
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
        '.css': 'css',
        '.png': 'file',
        '.jpg': 'file',
        '.svg': 'file',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
        'import.meta.env.VITE_SUPABASE_URL': `"${process.env.VITE_SUPABASE_URL || 'https://qyaasvpzjrxzewfvvgul.supabase.co'}"`,
        'import.meta.env.VITE_SUPABASE_ANON_KEY': `"${process.env.VITE_SUPABASE_ANON_KEY || ''}"`,
      },
    });
  } catch (err) {
    console.error('❌ Renderer esbuild failed:', err);
    process.exit(1);
  }

  // 2.5 Build Electron Process
  console.log('⚡ Bundling Electron process...');
  try {
    await esbuild.build({
      entryPoints: ['electron/main.js'],
      bundle: true,
      minify: true,
      platform: 'node',
      format: 'esm',
      outfile: 'dist-electron/main.js',
      external: ['electron'],
    });

    // Copy preload if it exists
    if (fs.existsSync('electron/preload.mjs')) {
      fs.copyFileSync('electron/preload.mjs', 'dist-electron/preload.mjs');
    }
  } catch (err) {
    console.error('❌ Electron build failed:', err);
    process.exit(1);
  }

  // 3. Copy public files
  console.log('📂 Copying public assets...');
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, 'dist', { recursive: true });
  }

  // 4. Create/Fix index.html
  console.log('📄 Creating index.html...');
  let html = fs.readFileSync('index.html', 'utf-8');
  
  // Inject the script tag for our bundled js
  html = html.replace(
    /<script\s+type="module"\s+src="\/src\/main\.jsx"><\/script>/,
    '<link rel="stylesheet" href="./assets/index.css">\n    <script type="module" src="./assets/index.js"></script>'
  );

  // Surgically ensure all paths are relative
  html = html.replace(/(src|href)="\/assets\//g, '$1="./assets/');
  html = html.replace(/(src|href)="\/logo\.jpg"/g, '$1="./logo.jpg"');
  html = html.replace(/(src|href)="\/favicon\.ico"/g, '$1="./favicon.ico"');
  html = html.replace(/(src|href)="\/icon\.png"/g, '$1="./icon.png"');

  fs.writeFileSync('dist/index.html', html);

  console.log('✅ Manual build completed successfully!');
  console.log('🏠 Build locations: ./dist and ./dist-electron');
  console.log('📦 Next: Run electron-builder to generate Setup.exe');
}

build();
