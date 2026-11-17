import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigate } from './src/navigation/navigationRef';
import { registerForPushNotificationsAsync, scheduleDailyWalletReminder } from './src/services/notificationService';
import { 
  startSmsTrackingService, 
  stopSmsTrackingService, 
  checkSmsPermissions, 
  requestSmsPermissions,
  syncRecentSms
} from './src/modules/smsTracking';

const RootContent = () => {
  const { isDarkMode } = useSettings();
  const { user } = useAuth();

  useEffect(() => {
    // Request permission & setup notifications on app start
    registerForPushNotificationsAsync();
    scheduleDailyWalletReminder(21, 0); // 9:00 PM daily wallet recount reminder

    // Listen for notification taps to open the new LoggedTransaction page
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data && data.transaction) {
          navigate('LoggedTransaction', { transaction: data.transaction });
        }
      } catch (err) {
        console.warn('Error handling notification tap:', err);
      }
    });

    return () => {
      if (notificationSubscription && typeof notificationSubscription.remove === 'function') {
        notificationSubscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (Platform.OS === 'android') {
        checkSmsPermissions().then(hasPerm => {
          if (!hasPerm) {
            // Prompt user with rationale to enable automatic tracking
            requestSmsPermissions(true).then((res) => {
              if (res === 'granted') {
                startSmsTrackingService(user);
                syncRecentSms(user, 25);
              }
            });
          } else {
            startSmsTrackingService(user);
            syncRecentSms(user, 25);
          }
        });
      } else {
        startSmsTrackingService(user);
      }
    } else {
      stopSmsTrackingService();
    }
    return () => {
      stopSmsTrackingService();
    };
  }, [user]);

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <RootContent />
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
