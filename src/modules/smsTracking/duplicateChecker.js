/**
 * Persistent Duplicate Transaction Checker
 * Ensures identical SMS messages and bank reference IDs are never processed twice.
 * Uses both local safeStorage and Firestore index verification.
 */

import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { safeGetItem, safeSetItem } from '../../utils/safeStorage';

const PROCESSED_CACHE_KEY = 'spendwise_processed_sms_cache';
const MAX_CACHE_ENTRIES = 200;

/**
 * Generate a unique signature for a transaction
 */
export function getTransactionSignature(tx) {
  if (tx.referenceId && !tx.referenceId.startsWith('TXN_')) {
    return `REF_${tx.referenceId}`;
  }
  // Compound signature: Bank_Account_Type_Amount_Date
  const cleanBank = (tx.bank || 'BANK').replace(/\s+/g, '');
  const cleanAcc = (tx.accountMask || 'ACC').replace(/\s+/g, '');
  return `SIG_${cleanBank}_${cleanAcc}_${tx.type}_${tx.amount}_${tx.date}`;
}

/**
 * Get locally cached signatures
 * @returns {Promise<string[]>}
 */
async function getCachedSignatures() {
  try {
    const raw = await safeGetItem(PROCESSED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Check if the transaction is a duplicate
 * @param {string} userId - Firebase user ID
 * @param {object} transaction - Parsed transaction object
 * @returns {Promise<boolean>}
 */
export async function isDuplicate(userId, transaction) {
  if (!userId || !transaction) return false;

  const signature = getTransactionSignature(transaction);

  // 1. Check local persistent cache
  const cachedList = await getCachedSignatures();
  if (cachedList.includes(signature)) {
    console.log(`[DuplicateChecker] Found duplicate in local cache: ${signature}`);
    return true;
  }

  // 2. Check Firestore for existing transaction with identical smsReferenceId
  try {
    if (transaction.referenceId && !transaction.referenceId.startsWith('TXN_')) {
      const q = query(
        collection(db, 'users', userId, 'transactions'),
        where('smsReferenceId', '==', transaction.referenceId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        console.log(`[DuplicateChecker] Found duplicate in Firestore by smsReferenceId: ${transaction.referenceId}`);
        // Backfill local cache
        await markProcessedLocally(signature);
        return true;
      }
    }

    // 3. Check Firestore for identical date, amount, and paymentMethod
    const txAmount = transaction.type === 'expense' 
      ? -Math.abs(transaction.amount) 
      : Math.abs(transaction.amount);

    const qCompound = query(
      collection(db, 'users', userId, 'transactions'),
      where('date', '==', transaction.date),
      where('amount', '==', txAmount),
      limit(5)
    );
    const snapCompound = await getDocs(qCompound);
    for (const doc of snapCompound.docs) {
      const data = doc.data();
      if (
        data.paymentMethod === transaction.paymentMethod &&
        data.description &&
        data.description.toLowerCase().includes(transaction.merchant.toLowerCase())
      ) {
        console.log(`[DuplicateChecker] Found duplicate compound match in Firestore: ${doc.id}`);
        await markProcessedLocally(signature);
        return true;
      }
    }
  } catch (err) {
    console.warn('[DuplicateChecker] Error querying Firestore for duplicates (network offline?):', err);
  }

  return false;
}

/**
 * Helper to append signature to local storage
 */
async function markProcessedLocally(signature) {
  try {
    let list = await getCachedSignatures();
    if (!list.includes(signature)) {
      list.unshift(signature);
      if (list.length > MAX_CACHE_ENTRIES) {
        list = list.slice(0, MAX_CACHE_ENTRIES);
      }
      await safeSetItem(PROCESSED_CACHE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('[DuplicateChecker] Error updating local cache:', e);
  }
}

/**
 * Mark a transaction as processed in local cache
 * @param {string} userId - Firebase user ID
 * @param {object} transaction - Parsed transaction
 */
export async function markProcessed(userId, transaction) {
  const signature = getTransactionSignature(transaction);
  await markProcessedLocally(signature);
}

export default {
  isDuplicate,
  markProcessed,
  getTransactionSignature
};

