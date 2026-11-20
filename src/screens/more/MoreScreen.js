import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Target, 
  PieChart, 
  Settings as SettingsIcon, 
  Wallet, 
  Smartphone, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  LogOut, 
  ChevronRight, 
  User, 
  ShieldCheck, 
  RefreshCw, 
  FileText,
  SlidersHorizontal,
  Sparkles,
  ShieldAlert
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Card from '../../components/common/Card';
import NewTransactionModal from '../../components/modals/NewTransactionModal';
import SpendCashModal from '../../components/modals/SpendCashModal';
import { syncRecentSms } from '../../modules/smsTracking';
import { isAuthorizedAdminEmail, getAdminSessionStatus } from '../../services/adminService';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';

const MoreScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { themeColors, isDarkMode, symbol } = useSettings();

  const [newTxModalOpen, setNewTxModalOpen] = useState(false);
  const [spendCashModalOpen, setSpendCashModalOpen] = useState(false);
  const [syncingInbox, setSyncingInbox] = useState(false);

  const isSuperAdmin = isAuthorizedAdminEmail(user?.email) || getAdminSessionStatus().isUnlocked;

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to sign out of SpendWise?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  const handleSyncInbox = async () => {
    if (!user) return;
    setSyncingInbox(true);
    try {
      const res = await syncRecentSms(user, 30);
      Alert.alert(
        'Inbox Scan Complete',
        `Scanned ${res.checked} SMS messages.\n\nLogged ${res.synced} new transaction(s) to SpendWise.`
      );
    } catch (e) {
      Alert.alert('Scan Failed', 'Could not scan SMS inbox: ' + e?.message);
    } finally {
      setSyncingInbox(false);
    }
  };

  const HUB_ITEMS = [
    {
      id: 'budgets',
      title: 'Monthly Budgets',
      subtitle: 'Set spending limits & track progress',
      icon: Target,
      color: '#3b82f6',
      bg: '#eff6ff',
      onPress: () => navigation.navigate('Budgets')
    },
    {
      id: 'reports',
      title: 'Financial Reports',
      subtitle: 'Visual charts, spending trends & breakdowns',
      icon: PieChart,
      color: '#8b5cf6',
      bg: '#f5f3ff',
      onPress: () => navigation.navigate('Reports')
    },
    {
      id: 'smsLog',
      title: 'SMS Transaction Log',
      subtitle: 'Auto-detected bank SMS & verification status',
      icon: Smartphone,
      color: colors.primary,
      bg: '#ecfdf5',
      onPress: () => navigation.navigate('SmsLog')
    },
    {
      id: 'cashWallet',
      title: 'Cash Wallet & Notes',
      subtitle: 'Manage physical bills (₹500, ₹200, ₹100, etc.)',
      icon: Wallet,
      color: '#f59e0b',
      bg: '#fef3c7',
      onPress: () => navigation.navigate('Cash')
    },
    {
      id: 'adminPanel',
      title: 'Admin Control Center',
      subtitle: isSuperAdmin 
        ? 'Broadcast notifications & full database access' 
        : 'Restricted • Admin Email & Password Required',
      icon: ShieldAlert,
      color: '#7c3aed',
      bg: '#f5f3ff',
      badge: isSuperAdmin ? 'ADMIN' : 'RESTRICTED',
      badgeBg: isSuperAdmin ? '#7c3aed' : '#64748b',
      onPress: () => navigation.navigate('AdminPanel')
    },
    {
      id: 'settings',
      title: 'Settings & Security',
      subtitle: 'Currency, Dark Theme, SMS permissions & profile',
      icon: SettingsIcon,
      color: '#64748b',
      bg: '#f1f5f9',
      onPress: () => navigation.navigate('Settings')
    }
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border, backgroundColor: themeColors.surface }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5' }]}>
            <User size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.userName, { color: themeColors.textPrimary }]}>
              {user?.email?.split('@')[0] || 'User Profile'}
            </Text>
            <Text style={[styles.userEmail, { color: themeColors.textMuted }]}>
              {user?.email || 'SpendWise Cloud Account'}
            </Text>
          </View>
        </View>

        <View style={styles.cloudBadge}>
          <ShieldCheck size={12} color="#059669" />
          <Text style={styles.cloudBadgeText}>Synced</Text>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Quick Actions Row */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: themeColors.textSecondary }]}>
            QUICK ACTIONS
          </Text>
        </View>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            onPress={() => setNewTxModalOpen(true)}
            style={[styles.quickActionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#fee2e2' }]}>
              <Plus size={18} color="#ef4444" />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>Add Expense</Text>
            <Text style={styles.actionDesc}>Log spend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSpendCashModalOpen(true)}
            style={[styles.quickActionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#fef3c7' }]}>
              <ArrowDownLeft size={18} color="#d97706" />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>Spend Cash</Text>
            <Text style={styles.actionDesc}>Pick notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSyncInbox}
            disabled={syncingInbox}
            style={[styles.quickActionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#ecfdf5' }]}>
              <RefreshCw size={18} color={colors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>Scan SMS</Text>
            <Text style={styles.actionDesc}>Device inbox</Text>
          </TouchableOpacity>
        </View>

        {/* More Options Navigation Hub */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: themeColors.textSecondary }]}>
            FEATURES & PREFERENCES
          </Text>
        </View>

        <View style={[styles.hubCardList, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {HUB_ITEMS.map((item, index) => {
            const ItemIcon = item.icon;
            const isLast = index === HUB_ITEMS.length - 1;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={item.onPress}
                activeOpacity={0.7}
                style={[
                  styles.hubRow,
                  !isLast && [styles.hubRowBorder, { borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }]
                ]}
              >
                <View style={[styles.hubIconBox, { backgroundColor: isDarkMode ? '#1e293b' : item.bg }]}>
                  <ItemIcon size={20} color={item.color} />
                </View>

                <View style={styles.hubTextCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.hubRowTitle, { color: themeColors.textPrimary }]}>
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <View style={[styles.badgePill, { backgroundColor: item.badgeBg || '#7c3aed' }]}>
                        <Text style={styles.badgePillText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.hubRowSubtitle, { color: themeColors.textMuted }]}>
                    {item.subtitle}
                  </Text>
                </View>

                <ChevronRight size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Account & App Info Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: themeColors.textSecondary }]}>
            ACCOUNT
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.7}
          style={[styles.logoutBtn, { backgroundColor: themeColors.surface, borderColor: '#fca5a5' }]}
        >
          <View style={styles.logoutLeft}>
            <View style={styles.logoutIconBox}>
              <LogOut size={18} color="#ef4444" />
            </View>
            <View>
              <Text style={styles.logoutText}>Sign Out of SpendWise</Text>
              <Text style={styles.logoutSubText}>Your financial records remain safely synced in cloud</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Footer info */}
        <View style={styles.footerBox}>
          <Text style={[styles.versionText, { color: themeColors.textMuted }]}>
            SpendWise Mobile v2.0 • Android Native SMS Tracking Active
          </Text>
        </View>
      </ScrollView>

      {/* New Transaction Modal */}
      {newTxModalOpen && (
        <NewTransactionModal
          visible={newTxModalOpen}
          onClose={() => setNewTxModalOpen(false)}
          onSuccess={() => setNewTxModalOpen(false)}
        />
      )}

      {/* Spend Cash Modal */}
      {spendCashModalOpen && (
        <SpendCashModal
          visible={spendCashModalOpen}
          onClose={() => setSpendCashModalOpen(false)}
          onSuccess={() => setSpendCashModalOpen(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cloudBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  sectionHeaderRow: {
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionDesc: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  hubCardList: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  hubRowBorder: {
    borderBottomWidth: 1,
  },
  hubIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTextCol: {
    flex: 1,
    gap: 2,
  },
  hubRowTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hubRowSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  logoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ef4444',
  },
  logoutSubText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  footerBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MoreScreen;

