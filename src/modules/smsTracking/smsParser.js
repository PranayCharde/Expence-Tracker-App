/**
 * JavaScript Indian Bank SMS Parser
 * Extracts financial transaction details from SMS strings across all major Indian banks.
 */

// Bank sender identification map
const BANK_SENDER_MAP = {
  HDFC: 'HDFC Bank',
  HDFCBK: 'HDFC Bank',
  SBI: 'State Bank of India',
  SBIINB: 'State Bank of India',
  SBIPSG: 'State Bank of India',
  ICICI: 'ICICI Bank',
  ICICIB: 'ICICI Bank',
  AXIS: 'Axis Bank',
  AXISBK: 'Axis Bank',
  KOTAK: 'Kotak Mahindra Bank',
  KOTAKB: 'Kotak Mahindra Bank',
  PNB: 'Punjab National Bank',
  PNBSMS: 'Punjab National Bank',
  BOB: 'Bank of Baroda',
  BOBSMS: 'Bank of Baroda',
  CANBNK: 'Canara Bank',
  INDUSB: 'IndusInd Bank',
  YESBNK: 'Yes Bank',
  IDFCFB: 'IDFC FIRST Bank',
  UNIONB: 'Union Bank of India',
  FEDBNK: 'Federal Bank',
  RBLBNK: 'RBL Bank',
  PAYTM: 'Paytm Payments Bank',
  AIRTEL: 'Airtel Payments Bank',
  AUFIN: 'AU Small Finance Bank'
};

/**
 * Identify bank from sender ID or message body
 */
function identifyBank(sender = '', body = '') {
  const upperSender = (sender || '').toUpperCase();
  for (const [key, name] of Object.entries(BANK_SENDER_MAP)) {
    if (upperSender.includes(key)) {
      return name;
    }
  }

  const upperBody = body.toUpperCase();
  for (const [key, name] of Object.entries(BANK_SENDER_MAP)) {
    if (upperBody.includes(name.toUpperCase()) || upperBody.includes(key)) {
      return name;
    }
  }

  return 'Bank Account';
}

/**
 * Extract transaction amount
 */
function extractAmount(body) {
  // 1. Strip available balance / limit expressions so balance is NEVER mistaken for transaction amount
  const cleanedBody = body.replace(
    /(?:avl(?:\.?|\s+bal(?:ance)?)?|avail(?:\.?|\s+bal(?:ance)?)?|available\s+balance|avl\s+lmt|available\s+limit|bal(?:ance)?)\s*:?\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
    ''
  );

  const amountPatterns = [
    // Matches transaction action amounts (e.g., "debited by 350.00", "credited with Rs 75,000.00", "spent INR 1,499.00", "withdrawal of Rs. 4,000.00", "used for INR 1,499.00")
    /(?:debited|credited|withdrawn|spent|paid|refunded|refund|transferred|sent|withdrawal\s+of|used\s+for|purchase\s+of)\s+(?:by|for|of|with)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
    // Matches explicit currency prefixes (e.g., "Rs. 500.00", "INR 1,200", "₹ 450")
    /(?:rs\.?|inr|₹)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
    // Matches explicit currency postfixes (e.g., "500.00 Rs" or "1,200 INR")
    /([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|₹)/i
  ];

  for (const regex of amountPatterns) {
    const match = cleanedBody.match(regex);
    if (match && match[1]) {
      const rawNum = match[1].replace(/,/g, '');
      const parsed = parseFloat(rawNum);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Determine Debit or Credit type
 * @returns {'debit' | 'credit'}
 */
function extractType(body) {
  const lower = body.toLowerCase();

  // 1. Direct card spend check (e.g., "Credit Card was used for...", "Card spent")
  if (/(?:credit\s*card|debit\s*card|card)\s+.*?\b(?:used\s+for|was\s+used|spent|paid|purchase|debited)\b/i.test(lower)) {
    return 'debit';
  }

  // Credit indicators (takes priority if refund/reversal/salary)
  const creditKeywords = [
    'credited',
    'credited to',
    'credit of',
    'refund',
    'refunded',
    'reversal',
    'reversed',
    'cashback',
    'salary',
    'received',
    'deposited',
    'cr.'
  ];

  // Debit indicators
  const debitKeywords = [
    'debited',
    'debited from',
    'debit',
    'spent',
    'paid',
    'sent',
    'withdrawn',
    'withdrawal',
    'used for',
    'was used',
    'purchase',
    'dr.'
  ];

  for (const word of creditKeywords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return 'credit';
    }
  }

  for (const word of debitKeywords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return 'debit';
    }
  }

  return 'debit'; // Default fallback
}

/**
 * Extract Payment Method
 * @returns {'Online / UPI' | 'Card' | 'Bank Transfer' | 'Cash'}
 */
function extractPaymentMethod(body) {
  const lower = body.toLowerCase();

  if (/\batm\b|cash\s*withdrawal/i.test(lower)) {
    return 'Cash';
  }
  if (/\b(?:card|debit\s*card|credit\s*card|pos)\b/i.test(lower)) {
    return 'Card';
  }
  if (/\b(?:upi|vpa|gpay|phonepe|paytm)\b/i.test(lower)) {
    return 'Online / UPI';
  }
  if (/\b(?:neft|imps|rtgs|net\s*banking|transfer|salary\s*credit|payroll)\b/i.test(lower)) {
    return 'Bank Transfer';
  }

  return 'Online / UPI';
}

/**
 * Extract masked account or card number (e.g. "XX1234", "ending 5678")
 */
function extractAccountMask(body) {
  const patterns = [
    /(?:a\/c|acct|account|card)\s*(?:no\.?)?\s*(?:ending\s+with\s+|ending\s+|xx*|\.\.*)?([0-9]{3,4})\b/i,
    /(?:xx*|\.\.*)([0-9]{4})\b/i
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return `XX${match[1]}`;
    }
  }

  return 'A/C';
}

/**
 * Extract reference ID (UPI Ref, RRN, IMPS Ref, Txn ID)
 */
function extractReferenceId(body, fallbackTimestamp) {
  const patterns = [
    /(?:upi\s*(?:ref|rrn|txn|id)|rrn|ref\s*(?:no|id)?|txn\s*id)[\s:]*([A-Za-z0-9]{6,25})/i,
    /upi\/[a-z0-9]+\/([0-9]{6,20})/i,
    /(?:imps\s*(?:ref|no|id)?)[\s:]*([A-Za-z0-9]{6,25})/i,
    /(?:neft\s*(?:ref|no|id)?)[\s:]*([A-Za-z0-9]{6,25})/i
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: generate a pseudo-reference from timestamp and hash
  return `TXN_${fallbackTimestamp || Date.now()}`;
}

/**
 * Extract Merchant or Recipient / Sender name
 */
function extractMerchant(body, type) {
  // Look for "paid to <merchant>", "to VPA <merchant>", "at <merchant>", "info <merchant>", "from <merchant>"
  const patterns = [
    /(?:paid\s+to|to\s+vpa)\s+([A-Za-z0-9\.\-\_\&\s]{2,30}?)(?:\s+on|\s+ref|\s+avail|\s+bal|\s+upi|\.|\,|$)/i,
    /(?:at|info:?)\s+([A-Za-z0-9\.\-\_\&\s]{2,30}?)(?:\s+on|\s+ref|\s+avail|\s+bal|\s+upi|\.|\,|$)/i,
    /(?:from\s+vpa|from)\s+([A-Za-z0-9\.\-\_\&\s]{2,30}?)(?:\s+on|\s+ref|\s+avail|\s+bal|\s+upi|\.|\,|$)/i,
    /(?:to)\s+([A-Za-z0-9\.\-\_\&\s]{2,30}?)(?:\s+on|\s+ref|\s+avail|\s+bal|\s+upi|\.|\,|$)/i
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filter out non-merchant tokens
      const blacklist = ['a/c', 'account', 'card', 'bank', 'your', 'rs', 'inr', 'vpa'];
      if (!blacklist.includes(candidate.toLowerCase()) && candidate.length > 2) {
        // Clean VPA handle if present (e.g. swiggy@icici -> Swiggy)
        if (candidate.includes('@')) {
          const vpaName = candidate.split('@')[0];
          return vpaName.charAt(0).toUpperCase() + vpaName.slice(1);
        }
        return candidate;
      }
    }
  }

  // Fallback based on type
  if (type === 'credit') {
    if (/salary/i.test(body)) return 'Salary';
    if (/refund/i.test(body)) return 'Refund';
    if (/cashback/i.test(body)) return 'Cashback';
    return 'Money Received';
  }

  return 'Online Payment';
}

/**
 * Extract or format transaction date
 */
function extractDate(body, fallbackTimestamp) {
  // Look for date patterns in SMS (e.g. 14-Nov-26, 14/11/26, 14-11-2026)
  const datePattern = /(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2,4})/;
  const match = body.match(datePattern);

  if (match) {
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    let year = match[3];
    if (year.length === 2) year = `20${year}`;

    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    let monthStr = monthRaw;
    if (isNaN(parseInt(monthRaw, 10))) {
      monthStr = monthMap[monthRaw.toLowerCase().substring(0, 3)] || '01';
    } else {
      monthStr = monthRaw.padStart(2, '0');
    }

    return `${year}-${monthStr}-${day}`;
  }

  // Fallback to provided timestamp or today
  const targetDate = fallbackTimestamp ? new Date(fallbackTimestamp) : new Date();
  return targetDate.toISOString().split('T')[0];
}

/**
 * Main parser entry point
 * @param {string} body - SMS message body
 * @param {string} sender - SMS sender ID
 * @param {number} timestamp - SMS timestamp in ms
 * @returns {object} Parsed transaction object
 */
export function parseSms(body, sender = '', timestamp = Date.now()) {
  const type = extractType(body);
  const amount = extractAmount(body);
  const paymentMethod = extractPaymentMethod(body);
  const merchant = extractMerchant(body, type);
  const bank = identifyBank(sender, body);
  const accountMask = extractAccountMask(body);
  const referenceId = extractReferenceId(body, timestamp);
  const date = extractDate(body, timestamp);

  return {
    amount,
    type, // 'debit' or 'credit'
    paymentMethod, // 'Online / UPI', 'Card', 'Bank Transfer', 'Cash'
    merchant,
    bank,
    accountMask,
    referenceId,
    date,
    rawSender: sender,
    rawBody: body,
    timestamp
  };
}

export default {
  parseSms,
  identifyBank,
  extractAmount,
  extractType,
  extractPaymentMethod,
  extractMerchant,
  extractReferenceId,
  extractDate
};
