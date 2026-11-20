import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../config/firebase';

/**
 * Designated SuperAdmin Configuration
 * Restricted credentials for platform administration and push broadcasts.
 * Protected from public visibility.
 */
export const ADMIN_CONFIG = {
  authorizedEmails: [
    'pranay.admin@gmail.com',
    'test@gmail.com'
  ],
  masterPassword: 'pranay13'
};

// In-memory admin session state (resets on app close)
let isSuperAdminUnlocked = false;
let currentAdminIdentity = null;

export const setAdminSessionActive = (active, identity = null) => {
  isSuperAdminUnlocked = !!active;
  currentAdminIdentity = active ? identity : null;
};

export const getAdminSessionStatus = () => {
  return {
    isUnlocked: isSuperAdminUnlocked,
    adminIdentity: currentAdminIdentity
  };
};

/**
 * Check if an email address is on the designated Admin list
 */
export const isAuthorizedAdminEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === 'pranay.admin@gmail.com' ||
    normalized === 'test@gmail.com' ||
    ADMIN_CONFIG.authorizedEmails.some(ae => ae.toLowerCase() === normalized)
  );
};

/**
 * Verify Admin credentials (both master passkey and Firebase Auth)
 */
export const verifyAdminCredentials = async (email, password) => {
  if (!email || !password) {
    return { success: false, message: 'Please enter both admin email and password.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  // 1. Password check: supports 'pranay13' and 'Pranay13'
  const isPasswordMatch = 
    cleanPass === 'pranay13' || 
    cleanPass.toLowerCase() === 'pranay13' ||
    cleanPass === ADMIN_CONFIG.masterPassword;

  // 2. Email check: supports 'pranay.admin@gmail.com', 'test@gmail.com', etc.
  const isEmailMatch = isAuthorizedAdminEmail(cleanEmail);

  if (isEmailMatch && isPasswordMatch) {
    setAdminSessionActive(true, cleanEmail);
    return { 
      success: true, 
      method: 'master_passkey', 
      email: cleanEmail 
    };
  }

  // If master password didn't match directly, attempt live Firebase Auth sign-in
  if (isEmailMatch) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (userCredential?.user) {
        setAdminSessionActive(true, cleanEmail);
        return { 
          success: true, 
          method: 'firebase_auth', 
          email: cleanEmail 
        };
      }
    } catch (authErr) {
      console.log('[AdminService] Firebase auth fallback error:', authErr?.message);
    }

    return { 
      success: false, 
      message: 'Access Denied: Incorrect administrator password.' 
    };
  }

  return { 
    success: false, 
    message: 'Access Denied: This email is not recognized as an authorized Administrator.' 
  };
};

/**
 * Fetch high-level platform statistics for the Admin Panel
 */
export const fetchAdminStats = async () => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let totalUsers = 0;
    let usersWithTokens = 0;
    let totalCashBalance = 0;

    usersSnap.forEach((docSnap) => {
      totalUsers++;
      const data = docSnap.data();
      if (data.pushToken || data.fcmToken) {
        usersWithTokens++;
      }
      if (data.physicalWallet && typeof data.physicalWallet.amount === 'number') {
        totalCashBalance += data.physicalWallet.amount;
      }
    });

    let totalBroadcasts = 0;
    try {
      const broadcastsSnap = await getDocs(collection(db, 'broadcasts'));
      totalBroadcasts = broadcastsSnap.size;
    } catch (_) {}

    return {
      success: true,
      totalUsers,
      usersWithTokens,
      totalCashBalance,
      totalBroadcasts
    };
  } catch (error) {
    console.error('[AdminService] fetchAdminStats error:', error);
    return {
      success: false,
      totalUsers: 0,
      usersWithTokens: 0,
      totalCashBalance: 0,
      totalBroadcasts: 0,
      error: error.message
    };
  }
};

/**
 * Fetch all registered users with their push tokens and metadata
 */
export const fetchAllUsers = async () => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = [];

    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        email: data.email || 'No email',
        displayName: data.displayName || 'SpendWise User',
        currency: data.currency || 'INR',
        pushToken: data.pushToken || null,
        fcmToken: data.fcmToken || null,
        hasToken: !!(data.pushToken || data.fcmToken),
        walletAmount: data.physicalWallet?.amount || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || null,
        lastTokenUpdate: data.lastTokenUpdate?.toDate ? data.lastTokenUpdate.toDate().toISOString() : null,
      });
    });

    return { success: true, users };
  } catch (error) {
    console.error('[AdminService] fetchAllUsers error:', error);
    return { success: false, users: [], error: error.message };
  }
};

/**
 * Send a remote push notification to an array of Expo push tokens
 * via Expo's official HTTP Push API: https://exp.host/--/api/v2/push/send
 */
export const sendExpoPushNotification = async (tokens, { title, body, data = {} }) => {
  if (!tokens || tokens.length === 0) {
    return { success: false, message: 'No recipients provided.' };
  }

  // Filter valid Expo Push Tokens
  const validTokens = tokens.filter(
    (t) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
  );

  if (validTokens.length === 0) {
    return { 
      success: false, 
      message: 'None of the target users have an active Expo push token.' 
    };
  }

  // Construct batch notification payloads
  const messages = validTokens.map((to) => ({
    to,
    sound: 'default',
    title: title || 'SpendWise Notification',
    body: body || '',
    data: data || {},
    channelId: 'spendwise_alerts',
    priority: 'high',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return {
      success: true,
      sentCount: validTokens.length,
      totalRequested: tokens.length,
      result,
    };
  } catch (error) {
    console.error('[AdminService] Push API error:', error);
    return {
      success: false,
      sentCount: 0,
      error: error.message,
    };
  }
};

/**
 * Broadcast notification to ALL users in the database
 */
export const broadcastNotificationToAll = async ({ title, body, data = {}, adminEmail = 'Admin' }) => {
  try {
    const usersResult = await fetchAllUsers();
    if (!usersResult.success || usersResult.users.length === 0) {
      return { success: false, message: 'No registered users found in Firestore.' };
    }

    const tokens = usersResult.users
      .map((u) => u.pushToken)
      .filter((t) => !!t);

    if (tokens.length === 0) {
      return { 
        success: false, 
        message: 'No users currently have an active push token registered.' 
      };
    }

    const pushResult = await sendExpoPushNotification(tokens, { title, body, data });

    // Save broadcast audit log to Firestore
    try {
      await addDoc(collection(db, 'broadcasts'), {
        title,
        body,
        data,
        target: 'all',
        recipientCount: pushResult.sentCount || 0,
        adminEmail,
        sentAt: serverTimestamp(),
        status: pushResult.success ? 'delivered' : 'failed'
      });
    } catch (logErr) {
      console.warn('[AdminService] Could not write broadcast log:', logErr);
    }

    return pushResult;
  } catch (error) {
    console.error('[AdminService] broadcastNotificationToAll error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send direct notification to a single specific user
 */
export const sendDirectNotificationToUser = async ({ token, title, body, data = {}, adminEmail = 'Admin', userEmail = '' }) => {
  if (!token) {
    return { success: false, message: 'This user does not have a registered push token.' };
  }

  const pushResult = await sendExpoPushNotification([token], { title, body, data });

  try {
    await addDoc(collection(db, 'broadcasts'), {
      title,
      body,
      data,
      target: userEmail || 'single_user',
      recipientCount: pushResult.success ? 1 : 0,
      adminEmail,
      sentAt: serverTimestamp(),
      status: pushResult.success ? 'delivered' : 'failed'
    });
  } catch (logErr) {
    console.warn('[AdminService] Could not write broadcast log:', logErr);
  }

  return pushResult;
};

/**
 * Fetch broadcast history
 */
export const fetchBroadcastHistory = async (maxCount = 20) => {
  try {
    const q = query(
      collection(db, 'broadcasts'), 
      orderBy('sentAt', 'desc'), 
      limit(maxCount)
    );
    const snap = await getDocs(q);
    const history = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      history.push({
        id: docSnap.id,
        title: data.title || 'Untitled',
        body: data.body || '',
        target: data.target || 'all',
        recipientCount: data.recipientCount || 0,
        adminEmail: data.adminEmail || 'Admin',
        status: data.status || 'delivered',
        sentAt: data.sentAt?.toDate ? data.sentAt.toDate().toLocaleString() : 'Just now'
      });
    });

    return { success: true, history };
  } catch (error) {
    console.error('[AdminService] fetchBroadcastHistory error:', error);
    return { success: false, history: [], error: error.message };
  }
};

