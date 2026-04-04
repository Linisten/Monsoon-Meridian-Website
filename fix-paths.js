import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, 'dist', 'index.html');

console.log('🚀 Fixing paths in dist/index.html...');

try {
  let content = fs.readFileSync(indexPath, 'utf8');

  // Replace absolute /assets/ with relative assets/
  // Replace absolute src="/... with src="./...
  // Replace absolute href="/... with href="./...
  content = content.replace(/href="\/assets\//g, 'href="assets/');
  content = content.replace(/src="\/assets\//g, 'src="assets/');
  content = content.replace(/href="\/logo.jpg"/g, 'href="logo.jpg"');
  content = content.replace(/src="\/logo.jpg"/g, 'src="logo.jpg"');

  fs.writeFileSync(indexPath, content);
  console.log('✅ Successfully fixed paths for Electron compatibility.');
} catch (err) {
  console.error('❌ Error fixing paths:', err.message);
  process.exit(1);
}
