const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ignore = new Set(['node_modules', '.git', '.expo', 'dist']);

function printTree(dir, prefix = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true })
    .filter(item => !ignore.has(item.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${connector}${item.name}`);
    if (item.isDirectory()) {
      const subPrefix = prefix + (isLast ? '    ' : '│   ');
      printTree(path.join(dir, item.name), subPrefix);
    }
  });
}

console.log('SpendwiseApp/');
printTree(root);

