const { parseReceiptText } = require('../src/services/receiptScannerService');

const testCases = [
  {
    name: 'Starbucks Coffee Receipt with GST and UPI',
    input: `
STARBUCKS COFFEE
Indiranagar, Bangalore
GSTIN: 29AAAAA0000A1Z5
Date: 18/11/2026 Time: 14:32
Invoice #: SB-99482
1 Caffe Latte       240.00
1 Blueberry Muffin  210.00
Subtotal            450.00
CGST 2.5%            11.25
SGST 2.5%            11.25
TOTAL AMOUNT        ₹472.50
PAID VIA UPI
Thank you for visiting!
`,
    expectedAmount: 472.5,
    expectedCategory: 'Dining',
    expectedPaymentMethod: 'Online / UPI',
  },
  {
    name: 'Reliance Supermarket Groceries with Card',
    input: `
RELIANCE RETAIL LTD
Smart Superstore
Date: 2026-11-19
Tax Invoice
Items:
1 Milk 1L            60.00
2 Bread              80.00
3 Butter 500g       260.00
NET PAYABLE:        400.00
Payment: Card - Visa ending 4123
`,
    expectedAmount: 400.0,
    expectedCategory: 'Groceries',
    expectedPaymentMethod: 'Credit / Debit Card',
  },
  {
    name: 'Apollo Pharmacy Medical Receipt with Cash',
    input: `
APOLLO PHARMACY
Healthcare Pvt Ltd
Date: 15/11/2026
Total Bill: Rs. 850.00
Cash Tendered: 1000.00
Change: 150.00
`,
    expectedAmount: 850.0,
    expectedCategory: 'Medical',
    expectedPaymentMethod: 'Cash',
  },
  {
    name: 'Shell Petrol Station Fuel Receipt',
    input: `
SHELL INDIA PETROLEUM
Fuel Station #42
Date: 12-11-2026
Petrol (Power): 25.0 L
Rate: 102.50
GRAND TOTAL: ₹2,562.50
PAID VIA GPAY UPI
`,
    expectedAmount: 2562.5,
    expectedCategory: 'Transport',
    expectedPaymentMethod: 'Online / UPI',
  }
];

let passed = 0;
for (const tc of testCases) {
  const result = parseReceiptText(tc.input);
  const amountOk = result.amount === tc.expectedAmount;
  const catOk = result.category === tc.expectedCategory;
  const payOk = result.paymentMethod === tc.expectedPaymentMethod;

  if (amountOk && catOk && payOk) {
    console.log(`✅ [PASS] ${tc.name} -> Extracted: ₹${result.amount}, Merchant: "${result.merchant}", Category: ${result.category}, Pay: ${result.paymentMethod}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${tc.name}`, { expected: tc, actual: result });
  }
}

console.log(`\nReceipt Parser Tests: ${passed}/${testCases.length} Passed.`);
if (passed !== testCases.length) process.exit(1);
