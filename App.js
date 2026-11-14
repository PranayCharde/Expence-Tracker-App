import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForPushNotificationsAsync, scheduleDailyWalletReminder } from './src/services/notificationService';
import { startSmsTrackingService, stopSmsTrackingService } from './src/modules/smsTracking';

const RootContent = () => {
  const { isDarkMode } = useSettings();
  const { user } = useAuth();

  useEffect(() => {
    // Request permission & setup notifications on app start
    registerForPushNotificationsAsync();
    scheduleDailyWalletReminder(21, 0); // 9:00 PM daily wallet recount reminder
  }, []);

  useEffect(() => {
    if (user) {
      startSmsTrackingService(user);
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
