const fs = require('fs');
const path = require('path');

const files = [
  'src/utils/formatDate.js',
  'src/components/modals/NewTransactionModal.js',
  'src/components/modals/TransactionDetailModal.js',
  'src/screens/dashboard/DashboardScreen.js',
  'src/screens/transactions/TransactionsScreen.js'
];

files.forEach(f => {
  const fullPath = path.join(__dirname, '..', f);
  const content = fs.readFileSync(fullPath, 'utf8');
  console.log(`File: ${f} -> Lines: ${content.split('\n').length}`);
});

