/**
 * SMS Tracking Orchestrator Service
 * Connects native SMS receiver with parsing, duplicate checking, Firestore persistence, and notifications.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import { safeGetItem, safeSetItem } from '../../utils/safeStorage.js';
import { notifyTransaction } from '../../services/notificationService.js';
import { isSmsDetectorAvailable, addSmsListener, startSmsListener, stopSmsListener, getRecentSms } from '../../../modules/expo-sms-detector/index.js';

import { isFinancialSms } from './transactionDetector.js';
import { parseSms } from './smsParser.js';
import { validateTransaction } from './transactionValidator.js';
import { isDuplicate, markProcessed } from './duplicateChecker.js';
import { categorizeTransaction } from './transactionCategorizer.js';
import { checkSmsPermissions, isSmsTrackingEnabled } from './smsPermissions.js';

const LAST_DETECTED_TX_KEY = 'spendwise_last_sms_tx';
const TOTAL_DETECTED_COUNT_KEY = 'spendwise_total_sms_detected_count';

let activeSmsSubscription = null;
let currentUser = null;
const stateChangeListeners = new Set();

/**
 * Register a listener for tracking stats changes (for UI updates)
 */
export function subscribeToSmsTrackingUpdates(callback) {
  stateChangeListeners.add(callback);
  return () => stateChangeListeners.delete(callback);
}

function notifyStateChange(data) {
  stateChangeListeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn('Error in SMS tracking update listener:', e);
    }
  });
}

/**
 * Get tracking statistics for Settings screen
 */
export async function getSmsTrackingStats() {
  const countStr = await safeGetItem(TOTAL_DETECTED_COUNT_KEY);
  const lastTxStr = await safeGetItem(LAST_DETECTED_TX_KEY);

  let lastTx = null;
  try {
    if (lastTxStr) lastTx = JSON.parse(lastTxStr);
  } catch (e) {
    lastTx = null;
  }

  return {
    totalDetected: parseInt(countStr || '0', 10),
    lastDetected: lastTx
  };
}

/**
 * Core processor for a raw SMS (called by native module or simulation test)
 * @param {string} body - Raw SMS text
 * @param {string} sender - Sender ID (e.g. AD-HDFCBK)
 * @param {number} timestamp - Epoch timestamp
 * @param {object} user - Active Firebase user object
 * @returns {Promise<{ success: boolean, reason?: string, transaction?: object }>}
 */
export async function processRawSms(body, sender = '', timestamp = Date.now(), user = currentUser) {
  if (!user || !user.uid) {
    return { success: false, reason: 'No active user logged in' };
  }

  // 1. Detect if financial SMS
  const detection = isFinancialSms(body, sender);
  if (!detection.isEligible) {
    return { success: false, reason: detection.reason };
  }

  // 2. Parse SMS
  const parsed = parseSms(body, sender, timestamp);

  // 3. Validate extracted fields
  const validation = validateTransaction(parsed);
  if (!validation.isValid) {
    return { success: false, reason: validation.error };
  }

  // 4. Duplicate Check
  const duplicate = await isDuplicate(user.uid, parsed);
  if (duplicate) {
    return { success: false, reason: 'Duplicate transaction already recorded' };
  }

  // 5. Auto-categorize
  const category = categorizeTransaction(parsed);

  // 6. Persist to existing SpendWise Firestore transactions collection
  const isExpense = parsed.type === 'debit';
  const txAmount = isExpense ? -Math.abs(parsed.amount) : Math.abs(parsed.amount);
  const description = `${parsed.merchant} (${parsed.bank})`;

  try {
    const docRef = await addDoc(collection(db, 'users', user.uid, 'transactions'), {
      amount: txAmount,
      category: category,
      description: description,
      paymentMethod: parsed.paymentMethod,
      date: parsed.date,
      createdAt: serverTimestamp(),
      receiptUrl: null,
      smsReferenceId: parsed.referenceId,
      bank: parsed.bank,
      accountMask: parsed.accountMask,
      source: 'sms_auto_detected'
    });

    // 7. Mark as processed in duplicate cache
    await markProcessed(user.uid, parsed);

    // 8. Fire instant local push notification
    notifyTransaction({
      type: isExpense ? 'expense' : 'income',
      amount: parsed.amount,
      category: category,
      paymentMethod: parsed.paymentMethod
    });

    // 9. Update stats for UI
    const currentStats = await getSmsTrackingStats();
    const newCount = currentStats.totalDetected + 1;
    const lastDetectedSummary = {
      id: docRef.id,
      amount: parsed.amount,
      type: parsed.type,
      category: category,
      merchant: parsed.merchant,
      bank: parsed.bank,
      date: parsed.date
    };

    await safeSetItem(TOTAL_DETECTED_COUNT_KEY, newCount.toString());
    await safeSetItem(LAST_DETECTED_TX_KEY, JSON.stringify(lastDetectedSummary));

    notifyStateChange({
      totalDetected: newCount,
      lastDetected: lastDetectedSummary
    });

    return {
      success: true,
      transaction: {
        id: docRef.id,
        amount: txAmount,
        category,
        description,
        paymentMethod: parsed.paymentMethod,
        date: parsed.date
      }
    };
  } catch (err) {
    console.error('[SmsService] Failed to save auto-detected transaction:', err);
    return { success: false, reason: `Database error: ${err.message}` };
  }
}

/**
 * Initialize and start the SMS monitoring service
 * @param {object} user - Active Firebase user
 */
export async function startSmsTrackingService(user) {
  currentUser = user;
  if (!user) return;

  const isEnabled = await isSmsTrackingEnabled();
  if (!isEnabled) {
    console.log('[SmsService] Tracking is disabled by user settings.');
    return;
  }

  const hasPermission = await checkSmsPermissions();
  if (!hasPermission) {
    console.log('[SmsService] SMS permissions not granted.');
    return;
  }

  if (activeSmsSubscription) {
    activeSmsSubscription.remove();
    activeSmsSubscription = null;
  }

  startSmsListener();

  activeSmsSubscription = addSmsListener(async (smsEvent) => {
    try {
      const { sender, body, timestamp } = smsEvent;
      await processRawSms(body, sender, timestamp, currentUser);
    } catch (err) {
      console.error('[SmsService] Error processing incoming native SMS event:', err);
    }
  });

  console.log('[SmsService] Automatic SMS tracking service started successfully.');
}

/**
 * Stop the SMS monitoring service
 */
export function stopSmsTrackingService() {
  if (activeSmsSubscription) {
    activeSmsSubscription.remove();
    activeSmsSubscription = null;
  }
  stopSmsListener();
  console.log('[SmsService] Automatic SMS tracking service stopped.');
}

/**
 * Scan recent SMS messages from device inbox (e.g. on app launch or refresh)
 * Catches any transactions that arrived while the app was closed.
 * @param {object} user - Active Firebase user
 * @param {number} limit - Number of recent SMS messages to scan
 * @returns {Promise<{ synced: number, checked: number }>}
 */
export async function syncRecentSms(user = currentUser, limit = 25) {
  if (!user || !user.uid) return { synced: 0, checked: 0 };

  const isEnabled = await isSmsTrackingEnabled();
  if (!isEnabled) return { synced: 0, checked: 0 };

  const hasPerm = await checkSmsPermissions();
  if (!hasPerm) return { synced: 0, checked: 0 };

  try {
    const messages = await getRecentSms(limit);
    let count = 0;
    for (const msg of messages) {
      if (msg.body) {
        const result = await processRawSms(msg.body, msg.sender || '', msg.timestamp || Date.now(), user);
        if (result.success) {
          count++;
        }
      }
    }
    console.log(`[SmsService] Inbox sync complete: ${count} new transactions logged out of ${messages.length} checked.`);
    return { synced: count, checked: messages.length };
  } catch (err) {
    console.warn('[SmsService] Error during inbox SMS sync:', err);
    return { synced: 0, checked: 0 };
  }
}

export default {
  startSmsTrackingService,
  stopSmsTrackingService,
  processRawSms,
  getSmsTrackingStats,
  subscribeToSmsTrackingUpdates,
  syncRecentSms
};

