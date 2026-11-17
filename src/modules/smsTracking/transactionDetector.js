/**
 * Transaction Detector
 * Evaluates raw SMS text and sender to determine if it is an eligible financial transaction.
 * Filters out OTPs, promotional SMS, balance inquiries, and failed transactions.
 */

// Known Indian Bank SMS sender codes (alpha header suffixes)
const INDIAN_BANK_HEADER_PATTERNS = [
  /HDFC/i, /SBI/i, /ICICI/i, /AXIS/i, /KOTAK/i, /PNBSMS/i, /BOBSMS/i,
  /CANBNK/i, /INDUSB/i, /YESBNK/i, /IDFCFB/i, /UNIONB/i, /FEDBNK/i,
  /SCISMS/i, /CITIBK/i, /RBLBNK/i, /PAYTM/i, /AIRTEL/i, /AUFIN/i, /BANDHN/i
];

// OTP indicator keywords
const OTP_KEYWORDS = [
  /\botp\b/i,
  /one\s*time\s*password/i,
  /verification\s*code/i,
  /security\s*code/i,
  /do\s*not\s*share/i,
  /is\s*your\s*code/i,
  /secret\s*code/i,
  /auth\s*code/i,
  /valid\s*for\s*\d+\s*min/i
];

// Failed / declined transaction keywords
const FAILED_KEYWORDS = [
  /\bdeclined\b/i,
  /\bfailed\b/i,
  /\bunsuccessful\b/i,
  /\btimed\s*out\b/i,
  /could\s*not\s*be\s*processed/i,
  /inadequate\s*funds/i,
  /insufficient\s*(?:funds|balance)/i,
  /transaction\s*cancelled/i,
  /request\s*failed/i
];

// Promotional keywords
const PROMO_KEYWORDS = [
  /pre-?approved/i,
  /apply\s*(?:now|online)/i,
  /loan\s*(?:offer|approved|amount)/i,
  /credit\s*card\s*limit\s*increase/i,
  /upgrade\s*your\s*card/i,
  /exclusive\s*offer/i,
  /congratulations!/i,
  /hurry\s*up/i,
  /use\s*coupon/i,
  /flat\s*\d+%\s*off/i,
  /claim\s*(?:your|now)/i
];

// Financial action keywords (Debit & Credit)
const FINANCIAL_ACTION_PATTERNS = [
  /\b(?:debited|spent|paid|payment|withdrawn|withdrawal|debited\s+by|sent|purchase|used\s+for|was\s+used)\b/i,
  /\b(?:credited|received|deposited|refund|refunded|reversal|reversed|salary|added|processed)\b/i,
  /\b(?:dr\.?|cr\.?)\b/i,
  /\bupi\b/i,
  /\bimps\b/i,
  /\bneft\b/i,
  /\brtgs\b/i,
  /\b(?:atm|cash)\s*(?:wdl|withdrawal)\b/i,
  /\bwithdrawal\b/i
];

// Currency indicators
const CURRENCY_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?/i,
  /[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|inr|₹)/i
];

/**
 * Checks whether the SMS represents an eligible financial transaction.
 * @param {string} body - The SMS message text
 * @param {string} sender - The SMS sender ID/header (e.g., "AD-HDFCBK")
 * @returns {{ isEligible: boolean, reason?: string }}
 */
export function isFinancialSms(body, sender = '') {
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return { isEligible: false, reason: 'Empty SMS body' };
  }

  const cleanBody = body.trim();

  // 1. Filter out OTPs immediately
  for (const pattern of OTP_KEYWORDS) {
    if (pattern.test(cleanBody)) {
      return { isEligible: false, reason: 'Ignored: OTP message' };
    }
  }

  // 2. Filter out Failed / Declined transactions
  for (const pattern of FAILED_KEYWORDS) {
    if (pattern.test(cleanBody)) {
      return { isEligible: false, reason: 'Ignored: Failed or declined transaction' };
    }
  }

  // 3. Filter out Promotional SMS (if it has no debit/credit transaction confirmation)
  const isPromo = PROMO_KEYWORDS.some((pattern) => pattern.test(cleanBody));
  const hasCurrency = CURRENCY_PATTERNS.some((pattern) => pattern.test(cleanBody));
  const hasFinancialAction = FINANCIAL_ACTION_PATTERNS.some((pattern) => pattern.test(cleanBody));

  if (isPromo && (!hasCurrency || !hasFinancialAction)) {
    return { isEligible: false, reason: 'Ignored: Promotional message' };
  }

  // 4. Must contain a currency amount
  if (!hasCurrency) {
    return { isEligible: false, reason: 'Ignored: No financial currency amount found' };
  }

  // 5. Must contain a financial action (debited, credited, paid, withdrawn, etc.)
  if (!hasFinancialAction) {
    return { isEligible: false, reason: 'Ignored: No financial action verb found' };
  }

  // 6. Filter pure Balance notifications with no actual transfer
  // (e.g. "Your available balance is Rs 5000.00" without debited/credited)
  const isBalanceNotificationOnly =
    /(?:avail(?:able)?|clear)\s*bal(?:ance)?(?:\s*is)?\s*(?:rs\.?|inr|₹)/i.test(cleanBody) &&
    !/(?:debited|credited|paid|spent|received|withdrawn|refund|refunded|reversal|reversed|deposited|salary)/i.test(cleanBody);

  if (isBalanceNotificationOnly) {
    return { isEligible: false, reason: 'Ignored: Balance inquiry or balance alert only' };
  }

  // 7. Check sender or bank keywords
  const isBankSender = INDIAN_BANK_HEADER_PATTERNS.some((p) => p.test(sender));
  const hasBankInBody = /(?:bank|a\/c|account|card|upi|imps|neft|rtgs|vpa)/i.test(cleanBody);

  if (!isBankSender && !hasBankInBody) {
    return { isEligible: false, reason: 'Ignored: Sender and content not identified as bank/financial' };
  }

  return { isEligible: true };
}

export default {
  isFinancialSms,
};
