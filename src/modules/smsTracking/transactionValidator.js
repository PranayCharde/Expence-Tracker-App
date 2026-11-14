/**
 * Transaction Validator
 * Ensures extracted SMS transaction fields are well-formed and valid before storage.
 */

export function validateTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object') {
    return { isValid: false, error: 'Transaction object is required' };
  }

  // 1. Amount validation
  const { amount, type, date, referenceId } = transaction;

  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return { isValid: false, error: `Invalid transaction amount: ${amount}` };
  }

  // Cap maximum sanity check (e.g. 10,000,000 INR)
  if (amount > 10000000) {
    return { isValid: false, error: `Amount exceeds realistic threshold: ${amount}` };
  }

  // 2. Type validation
  if (type !== 'debit' && type !== 'credit') {
    return { isValid: false, error: `Invalid transaction type: ${type}` };
  }

  // 3. Date validation
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { isValid: false, error: `Invalid date format: ${date}` };
  }

  const txTime = new Date(date).getTime();
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const sixtyDaysInMs = 60 * oneDayInMs;

  // Transaction cannot be more than 1 day in the future
  if (txTime > now + oneDayInMs) {
    return { isValid: false, error: `Transaction date is in the future: ${date}` };
  }

  // Transaction cannot be older than 60 days
  if (now - txTime > sixtyDaysInMs) {
    return { isValid: false, error: `Transaction is older than 60 days: ${date}` };
  }

  // 4. Reference or identifier presence
  if (!referenceId && !transaction.merchant) {
    return { isValid: false, error: 'Missing reference ID and merchant information' };
  }

  return { isValid: true };
}

export default {
  validateTransaction
};

