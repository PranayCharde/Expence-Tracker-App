import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { safeGetItem, safeSetItem } from '../../utils/safeStorage';

const SMS_TRACKING_ENABLED_KEY = 'spendwise_sms_tracking_enabled';
const SMS_PERMISSION_STATUS_KEY = 'spendwise_sms_permission_status';

/**
 * Check if SMS permissions are currently granted on Android
 * @returns {Promise<boolean>}
 */
export async function checkSmsPermissions() {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const receiveGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    );
    const readGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    const isGranted = receiveGranted && readGranted;
    await safeSetItem(SMS_PERMISSION_STATUS_KEY, isGranted ? 'granted' : 'denied');
    return isGranted;
  } catch (error) {
    console.error('[SMS Permissions] Error checking permissions:', error);
    return false;
  }
}

/**
 * Request SMS permissions with proper user disclosure and rationale
 * @param {boolean} showRationaleDialog Whether to prompt rationale first
 * @returns {Promise<'granted' | 'denied' | 'never_ask_again' | 'unsupported'>}
 */
export async function requestSmsPermissions(showRationaleDialog = true) {
  if (Platform.OS !== 'android') {
    return 'unsupported';
  }

  const executeRequest = async () => {
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);

      const receiveStatus = results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS];
      const readStatus = results[PermissionsAndroid.PERMISSIONS.READ_SMS];

      const allGranted =
        receiveStatus === PermissionsAndroid.RESULTS.GRANTED &&
        readStatus === PermissionsAndroid.RESULTS.GRANTED;

      const finalStatus = allGranted ? 'granted' : 'denied';
      await safeSetItem(SMS_PERMISSION_STATUS_KEY, finalStatus);
      return finalStatus;
    } catch (error) {
      console.error('[SMS Permissions] Error requesting permissions:', error);
      return 'denied';
    }
  };

  if (showRationaleDialog) {
    return new Promise((resolve) => {
      Alert.alert(
        'Automatic SMS Tracking',
        'SpendWise requires permission to detect incoming financial SMS from your bank to automatically record expenses & income. We NEVER read or store OTPs or personal messages.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve('denied'),
          },
          {
            text: 'Allow Permission',
            onPress: async () => {
              const res = await executeRequest();
              resolve(res);
            },
          },
        ]
      );
    });
  }

  return executeRequest();
}

/**
 * Get tracking toggle state from safe storage
 * @returns {Promise<boolean>}
 */
export async function isSmsTrackingEnabled() {
  const value = await safeGetItem(SMS_TRACKING_ENABLED_KEY);
  return value === 'true';
}

/**
 * Set tracking toggle state in safe storage
 * @param {boolean} enabled
 */
export async function setSmsTrackingEnabled(enabled) {
  await safeSetItem(SMS_TRACKING_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Get cached permission status
 * @returns {Promise<'granted' | 'denied' | 'undetermined'>}
 */
export async function getCachedPermissionStatus() {
  const status = await safeGetItem(SMS_PERMISSION_STATUS_KEY);
  return status || 'undetermined';
}

