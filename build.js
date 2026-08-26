const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

console.log('[Build] Packaging SafeReach web assets into dist/...');

// Ensure dist directory exists
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 1. Copy public assets
if (fs.existsSync(path.join(rootDir, 'public'))) {
  copyRecursiveSync(path.join(rootDir, 'public'), path.join(distDir, 'public'));
}

// 2. Copy views HTML files
if (fs.existsSync(path.join(rootDir, 'views'))) {
  copyRecursiveSync(path.join(rootDir, 'views'), path.join(distDir, 'views'));

  // Copy views/*.html directly to dist root so login.html, dashboard.html, etc. can be accessed at root level
  const viewsFiles = fs.readdirSync(path.join(rootDir, 'views'));
  viewsFiles.forEach(file => {
    const fullPath = path.join(rootDir, 'views', file);
    if (fs.statSync(fullPath).isFile() && file.endsWith('.html')) {
      fs.copyFileSync(fullPath, path.join(distDir, file));
    }
  });

  // Ensure root index.html exists in dist
  if (fs.existsSync(path.join(rootDir, 'views', 'index.html'))) {
    fs.copyFileSync(path.join(rootDir, 'views', 'index.html'), path.join(distDir, 'index.html'));
  }
}

console.log('[Build Success] Web assets packaged into dist/ successfully.');
