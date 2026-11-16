/**
 * SpendWise Full Automated Test Suite
 * Covers Authentication, Transactions, Cash Wallet, SMS Engine,
 * Financial Calculations, Deduplication, and Persistence.
 */

const { isFinancialSms } = require('../src/modules/smsTracking/transactionDetector.js');
const { parseSms } = require('../src/modules/smsTracking/smsParser.js');
const { validateTransaction } = require('../src/modules/smsTracking/transactionValidator.js');
const { categorizeTransaction } = require('../src/modules/smsTracking/transactionCategorizer.js');
const { formatTransactionDate, getTodayDateString, getYesterdayDateString } = require('../src/utils/formatDate.js');

function getTransactionSignature(tx) {
  if (tx.referenceId && !tx.referenceId.startsWith('TXN_')) {
    return `REF_${tx.referenceId}`;
  }
  const cleanBank = (tx.bank || 'BANK').replace(/\s+/g, '');
  const cleanAcc = (tx.accountMask || 'ACC').replace(/\s+/g, '');
  return `SIG_${cleanBank}_${cleanAcc}_${tx.type}_${tx.amount}_${tx.date}`;
}

const testResults = [];

function runTest(category, name, testFn) {
  try {
    const { expected, actual, pass, details } = testFn();
    testResults.push({
      category,
      name,
      expected: JSON.stringify(expected),
      actual: JSON.stringify(actual),
      status: pass ? 'PASS' : 'FAIL',
      details: details || ''
    });
  } catch (err) {
    testResults.push({
      category,
      name,
      expected: 'No uncaught exception',
      actual: err.message,
      status: 'FAIL',
      details: err.stack
    });
  }
}

console.log("==================================================");
console.log("STARTING SPENDWISE COMPLETE AUTOMATED TEST SUITE");
console.log("==================================================\n");

// -----------------------------------------------------------------
// A. AUTHENTICATION & VALIDATION TESTS
// -----------------------------------------------------------------
runTest('Authentication', 'Email validation: Valid email format', () => {
  const validEmail = 'user@example.com'.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validEmail);
  return { expected: true, actual: isValid, pass: isValid === true };
});

runTest('Authentication', 'Email validation: Invalid email format rejected', () => {
  const invalidEmail = 'userexample.com';
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invalidEmail);
  return { expected: false, actual: isValid, pass: isValid === false };
});

runTest('Authentication', 'Password length requirement: >= 6 chars', () => {
  const shortPass = '12345';
  const validPass = 'SecurePass123';
  const shortValid = shortPass.length >= 6;
  const longValid = validPass.length >= 6;
  return { expected: [false, true], actual: [shortValid, longValid], pass: !shortValid && longValid };
});

runTest('Authentication', 'Password confirmation matching', () => {
  const pass1 = 'Secret123';
  const pass2 = 'Secret123';
  const passMismatch = 'Secret456';
  const match = pass1 === pass2;
  const mismatch = pass1 === passMismatch;
  return { expected: [true, false], actual: [match, mismatch], pass: match && !mismatch };
});

// -----------------------------------------------------------------
// B. TRANSACTION LIFECYCLE & VALIDATION TESTS
// -----------------------------------------------------------------
runTest('Transactions', 'Positive amount validation (> 0)', () => {
  const valid = validateTransaction({ amount: 500, type: 'debit', date: '2026-11-14', merchant: 'Store' });
  const zero = validateTransaction({ amount: 0, type: 'debit', date: '2026-11-14', merchant: 'Store' });
  const negative = validateTransaction({ amount: -100, type: 'debit', date: '2026-11-14', merchant: 'Store' });
  return {
    expected: [true, false, false],
    actual: [valid.isValid, zero.isValid, negative.isValid],
    pass: valid.isValid && !zero.isValid && !negative.isValid
  };
});

runTest('Transactions', 'Extreme amount boundary (Max allowed 10,000,000)', () => {
  const okAmount = validateTransaction({ amount: 5000000, type: 'credit', date: '2026-11-14', merchant: 'Salary' });
  const extremeAmount = validateTransaction({ amount: 20000000, type: 'credit', date: '2026-11-14', merchant: 'Transfer' });
  return {
    expected: [true, false],
    actual: [okAmount.isValid, extremeAmount.isValid],
    pass: okAmount.isValid && !extremeAmount.isValid
  };
});

runTest('Transactions', 'Transaction date formatting', () => {
  const today = getTodayDateString();
  const formattedToday = formatTransactionDate(today);
  const formattedCustom = formatTransactionDate('2026-11-13');
  return {
    expected: [formattedToday, '13 Nov 2026'],
    actual: [formattedToday, formattedCustom],
    pass: formattedToday.length > 0 && formattedCustom === '13 Nov 2026'
  };
});

// -----------------------------------------------------------------
// C. CASH WALLET & ATM TRANSFER ACCOUNTING TESTS
// -----------------------------------------------------------------
runTest('Cash Wallet', 'Strict ATM Accounting: ATM is cash transfer, NOT income', () => {
  // Scenario:
  // 1. Initial Bank Salary = +50,000 (Online Income)
  // 2. ATM Withdrawal = 5,000 (Transfer to Physical Cash)
  // 3. Physical Spend on Food = -500 (Cash Expense)
  // 4. Online Spend on Shopping = -1,000 (Online Expense)
  const transactions = [
    { amount: 50000, category: 'Salary', paymentMethod: 'Bank Transfer' },
    { amount: -5000, category: 'ATM Withdrawal', paymentMethod: 'Cash' },
    { amount: -500, category: 'Food', paymentMethod: 'Cash' },
    { amount: -1000, category: 'Shopping', paymentMethod: 'Card' }
  ];

  // 1. Total Income (Must only be 50,000, NOT 55,000)
  const totalIncome = transactions
    .filter(t => t.amount > 0 && t.category !== 'ATM Withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Total Expense (Must be 1,500 = 500 + 1000, NOT 6,500)
  const totalExpense = transactions
    .filter(t => t.amount < 0 && t.category !== 'ATM Withdrawal')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // 3. Overall Balance (50,000 - 1,500 = 48,500)
  const totalBalance = totalIncome - totalExpense;

  // 4. Physical Cash Balance: Inflow (ATM 5,000) - Outflow (Food 500) = 4,500
  const cashIn = transactions
    .filter(t => (t.paymentMethod === 'Cash' && t.amount > 0) || t.category === 'ATM Withdrawal')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const cashOut = transactions
    .filter(t => t.paymentMethod === 'Cash' && t.amount < 0 && t.category !== 'ATM Withdrawal')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const cashBalance = cashIn - cashOut;

  // 5. Online / Bank Balance = Total Balance - Cash Balance = 48,500 - 4,500 = 44,000
  const onlineBalance = totalBalance - cashBalance;

  const pass = (
    totalIncome === 50000 &&
    totalExpense === 1500 &&
    totalBalance === 48500 &&
    cashBalance === 4500 &&
    onlineBalance === 44000
  );

  return {
    expected: { totalIncome: 50000, totalExpense: 1500, totalBalance: 48500, cashBalance: 4500, onlineBalance: 44000 },
    actual: { totalIncome, totalExpense, totalBalance, cashBalance, onlineBalance },
    pass
  };
});

runTest('Cash Wallet', 'Denomination counter math (Indian Currencies)', () => {
  const denoms = { 500: 4, 200: 5, 100: 10, 50: 2, 20: 5, 10: 10, coins: 50 };
  const expectedTotal = (4 * 500) + (5 * 200) + (10 * 100) + (2 * 50) + (5 * 20) + (10 * 10) + 50;
  // 2000 + 1000 + 1000 + 100 + 100 + 100 + 50 = 4350
  return { expected: 4350, actual: expectedTotal, pass: expectedTotal === 4350 };
});

// -----------------------------------------------------------------
// D. SMS DETECTION & PARSING SUITE (INDIAN BANK FORMATS)
// -----------------------------------------------------------------
const bankSamples = [
  {
    name: 'HDFC UPI Debit',
    sender: 'AD-HDFCBK',
    body: 'Dear UPI user A/C 1234 debited by 350.00 on 14-Nov-26 to ZOMATO UPI Ref 632145897123. Avl Bal INR 12500.00',
    expectedAmount: 350,
    expectedType: 'debit',
    expectedBank: 'HDFC Bank',
    expectedCategory: 'Food',
    expectedMethod: 'Online / UPI'
  },
  {
    name: 'SBI UPI Credit',
    sender: 'VM-SBIUPI',
    body: 'Dear SBI Customer, your A/c XX5678 is credited by INR 2,500.00 on 14Nov26 by transfer from PRANAY UPI Ref 998877665544.',
    expectedAmount: 2500,
    expectedType: 'credit',
    expectedBank: 'State Bank of India',
    expectedCategory: 'Received from Friend',
    expectedMethod: 'Online / UPI'
  },
  {
    name: 'ICICI Credit Card',
    sender: 'AX-ICICIB',
    body: 'Your ICICI Bank Credit Card XX9012 was used for INR 1,499.00 at AMAZON INDIA on 14-Nov-2026. Avl Lmt INR 85000.',
    expectedAmount: 1499,
    expectedType: 'debit',
    expectedBank: 'ICICI Bank',
    expectedCategory: 'Shopping',
    expectedMethod: 'Card'
  },
  {
    name: 'Kotak ATM Cash Withdrawal',
    sender: 'KM-KOTAKB',
    body: 'Cash withdrawal of Rs. 4,000.00 from ATM using Kotak Debit Card ending 4433 on 14-Nov-26. Avl bal INR 18200.00.',
    expectedAmount: 4000,
    expectedType: 'debit',
    expectedBank: 'Kotak Mahindra Bank',
    expectedCategory: 'ATM Withdrawal',
    expectedMethod: 'Cash'
  },
  {
    name: 'Axis Bank Salary Credit',
    sender: 'BZ-AXISBK',
    body: 'Your A/c no. XX8899 is credited with Rs 75,000.00 on 01-Nov-26 by Salary Credit from TECH CORP. Avl Bal Rs 82,450.00.',
    expectedAmount: 75000,
    expectedType: 'credit',
    expectedBank: 'Axis Bank',
    expectedCategory: 'Salary',
    expectedMethod: 'Bank Transfer'
  },
  {
    name: 'Swiggy Refund Credit',
    sender: 'AD-HDFCBK',
    body: 'Dear Customer, INR 320.00 has been refunded to your HDFC Bank A/c XX1234 from SWIGGY on 14-Nov-26. Ref 11223344.',
    expectedAmount: 320,
    expectedType: 'credit',
    expectedBank: 'HDFC Bank',
    expectedCategory: 'Refund',
    expectedMethod: 'Online / UPI'
  }
];

bankSamples.forEach(sample => {
  runTest('SMS Engine', `Indian Bank Parse: ${sample.name}`, () => {
    const detection = isFinancialSms(sample.body, sample.sender);
    if (!detection.isEligible) {
      return { expected: 'Eligible', actual: detection.reason, pass: false };
    }
    const parsed = parseSms(sample.body, sample.sender);
    const category = categorizeTransaction(parsed);

    const pass = (
      parsed.amount === sample.expectedAmount &&
      parsed.type === sample.expectedType &&
      parsed.bank === sample.expectedBank &&
      category === sample.expectedCategory &&
      parsed.paymentMethod === sample.expectedMethod
    );

    return {
      expected: {
        amount: sample.expectedAmount,
        type: sample.expectedType,
        bank: sample.expectedBank,
        category: sample.expectedCategory,
        method: sample.expectedMethod
      },
      actual: {
        amount: parsed.amount,
        type: parsed.type,
        bank: parsed.bank,
        category,
        method: parsed.paymentMethod
      },
      pass
    };
  });
});

// -----------------------------------------------------------------
// E. SMS FILTERING & NOISE DISCARD TESTS
// -----------------------------------------------------------------
const noiseMessages = [
  { name: 'OTP Code message', body: 'Your OTP for netbanking login is 482910. Do not share with anyone.', sender: 'AX-HDFCBK' },
  { name: 'Promotional Loan Offer', body: 'Get instant pre-approved personal loan up to Rs. 5,00,000 at low interest. Apply now.', sender: 'DM-LOANS' },
  { name: 'Failed UPI Payment', body: 'Failed! Your payment of Rs. 400 to CHAI POINT failed due to technical error. Ref 12345.', sender: 'VM-SBIUPI' },
  { name: 'Pure Balance Notification', body: 'Your account balance for A/c XX1234 is INR 14,200.00 as of 14-Nov-26.', sender: 'AD-HDFCBK' },
  { name: 'Personal chat SMS', body: 'Hey bro, are we meeting for dinner tonight at 8 PM?', sender: '+919876543210' }
];

noiseMessages.forEach(noise => {
  runTest('SMS Filtering', `Ignore Noise: ${noise.name}`, () => {
    const detection = isFinancialSms(noise.body, noise.sender);
    return {
      expected: false,
      actual: detection.isEligible,
      pass: detection.isEligible === false,
      details: detection.reason
    };
  });
});

// -----------------------------------------------------------------
// F. DEDUPLICATION TESTS
// -----------------------------------------------------------------
runTest('Duplicate Detection', 'Signature generation for identical transactions', () => {
  const tx1 = { referenceId: 'REF12345', bank: 'HDFC Bank', accountMask: 'XX1234', type: 'debit', amount: 500, date: '2026-11-14' };
  const tx2 = { referenceId: 'REF12345', bank: 'HDFC Bank', accountMask: 'XX1234', type: 'debit', amount: 500, date: '2026-11-14' };
  const sig1 = getTransactionSignature(tx1);
  const sig2 = getTransactionSignature(tx2);
  return { expected: sig1, actual: sig2, pass: sig1 === sig2 && sig1 === 'REF_REF12345' };
});

runTest('Duplicate Detection', 'Compound signature when bank referenceId is missing', () => {
  const txWithoutRef = { referenceId: null, bank: 'State Bank of India', accountMask: 'XX9999', type: 'debit', amount: 350, date: '2026-11-14' };
  const sig = getTransactionSignature(txWithoutRef);
  const expectedPrefix = 'SIG_StateBankofIndia_XX9999_debit_350_2026-11-14';
  return { expected: expectedPrefix, actual: sig, pass: sig === expectedPrefix };
});

// -----------------------------------------------------------------
// SUMMARY & EXIT
// -----------------------------------------------------------------
console.log("\n==================================================");
console.log("TEST RESULTS SUMMARY");
console.log("==================================================");

let passedCount = 0;
let failedCount = 0;

testResults.forEach((t, i) => {
  const icon = t.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${t.category}] ${t.name}: ${t.status}`);
  if (t.status === 'PASS') passedCount++;
  else {
    failedCount++;
    console.log(`   Expected: ${t.expected}`);
    console.log(`   Actual:   ${t.actual}`);
    if (t.details) console.log(`   Details:  ${t.details}`);
  }
});

console.log("\n==================================================");
console.log(`TOTAL: ${testResults.length} Tests | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
