import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User, Moon, Sun, Globe, Clock, LogOut, ShieldCheck, ChevronRight, 
  Sparkles, Bell, BellRing, MessageSquare, CheckCircle2, AlertCircle, 
  PlayCircle, Smartphone, ArrowDownLeft, ArrowUpRight 
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { CURRENCIES } from '../../config/constants';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { sendInstantNotification, scheduleDailyWalletReminder, cancelDailyReminder } from '../../services/notificationService';
import { 
  checkSmsPermissions, 
  requestSmsPermissions, 
  isSmsTrackingEnabled, 
  setSmsTrackingEnabled, 
  getSmsTrackingStats,
  subscribeToSmsTrackingUpdates,
  startSmsTrackingService,
  stopSmsTrackingService,
  processRawSms 
} from '../../modules/smsTracking';

const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const { 
    currency, 
    symbol, 
    isDarkMode, 
    toggleDarkMode, 
    updateCurrency, 
    themeColors 
  } = useSettings();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [testingNotif, setTestingNotif] = useState(false);

  // SMS Tracking State
  const [smsTrackingActive, setSmsTrackingActive] = useState(false);
  const [smsPermissionStatus, setSmsPermissionStatus] = useState('checking'); // 'granted' | 'denied' | 'checking'
  const [totalDetected, setTotalDetected] = useState(0);
  const [lastDetected, setLastDetected] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    loadSmsSettings();

    // Subscribe to live tracking updates
    const unsubscribe = subscribeToSmsTrackingUpdates((data) => {
      if (data.totalDetected !== undefined) setTotalDetected(data.totalDetected);
      if (data.lastDetected !== undefined) setLastDetected(data.lastDetected);
    });

    return () => unsubscribe();
  }, [user]);

  const loadSmsSettings = async () => {
    try {
      const enabled = await isSmsTrackingEnabled();
      setSmsTrackingActive(enabled);

      const hasPerm = await checkSmsPermissions();
      setSmsPermissionStatus(hasPerm ? 'granted' : 'denied');

      const stats = await getSmsTrackingStats();
      setTotalDetected(stats.totalDetected);
      setLastDetected(stats.lastDetected);
    } catch (e) {
      console.warn('Error loading SMS settings:', e);
    }
  };

  const handleToggleSmsTracking = async (enabled) => {
    if (enabled) {
      if (Platform.OS !== 'android') {
        Alert.alert(
          'Android Only Feature',
          'Automatic SMS transaction tracking uses Android SMS Broadcast Receiver and is not supported on iOS or Web.'
        );
        return;
      }

      const hasPerm = await checkSmsPermissions();
      if (!hasPerm) {
        const permResult = await requestSmsPermissions(true);
        if (permResult !== 'granted') {
          Alert.alert(
            'SMS Permission Required',
            'SpendWise needs SMS permission to detect transaction messages from Indian banks. You can enable it in Android Settings.'
          );
          setSmsTrackingActive(false);
          await setSmsTrackingEnabled(false);
          setSmsPermissionStatus('denied');
          return;
        }
      }

      setSmsTrackingActive(true);
      setSmsPermissionStatus('granted');
      await setSmsTrackingEnabled(true);
      if (user) {
        await startSmsTrackingService(user);
      }
      Alert.alert('Auto Tracking Enabled', 'SpendWise is now monitoring incoming bank SMS for transactions.');
    } else {
      setSmsTrackingActive(false);
      await setSmsTrackingEnabled(false);
      stopSmsTrackingService();
      Alert.alert('Auto Tracking Disabled', 'Automatic SMS transaction monitoring has been turned off.');
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestSmsPermissions(true);
    setSmsPermissionStatus(result === 'granted' ? 'granted' : 'denied');
    if (result === 'granted' && smsTrackingActive && user) {
      startSmsTrackingService(user);
    }
  };

  const handleSimulateSampleSms = async (type) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to test transaction tracking.');
      return;
    }

    setSimulating(true);
    try {
      let sampleSms = '';
      let sampleSender = 'AD-HDFCBK';

      if (type === 'upi_expense') {
        sampleSms = `Dear Customer, Rs.500.00 debited from A/C **1234 on ${new Date().toLocaleDateString('en-GB')} to VPA swiggy@icici (UPI Ref ${Math.floor(100000000000 + Math.random() * 900000000000)}). Avail Bal: Rs.10,250.00`;
        sampleSender = 'AD-HDFCBK';
      } else if (type === 'upi_income') {
        sampleSms = `Dear SBI User, your A/C ending with 4321 credited by Rs 2,000.00 on ${new Date().toLocaleDateString('en-GB')} via UPI/P2A/${Math.floor(100000000000 + Math.random() * 900000000000)}/John Doe. Bal: Rs 15,000.00`;
        sampleSender = 'VK-SBIINB';
      } else if (type === 'salary') {
        sampleSms = `Rs. 85,000.00 credited to your A/C XX9999 on ${new Date().toLocaleDateString('en-GB')} by Salary/TechCorp Payroll (Ref ${Math.floor(100000000000 + Math.random() * 900000000000)}). Bal: Rs. 92,000.`;
        sampleSender = 'BP-ICICIB';
      } else if (type === 'otp') {
        sampleSms = `123456 is your secret OTP for ICICI Bank NetBanking login. Valid for 10 mins. Do not share with anyone.`;
        sampleSender = 'BP-ICICIB';
      }

      const res = await processRawSms(sampleSms, sampleSender, Date.now(), user);
      if (res.success) {
        Alert.alert(
          '✅ Transaction Auto-Recorded!',
          `Amount: ${res.transaction.amount > 0 ? '+' : ''}${res.transaction.amount}\nCategory: ${res.transaction.category}\nMerchant: ${res.transaction.description}\n\nCheck your Dashboard or Transactions tab!`
        );
      } else {
        Alert.alert('SMS Filter Result', `Message was safely filtered out.\nReason: ${res.reason}`);
      }
    } catch (e) {
      Alert.alert('Simulation Error', e.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleToggleReminder = async (enabled) => {
    setDailyReminderEnabled(enabled);
    if (enabled) {
      await scheduleDailyWalletReminder(21, 0);
      Alert.alert('Reminder Enabled', 'Daily 9:00 PM wallet check reminder is active.');
    } else {
      await cancelDailyReminder();
      Alert.alert('Reminder Disabled', 'Daily 9:00 PM reminder turned off.');
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    try {
      await sendInstantNotification(
        '🎉 SpendWise Notification',
        'Expo notifications are working properly on your device!'
      );
      Alert.alert('Notification Dispatched', 'Check your notification shade or banner!');
    } catch (e) {
      Alert.alert('Error', 'Could not send test notification.');
    } finally {
      setTestingNotif(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of SpendWise?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              stopSmsTrackingService();
              await logout();
            } catch (err) {
              console.error("Logout error:", err);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Preferences, currency, theme, and profile
          </Text>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.avatarText}>
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: themeColors.textPrimary }]}>
              {user?.displayName || 'SpendWise User'}
            </Text>
            <Text style={styles.profileEmail}>{user?.email || 'Logged in'}</Text>
            <View style={styles.verifiedRow}>
              <ShieldCheck size={13} color={colors.primary} />
              <Text style={styles.verifiedText}>Firebase Sync Active</Text>
            </View>
          </View>
        </Card>

        {/* AUTO TRANSACTION TRACKING SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>AUTO TRANSACTION TRACKING</Text>
            <View style={styles.autoBadge}>
              <Sparkles size={11} color={colors.primary} />
              <Text style={styles.autoBadgeText}>Smart AI</Text>
            </View>
          </View>

          {/* Enable / Disable Tracking Switch */}
          <Card style={styles.settingItemCard}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
                <Smartphone size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Auto SMS Tracking</Text>
                <Text style={styles.settingDesc}>Detect UPI, Card & NetBanking SMS automatically</Text>
              </View>
            </View>
            <Switch
              value={smsTrackingActive}
              onValueChange={handleToggleSmsTracking}
              trackColor={{ false: '#cbd5e1', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </Card>

          {/* SMS Permission Status Card */}
          <Card style={styles.settingItemCard}>
            <View style={styles.settingLeft}>
              <View style={[
                styles.iconBox, 
                { backgroundColor: smsPermissionStatus === 'granted' ? '#f0fdf4' : '#fffbeb' }
              ]}>
                {smsPermissionStatus === 'granted' ? (
                  <CheckCircle2 size={18} color={colors.primary} />
                ) : (
                  <AlertCircle size={18} color="#d97706" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>SMS Permissions</Text>
                <Text style={styles.settingDesc}>
                  {smsPermissionStatus === 'granted' 
                    ? 'RECEIVE_SMS & READ_SMS Active' 
                    : 'Permission needed for background tracking'}
                </Text>
              </View>
            </View>
            {smsPermissionStatus === 'granted' ? (
              <View style={styles.statusPillSuccess}>
                <Text style={styles.statusPillTextSuccess}>Granted</Text>
              </View>
            ) : (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleRequestPermission}
                style={styles.statusPillWarning}
              >
                <Text style={styles.statusPillTextWarning}>Grant Now</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Tracking Stats & Last Detected Transaction Card */}
          <Card style={styles.statsCard}>
            <View style={styles.statsTopRow}>
              <View>
                <Text style={styles.statsLabel}>TOTAL DETECTED</Text>
                <Text style={[styles.statsCount, { color: themeColors.textPrimary }]}>
                  {totalDetected} <Text style={styles.statsSubUnit}>transactions</Text>
                </Text>
              </View>
              <View style={styles.detectionShield}>
                <ShieldCheck size={16} color={colors.primary} />
                <Text style={styles.detectionShieldText}>Privacy Protected</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: themeColors.border || '#f1f5f9' }]} />

            <View>
              <Text style={styles.statsLabel}>LAST DETECTED TRANSACTION</Text>
              {lastDetected ? (
                <View style={styles.lastTxContainer}>
                  <View style={[
                    styles.txIconCircle, 
                    { backgroundColor: lastDetected.type === 'credit' ? '#dcfce7' : '#fee2e2' }
                  ]}>
                    {lastDetected.type === 'credit' ? (
                      <ArrowDownLeft size={16} color="#16a34a" />
                    ) : (
                      <ArrowUpRight size={16} color="#dc2626" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lastTxTitle, { color: themeColors.textPrimary }]}>
                      {lastDetected.merchant} • {lastDetected.category}
                    </Text>
                    <Text style={styles.lastTxMeta}>
                      {lastDetected.bank} • {lastDetected.date}
                    </Text>
                  </View>
                  <Text style={[
                    styles.lastTxAmount,
                    { color: lastDetected.type === 'credit' ? '#16a34a' : '#dc2626' }
                  ]}>
                    {lastDetected.type === 'credit' ? '+' : '-'}₹{lastDetected.amount}
                  </Text>
                </View>
              ) : (
                <Text style={styles.emptyLastTxText}>No bank transactions detected yet</Text>
              )}
            </View>
          </Card>

          {/* Test & Simulation Buttons */}
          <View style={styles.simulationContainer}>
            <Text style={styles.simLabel}>TEST SMS DETECTION ENGINES</Text>
            <View style={styles.simButtonsRow}>
              <TouchableOpacity
                style={[styles.simBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
                disabled={simulating}
                onPress={() => handleSimulateSampleSms('upi_expense')}
              >
                <Text style={[styles.simBtnText, { color: '#065f46' }]}>₹500 Swiggy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                disabled={simulating}
                onPress={() => handleSimulateSampleSms('upi_income')}
              >
                <Text style={[styles.simBtnText, { color: '#1e40af' }]}>+₹2,000 UPI</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simBtn, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
                disabled={simulating}
                onPress={() => handleSimulateSampleSms('salary')}
              >
                <Text style={[styles.simBtnText, { color: '#92400e' }]}>+Salary Credit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                disabled={simulating}
                onPress={() => handleSimulateSampleSms('otp')}
              >
                <Text style={[styles.simBtnText, { color: '#475569' }]}>OTP Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>App Preferences</Text>

          {/* Dark Mode Card */}
          <Card style={styles.settingItemCard}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                {isDarkMode ? (
                  <Moon size={18} color="#f8fafc" />
                ) : (
                  <Sun size={18} color="#eab308" />
                )}
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Dark Mode</Text>
                <Text style={styles.settingDesc}>Easy on the eyes in low light</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#cbd5e1', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </Card>

          {/* Currency Selection */}
          <Card style={styles.settingItemCardColumn}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryMuted }]}>
                <Globe size={18} color={colors.primaryDark} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Base Currency</Text>
                <Text style={styles.settingDesc}>Currently set to {currency} ({symbol})</Text>
              </View>
            </View>

            <View style={styles.currencyPills}>
              {CURRENCIES.map(c => {
                const isSelected = currency === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => updateCurrency(c.code)}
                    style={[
                      styles.currencyPill,
                      { borderColor: isSelected ? colors.primary : themeColors.border },
                      isSelected && { backgroundColor: colors.primaryMuted }
                    ]}
                  >
                    <Text style={[
                      styles.currencyPillText,
                      { color: isSelected ? colors.primaryDark : themeColors.textSecondary },
                      isSelected && { fontWeight: '900' }
                    ]}>
                      {c.symbol} {c.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Time Zone Indicator */}
          <Card style={styles.settingItemCard}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                <Clock size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Default Timezone</Text>
                <Text style={styles.settingDesc}>Asia/Kolkata (GMT+5:30) India</Text>
              </View>
            </View>
            <Text style={styles.badgeLabel}>IST</Text>
          </Card>
        </View>

        {/* Notifications & Reminders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>Notifications & Alerts</Text>

          {/* Instant Transaction Alerts */}
          <Card style={styles.settingItemCard}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
                <Bell size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Transaction Alerts</Text>
                <Text style={styles.settingDesc}>Instant notifications for cash & online expenses</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#cbd5e1', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </Card>

          {/* Daily 9 PM Wallet Recount Reminder */}
          <Card style={styles.settingItemCard}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                <Clock size={18} color="#b45309" />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Daily Wallet Check</Text>
                <Text style={styles.settingDesc}>Reminder at 9:00 PM to recount wallet cash</Text>
              </View>
            </View>
            <Switch
              value={dailyReminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: '#cbd5e1', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </Card>

          {/* Send Test Notification Button */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleTestNotification}
            disabled={testingNotif}
            style={[styles.testNotifBtn, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
          >
            <BellRing size={16} color={colors.primary} />
            <Text style={[styles.testNotifBtnText, { color: colors.primary }]}>
              {testingNotif ? 'Sending Notification...' : 'Send Test Notification'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleLogout}
          style={styles.logoutBtn}
        >
          <LogOut size={18} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Sign Out of SpendWise</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>SpendWise Mobile App • v1.0.0</Text>
          <Text style={styles.appSyncText}>Connected to Firebase Firestore & Storage</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '900',
  },
  profileEmail: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
  },
  settingItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingItemCardColumn: {
    padding: 16,
    gap: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  settingDesc: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  statusPillSuccess: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusPillTextSuccess: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  statusPillWarning: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusPillTextWarning: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d97706',
  },
  statsCard: {
    padding: 16,
    gap: 12,
  },
  statsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statsCount: {
    fontSize: 20,
    fontWeight: '900',
  },
  statsSubUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  detectionShield: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detectionShieldText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  divider: {
    height: 1,
  },
  lastTxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  txIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastTxTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  lastTxMeta: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  lastTxAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyLastTxText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 2,
  },
  simulationContainer: {
    gap: 6,
    marginTop: 2,
  },
  simLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  simButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  simBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  simBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  currencyPills: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 4,
  },
  testNotifBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 6,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ef4444',
  },
  appInfo: {
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
  },
  appVersion: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  appSyncText: {
    fontSize: 10,
    color: '#cbd5e1',
  },
});

export default SettingsScreen;
