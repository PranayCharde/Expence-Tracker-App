/**
 * Test Suite for SpendWise SMS Tracking
 * Tests all 15 required scenarios
 */

const { isFinancialSms } = require('../src/modules/smsTracking/transactionDetector.js');
const { parseSms } = require('../src/modules/smsTracking/smsParser.js');
const { validateTransaction } = require('../src/modules/smsTracking/transactionValidator.js');
const { categorizeTransaction } = require('../src/modules/smsTracking/transactionCategorizer.js');

const testCases = [
  {
    id: 1,
    name: 'UPI payment of ₹500',
    sms: 'Dear Customer, Rs.500.00 debited from A/C **1234 on 14-Nov-26 to VPA swiggy@icici (UPI Ref 412345678901). Avail Bal: Rs.10,250.00',
    sender: 'AD-HDFCBK',
    expectedEligible: true,
    expectedAmount: 500,
    expectedType: 'debit',
    expectedCategory: 'Food',
    expectedMethod: 'Online / UPI'
  },
  {
    id: 2,
    name: 'UPI received ₹2,000',
    sms: 'Dear SBI User, your A/C ending with 4321 credited by Rs 2,000.00 on 14/11/26 via UPI/P2A/412399999999/John Doe. Bal: Rs 15,000.00',
    sender: 'VK-SBIINB',
    expectedEligible: true,
    expectedAmount: 2000,
    expectedType: 'credit',
    expectedCategory: 'Received from Friend',
    expectedMethod: 'Online / UPI'
  },
  {
    id: 3,
    name: 'NEFT credit',
    sms: 'Your A/C XX5678 is credited with Rs 15,500.00 on 14-Nov-26 by NEFT (Ref N123456789) from ABC CORP. Bal Rs 45,000.',
    sender: 'BP-ICICIB',
    expectedEligible: true,
    expectedAmount: 15500,
    expectedType: 'credit',
    expectedMethod: 'Bank Transfer'
  },
  {
    id: 4,
    name: 'IMPS debit',
    sms: 'Dear Customer, Rs. 10,000.00 debited from A/C XX4444 on 14-Nov-26 for IMPS to 9876543210 (IMPS Ref 778899). Bal: Rs. 23,000.',
    sender: 'AD-HDFCBK',
    expectedEligible: true,
    expectedAmount: 10000,
    expectedType: 'debit',
    expectedMethod: 'Bank Transfer'
  },
  {
    id: 5,
    name: 'ATM withdrawal',
    sms: 'Rs 5,000.00 withdrawn from ATM using Kotak Debit card XX3333 on 14-Nov-26. Txn ID 889911. Avl Bal: Rs 20,000.',
    sender: 'DZ-KOTAKB',
    expectedEligible: true,
    expectedAmount: 5000,
    expectedType: 'debit',
    expectedMethod: 'Cash'
  },
  {
    id: 6,
    name: 'Debit card payment',
    sms: 'Your A/C XX7890 is debited for INR 1,500.00 on 14-Nov-26 by Card ending 1234 at AMAZON INDIA. Avail Bal: Rs 8,500.',
    sender: 'BP-ICICIB',
    expectedEligible: true,
    expectedAmount: 1500,
    expectedType: 'debit',
    expectedCategory: 'Shopping',
    expectedMethod: 'Card'
  },
  {
    id: 7,
    name: 'Failed UPI transaction',
    sms: 'Payment of Rs 850.00 to Zomato failed due to bank technical issue. If debited, amount will be refunded in 3-5 days.',
    sender: 'VK-SBIINB',
    expectedEligible: false
  },
  {
    id: 8,
    name: 'Refund',
    sms: 'Refund of Rs. 450.00 processed to your A/C XX1234 from UBER on 14-Nov-26. Ref No 998877. Avail Bal Rs 12,000.',
    sender: 'AD-HDFCBK',
    expectedEligible: true,
    expectedAmount: 450,
    expectedType: 'credit'
  },
  {
    id: 9,
    name: 'Reversed transaction',
    sms: 'Transaction of Rs. 300.00 on card XX9876 has been reversed and credited to your A/C. Avl Bal Rs 5,300.',
    sender: 'AX-AXISBK',
    expectedEligible: true,
    expectedAmount: 300,
    expectedType: 'credit'
  },
  {
    id: 10,
    name: 'Duplicate SMS check',
    sms: 'Dear Customer, Rs.500.00 debited from A/C **1234 on 14-Nov-26 to VPA swiggy@icici (UPI Ref 412345678901).',
    sender: 'AD-HDFCBK',
    expectedEligible: true
  },
  {
    id: 11,
    name: 'OTP SMS',
    sms: '654321 is your secret OTP for ICICI Bank NetBanking login. Valid for 10 mins. Do not share with anyone.',
    sender: 'BP-ICICIB',
    expectedEligible: false
  },
  {
    id: 12,
    name: 'Promotional SMS',
    sms: 'Congratulations! You are pre-approved for a personal loan of Rs 5,00,000 at zero processing fee. Apply now at hdfc.bank/loan',
    sender: 'AD-HDFCBK',
    expectedEligible: false
  },
  {
    id: 13,
    name: 'Bank balance notification',
    sms: 'Dear Customer, your available balance in A/C XX1234 is Rs 25,430.50. Thank you for banking with us.',
    sender: 'AD-HDFCBK',
    expectedEligible: false
  },
  {
    id: 14,
    name: 'Unknown SMS format / Personal message',
    sms: 'Hey Pranay, did you reach the cafe? Let me know when you arrive!',
    sender: '+919876543210',
    expectedEligible: false
  }
];

console.log('=== RUNNING SPENDWISE SMS TRACKING TEST SUITE ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((tc) => {
  const detection = isFinancialSms(tc.sms, tc.sender);

  if (detection.isEligible !== tc.expectedEligible) {
    console.error(`❌ Scenario ${tc.id} [${tc.name}]: FAILED on detection. Expected eligible=${tc.expectedEligible}, got=${detection.isEligible} (${detection.reason})`);
    failed++;
    return;
  }

  if (!tc.expectedEligible) {
    console.log(`✅ Scenario ${tc.id} [${tc.name}]: PASSED (Correctly filtered: ${detection.reason})`);
    passed++;
    return;
  }

  // Parse
  const parsed = parseSms(tc.sms, tc.sender);

  // Validate
  const validation = validateTransaction(parsed);
  if (!validation.isValid) {
    console.error(`❌ Scenario ${tc.id} [${tc.name}]: FAILED on validation: ${validation.error}`);
    failed++;
    return;
  }

  // Check amount
  if (tc.expectedAmount && parsed.amount !== tc.expectedAmount) {
    console.error(`❌ Scenario ${tc.id} [${tc.name}]: Amount mismatch. Expected ${tc.expectedAmount}, got ${parsed.amount}`);
    failed++;
    return;
  }

  // Check type
  if (tc.expectedType && parsed.type !== tc.expectedType) {
    console.error(`❌ Scenario ${tc.id} [${tc.name}]: Type mismatch. Expected ${tc.expectedType}, got ${parsed.type}`);
    failed++;
    return;
  }

  // Check method
  if (tc.expectedMethod && parsed.paymentMethod !== tc.expectedMethod) {
    console.error(`❌ Scenario ${tc.id} [${tc.name}]: Method mismatch. Expected ${tc.expectedMethod}, got ${parsed.paymentMethod}`);
    failed++;
    return;
  }

  // Check category
  if (tc.expectedCategory) {
    const cat = categorizeTransaction(parsed);
    if (cat !== tc.expectedCategory) {
      console.error(`❌ Scenario ${tc.id} [${tc.name}]: Category mismatch. Expected ${tc.expectedCategory}, got ${cat}`);
      failed++;
      return;
    }
  }

  console.log(`✅ Scenario ${tc.id} [${tc.name}]: PASSED (Amount: ₹${parsed.amount}, Type: ${parsed.type}, Bank: ${parsed.bank}, Method: ${parsed.paymentMethod})`);
  passed++;
});

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);
