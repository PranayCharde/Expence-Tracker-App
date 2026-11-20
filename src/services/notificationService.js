import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Configure how notifications appear when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and create Android notification channel
 * Optionally stores the FCM and Expo push tokens to Firestore for the user.
 * @param {string|null} userId - Active Firebase User ID
 * @returns {Promise<{ expoPushToken: string|null, fcmToken: string|null }>}
 */
export const registerForPushNotificationsAsync = async (userId = null) => {
  let expoPushToken = null;
  let fcmToken = null;
  let statusMessage = '';

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('spendwise_alerts', {
        name: 'SpendWise Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('spendwise_reminders', {
        name: 'SpendWise Daily Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        enableVibrate: true,
      });
    } catch (channelErr) {
      console.log('[NotificationService] Android notification channel setup skipped:', channelErr?.message);
    }
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Notification permission not granted.');
      return { 
        success: false, 
        expoPushToken: null, 
        fcmToken: null, 
        message: 'Notification permission denied by user.' 
      };
    }

    // 1. Get Expo Push Token (with EAS project ID)
    try {
      const pushRes = await Notifications.getExpoPushTokenAsync({
        projectId: 'de0647aa-500a-4ea5-8876-39aa96d17ae2'
      });
      expoPushToken = pushRes?.data || null;
    } catch (e) {
      console.log('[NotificationService] Expo Push Token notice:', e?.message);
    }

    // 2. Get Native Firebase Cloud Messaging (FCM) Device Push Token (Android)
    try {
      if (Platform.OS === 'android') {
        const nativeDeviceTokenRes = await Notifications.getDevicePushTokenAsync();
        fcmToken = nativeDeviceTokenRes?.data || null;
      }
    } catch (fcmErr) {
      console.log('[NotificationService] Native FCM Device Token notice:', fcmErr?.message);
    }

    // 3. Persist tokens in Firestore for targeted Firebase Cloud Messaging
    if (userId && (expoPushToken || fcmToken)) {
      try {
        await setDoc(doc(db, 'users', userId), {
          pushToken: expoPushToken || null,
          fcmToken: fcmToken || null,
          fcmPlatform: Platform.OS,
          lastTokenUpdate: serverTimestamp()
        }, { merge: true });
        console.log('[NotificationService] FCM/Push tokens synced to Firestore for user:', userId);
        statusMessage = 'Tokens synced to Firestore';
      } catch (firestoreErr) {
        console.warn('[NotificationService] Could not persist push token to Firestore:', firestoreErr?.message);
        statusMessage = `Firestore sync error: ${firestoreErr.message}`;
      }
    }

    return { 
      success: true, 
      expoPushToken, 
      fcmToken, 
      message: statusMessage || 'Push notifications registered' 
    };
  } catch (err) {
    console.warn('[NotificationService] Registration error:', err?.message);
    return { 
      success: false, 
      expoPushToken: null, 
      fcmToken: null, 
      message: err?.message || 'Error registering for push notifications' 
    };
  }
};

/**
 * Send an immediate local notification
 */
export const sendInstantNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        color: '#059669',
        channelId: 'spendwise_alerts',
      },
      trigger: null, // null means trigger immediately
    });
  } catch (err) {
    console.warn('Failed to send instant notification:', err);
  }
};

/**
 * Send notification when spending or adding cash
 */
export const notifyTransaction = async ({ type, amount, category, paymentMethod, walletBalance, transaction }) => {
  const isCash = paymentMethod === 'Cash';
  const isCcBill = /credit\s*card\s*bill/i.test(transaction?.description || '') || (category === 'Utilities' && paymentMethod === 'Card');
  const formattedAmount = `₹${Math.abs(amount).toFixed(2)}`;

  let title = '';
  let body = '';

  if (isCcBill) {
    title = '💳 Credit Card Bill Paid';
    body = `Paid ${formattedAmount} towards credit card bill. Recorded as an expense.`;
  } else if (type === 'income') {
    title = isCash ? '💰 Cash Added to Wallet' : '📈 Income Received';
    body = isCash
      ? `Added ${formattedAmount} to physical wallet. Balance: ₹${walletBalance?.toFixed(2) || '0.00'}`
      : `Received ${formattedAmount} (${category})`;
  } else {
    title = isCash ? '💸 Cash Spent from Wallet' : '💳 Expense Logged';
    body = isCash
      ? `Spent ${formattedAmount} on ${category}. Remaining wallet cash: ₹${walletBalance?.toFixed(2) || '0.00'}`
      : `Spent ${formattedAmount} on ${category} via ${paymentMethod || 'Online'}`;
  }

  const payload = { 
    type, 
    amount, 
    isCash,
    transaction: transaction || {
      amount: type === 'income' ? Math.abs(amount) : -Math.abs(amount),
      category,
      paymentMethod,
      description: transaction?.description || (isCcBill ? 'Credit Card Bill Payment' : `${category} via ${paymentMethod}`),
      date: new Date().toISOString().split('T')[0]
    }
  };

  await sendInstantNotification(title, body, payload);
};

/**
 * Send a budget alert notification
 */
export const notifyBudgetWarning = async (category, percentSpent, limit) => {
  const title = `⚠️ ${category} Budget Warning (${percentSpent}%)`;
  const body = `You have spent ${percentSpent}% of your ₹${limit} limit for ${category}.`;
  await sendInstantNotification(title, body, { category, percentSpent });
};

/**
 * Schedule a daily 9:00 PM reminder to recount wallet and log expenses
 */
export const scheduleDailyWalletReminder = async (hour = 21, minute = 0) => {
  try {
    // Cancel existing reminder first to prevent duplicates
    await cancelDailyReminder();

    const triggerInput = {
      type: Notifications.SchedulableTriggerInputTypes?.DAILY || 'daily',
      hour,
      minute,
      channelId: 'spendwise_reminders',
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💼 SpendWise Daily Wallet Check',
        body: "Take 10 seconds to recount your physical wallet & log today's cash transactions!",
        channelId: 'spendwise_reminders',
      },
      trigger: triggerInput,
    });
  } catch (err) {
    console.warn('Failed to schedule daily reminder:', err);
  }
};

/**
 * Cancel the scheduled daily reminder
 */
export const cancelDailyReminder = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.title?.includes('Daily Wallet Check')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (err) {
    console.warn('Failed to cancel reminders:', err);
  }
};

