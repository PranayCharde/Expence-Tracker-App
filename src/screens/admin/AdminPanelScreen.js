import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Users,
  Bell,
  Send,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ChevronRight,
  Search,
  Sparkles,
  Zap,
  Clock,
  History,
  Wallet,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  LogOut
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing, radius, typography } from '../../theme/spacing';
import {
  fetchAdminStats,
  fetchAllUsers,
  broadcastNotificationToAll,
  sendDirectNotificationToUser,
  fetchBroadcastHistory,
  verifyAdminCredentials,
  getAdminSessionStatus,
  setAdminSessionActive,
  ADMIN_CONFIG
} from '../../services/adminService';
import { sendInstantNotification } from '../../services/notificationService';

const PRESET_TEMPLATES = [
  {
    id: 'budget_reminder',
    name: '🎯 Budget Reminder',
    title: '📊 SpendWise Budget Check',
    body: 'Review your monthly category spending to stay within your limits!',
    route: 'Budgets'
  },
  {
    id: 'weekend_recount',
    name: '💼 Weekend Cash Recount',
    title: '💵 SpendWise Cash Wallet',
    body: 'Did you spend cash today? Open SpendWise to update your physical wallet balance.',
    route: 'Cash'
  },
  {
    id: 'app_update',
    name: '🚀 What’s New',
    title: '✨ SpendWise Update',
    body: 'Automatic SMS bank transaction tracking & improved analytics are live!',
    route: 'Transactions'
  },
  {
    id: 'general_alert',
    name: '📢 Announcement',
    title: '📢 SpendWise Announcement',
    body: 'Stay on top of your personal finances with real-time tracking.',
    route: 'Home'
  }
];

const AdminPanelScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { themeColors, isDarkMode } = useSettings();

  const [activeTab, setActiveTab] = useState('broadcast'); // 'broadcast' | 'users' | 'history'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    usersWithTokens: 0,
    totalCashBalance: 0,
    totalBroadcasts: 0
  });

  // Users Directory
  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // History
  const [historyList, setHistoryList] = useState([]);

  // Broadcast Form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastRoute, setBroadcastRoute] = useState('Home');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Direct Send Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [directTitle, setDirectTitle] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);

  // Admin Gate Authentication State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(getAdminSessionStatus().isUnlocked);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingAdmin, setVerifyingAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isAdminUnlocked) {
      loadAllAdminData();
    }
  }, [isAdminUnlocked]);

  const handleUnlockAdmin = async () => {
    setAuthError('');
    if (!adminEmailInput.trim() || !adminPasswordInput.trim()) {
      setAuthError('Please enter both admin email and password.');
      return;
    }

    setVerifyingAdmin(true);
    try {
      const res = await verifyAdminCredentials(adminEmailInput, adminPasswordInput);
      if (res.success) {
        setIsAdminUnlocked(true);
      } else {
        setAuthError(res.message || 'Invalid administrator credentials.');
      }
    } catch (e) {
      setAuthError('Verification error: ' + e.message);
    } finally {
      setVerifyingAdmin(false);
    }
  };

  const handleLockAdminSession = () => {
    setAdminSessionActive(false);
    setIsAdminUnlocked(false);
    setAdminPasswordInput('');
    Alert.alert('Session Locked', 'Admin console locked. Re-authentication required to access.');
  };

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, historyRes] = await Promise.all([
        fetchAdminStats(),
        fetchAllUsers(),
        fetchBroadcastHistory(25)
      ]);

      if (statsRes.success) setStats(statsRes);
      if (usersRes.success) setUsersList(usersRes.users);
      if (historyRes.success) setHistoryList(historyRes.history);
    } catch (e) {
      console.warn('Failed to load admin data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllAdminData();
  };

  const handleApplyTemplate = (template) => {
    setBroadcastTitle(template.title);
    setBroadcastBody(template.body);
    setBroadcastRoute(template.route);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      Alert.alert('Incomplete Notification', 'Please enter both a Title and Message Body.');
      return;
    }

    Alert.alert(
      'Confirm Broadcast',
      `Send notification to ALL ${stats.usersWithTokens} registered device(s)?\n\nTitle: "${broadcastTitle}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send to Everyone',
          style: 'default',
          onPress: async () => {
            setSendingBroadcast(true);
            try {
              const res = await broadcastNotificationToAll({
                title: broadcastTitle,
                body: broadcastBody,
                data: { route: broadcastRoute },
                adminEmail: user?.email || 'Admin'
              });

              if (res.success) {
                Alert.alert(
                  '🎉 Broadcast Dispatched!',
                  `Notification successfully delivered to ${res.sentCount} active device(s).`
                );
                setBroadcastTitle('');
                setBroadcastBody('');
                loadAllAdminData();
              } else {
                Alert.alert('Delivery Notice', res.message || 'Push notification error.');
              }
            } catch (err) {
              Alert.alert('Broadcast Error', err?.message || 'Failed to dispatch broadcast.');
            } finally {
              setSendingBroadcast(false);
            }
          }
        }
      ]
    );
  };

  const handleTestOnMyself = async () => {
    if (!broadcastTitle.trim()) {
      Alert.alert('Test Notification', 'Please type a Title to preview the notification.');
      return;
    }
    try {
      await sendInstantNotification(
        broadcastTitle || 'SpendWise Test',
        broadcastBody || 'This is how your broadcast appears to users.',
        { route: broadcastRoute }
      );
      Alert.alert('Dispatched Locally', 'Check your device notification shade!');
    } catch (e) {
      Alert.alert('Test Error', e?.message);
    }
  };

  const handleOpenDirectModal = (targetUser) => {
    setSelectedUser(targetUser);
    setDirectTitle('Personal Alert');
    setDirectBody(`Hello ${targetUser.displayName || 'there'}, you have a new message from SpendWise Admin.`);
  };

  const handleSendDirectNotification = async () => {
    if (!selectedUser?.pushToken) {
      Alert.alert('No Push Token', 'This user does not have a registered push token yet.');
      return;
    }

    if (!directTitle.trim() || !directBody.trim()) {
      Alert.alert('Incomplete Fields', 'Please provide a title and body.');
      return;
    }

    setSendingDirect(true);
    try {
      const res = await sendDirectNotificationToUser({
        token: selectedUser.pushToken,
        title: directTitle,
        body: directBody,
        data: { route: 'Home' },
        adminEmail: user?.email || 'Admin',
        userEmail: selectedUser.email
      });

      if (res.success) {
        Alert.alert('Notification Sent', `Delivered to ${selectedUser.email}!`);
        setSelectedUser(null);
        loadAllAdminData();
      } else {
        Alert.alert('Error', res.message || 'Failed to send notification.');
      }
    } catch (e) {
      Alert.alert('Send Error', e.message);
    } finally {
      setSendingDirect(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.id && u.id.toLowerCase().includes(q))
    );
  });

  if (!isAdminUnlocked) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={[styles.header, { borderBottomColor: themeColors.border, backgroundColor: themeColors.surface }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>SpendWise Admin</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.gateContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.gateCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.gateIconCircle}>
              <Lock size={28} color="#7c3aed" />
            </View>

            <Text style={[styles.gateTitle, { color: themeColors.textPrimary }]}>SuperAdmin Access</Text>
            <Text style={[styles.gateSubtitle, { color: themeColors.textSecondary }]}>
              Enter designated administrator credentials to broadcast push notifications and manage users.
            </Text>

            {authError ? (
              <View style={styles.authErrorBox}>
                <AlertCircle size={15} color="#ef4444" />
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            ) : null}

            <View style={styles.gateForm}>
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.textPrimary }]}>Admin Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="Enter administrator email"
                  placeholderTextColor="#94a3b8"
                  value={adminEmailInput}
                  onChangeText={setAdminEmailInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.textPrimary }]}>Admin Password</Text>
                <View style={[styles.passwordInputWrap, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: themeColors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: themeColors.textPrimary }]}
                    placeholder="Enter administrator password"
                    placeholderTextColor="#94a3b8"
                    value={adminPasswordInput}
                    onChangeText={setAdminPasswordInput}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.unlockBtn, { backgroundColor: '#7c3aed' }]}
                disabled={verifyingAdmin}
                onPress={handleUnlockAdmin}
              >
                {verifyingAdmin ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <KeyRound size={16} color="#ffffff" />
                    <Text style={styles.unlockBtnText}>Verify & Unlock Admin Console</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border, backgroundColor: themeColors.surface }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Admin Console</Text>
              <View style={styles.adminBadge}>
                <ShieldAlert size={11} color="#ffffff" />
                <Text style={styles.adminBadgeText}>SUPERADMIN</Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              Push Broadcasts & User Management
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity 
            onPress={handleRefresh} 
            disabled={refreshing}
            style={[styles.refreshBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
          >
            <RefreshCw size={17} color={colors.primary} style={refreshing ? { opacity: 0.5 } : null} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleLockAdminSession} 
            style={[styles.lockBtn, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Lock size={15} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={[styles.statCard, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: '#bfdbfe' }]}>
            <View style={styles.statHeader}>
              <Users size={16} color="#2563eb" />
              <Text style={styles.statLabel}>USERS</Text>
            </View>
            <Text style={[styles.statValue, { color: '#1e3a8a' }]}>
              {loading ? '...' : stats.totalUsers}
            </Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: isDarkMode ? '#064e3b' : '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <View style={styles.statHeader}>
              <Smartphone size={16} color="#059669" />
              <Text style={styles.statLabel}>PUSH TOKENS</Text>
            </View>
            <Text style={[styles.statValue, { color: '#065f46' }]}>
              {loading ? '...' : stats.usersWithTokens}
            </Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: isDarkMode ? '#3b0764' : '#faf5ff', borderColor: '#e9d5ff' }]}>
            <View style={styles.statHeader}>
              <Bell size={16} color="#9333ea" />
              <Text style={styles.statLabel}>BROADCASTS</Text>
            </View>
            <Text style={[styles.statValue, { color: '#581c87' }]}>
              {loading ? '...' : stats.totalBroadcasts}
            </Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: isDarkMode ? '#78350f' : '#fffbeb', borderColor: '#fde68a' }]}>
            <View style={styles.statHeader}>
              <Wallet size={16} color="#d97706" />
              <Text style={styles.statLabel}>TOTAL CASH</Text>
            </View>
            <Text style={[styles.statValue, { color: '#92400e' }]}>
              {loading ? '...' : `₹${stats.totalCashBalance.toLocaleString('en-IN')}`}
            </Text>
          </Card>
        </View>

        {/* Navigation Tabs */}
        <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'broadcast' && styles.tabItemActive]}
            onPress={() => setActiveTab('broadcast')}
          >
            <Bell size={15} color={activeTab === 'broadcast' ? colors.primary : themeColors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'broadcast' && { color: colors.primary, fontWeight: '700' }]}>
              Broadcast
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'users' && styles.tabItemActive]}
            onPress={() => setActiveTab('users')}
          >
            <Users size={15} color={activeTab === 'users' ? colors.primary : themeColors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'users' && { color: colors.primary, fontWeight: '700' }]}>
              Users ({usersList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => setActiveTab('history')}
          >
            <History size={15} color={activeTab === 'history' ? colors.primary : themeColors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'history' && { color: colors.primary, fontWeight: '700' }]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: BROADCAST PUSH NOTIFICATION */}
        {activeTab === 'broadcast' && (
          <View style={styles.tabContent}>
            {/* Quick Templates */}
            <Text style={[styles.sectionHeading, { color: themeColors.textSecondary }]}>QUICK TEMPLATES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
              {PRESET_TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={[styles.templateChip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  onPress={() => handleApplyTemplate(tmpl)}
                >
                  <Text style={[styles.templateChipText, { color: themeColors.textPrimary }]}>{tmpl.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Broadcast Form Card */}
            <Card style={styles.formCard}>
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.textPrimary }]}>Notification Title *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="e.g. 📊 Weekly Spending Summary Ready"
                  placeholderTextColor="#94a3b8"
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                  maxLength={65}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.textPrimary }]}>Message Body *</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="e.g. Check your food and transport expenses to see if you stayed within your budget this week."
                  placeholderTextColor="#94a3b8"
                  value={broadcastBody}
                  onChangeText={setBroadcastBody}
                  multiline
                  numberOfLines={4}
                  maxLength={250}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: themeColors.textPrimary }]}>App Destination Screen</Text>
                <View style={styles.routePillsRow}>
                  {['Home', 'Transactions', 'Budgets', 'Reports', 'Cash'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.routePill,
                        { borderColor: themeColors.border },
                        broadcastRoute === r && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                      onPress={() => setBroadcastRoute(r)}
                    >
                      <Text style={[styles.routePillText, broadcastRoute === r && { color: '#ffffff', fontWeight: '700' }]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.testBtn, { borderColor: themeColors.border }]}
                  onPress={handleTestOnMyself}
                >
                  <Sparkles size={16} color={colors.primary} />
                  <Text style={[styles.testBtnText, { color: colors.primary }]}>Test on My Phone</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.broadcastBtn, { backgroundColor: colors.primary }]}
                  disabled={sendingBroadcast}
                  onPress={handleSendBroadcast}
                >
                  {sendingBroadcast ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Send size={16} color="#ffffff" />
                      <Text style={styles.broadcastBtnText}>
                        Broadcast to All ({stats.usersWithTokens})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        {/* TAB 2: USER DIRECTORY */}
        {activeTab === 'users' && (
          <View style={styles.tabContent}>
            {/* Search Box */}
            <View style={[styles.searchBox, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Search size={16} color={themeColors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.textPrimary }]}
                placeholder="Search users by email or ID..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : filteredUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No users match your search.</Text>
              </View>
            ) : (
              filteredUsers.map((u) => (
                <Card key={u.id} style={styles.userCard}>
                  <View style={styles.userCardLeft}>
                    <View style={[styles.userAvatar, { backgroundColor: u.hasToken ? '#ecfdf5' : '#f1f5f9' }]}>
                      <Users size={16} color={u.hasToken ? '#059669' : '#64748b'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userCardEmail, { color: themeColors.textPrimary }]}>{u.email}</Text>
                      <Text style={styles.userCardUid}>UID: {u.id.substring(0, 16)}...</Text>
                      <View style={styles.userMetaRow}>
                        <View style={[styles.statusBadge, { backgroundColor: u.hasToken ? '#d1fae5' : '#fef3c7' }]}>
                          <Text style={[styles.statusBadgeText, { color: u.hasToken ? '#065f46' : '#92400e' }]}>
                            {u.hasToken ? '● Token Active' : '○ No Token'}
                          </Text>
                        </View>
                        <Text style={styles.userWalletBal}>Wallet: ₹{u.walletAmount}</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.userDirectBtn, { backgroundColor: u.hasToken ? colors.primary : '#94a3b8' }]}
                    disabled={!u.hasToken}
                    onPress={() => handleOpenDirectModal(u)}
                  >
                    <Send size={13} color="#ffffff" />
                    <Text style={styles.userDirectBtnText}>Alert</Text>
                  </TouchableOpacity>
                </Card>
              ))
            )}
          </View>
        )}

        {/* TAB 3: BROADCAST HISTORY */}
        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            {historyList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Clock size={32} color="#94a3b8" />
                <Text style={[styles.emptyText, { color: themeColors.textSecondary, marginTop: 8 }]}>
                  No broadcast notifications logged yet.
                </Text>
              </View>
            ) : (
              historyList.map((item) => (
                <Card key={item.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={[styles.historyTitle, { color: themeColors.textPrimary }]}>{item.title}</Text>
                    <Text style={styles.historyTime}>{item.sentAt}</Text>
                  </View>
                  <Text style={[styles.historyBody, { color: themeColors.textSecondary }]}>{item.body}</Text>
                  <View style={styles.historyFooter}>
                    <Text style={styles.historyBadge}>Sent to: {item.recipientCount} device(s)</Text>
                    <Text style={styles.historySender}>By: {item.adminEmail}</Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* DIRECT NOTIFICATION MODAL */}
      <Modal
        visible={!!selectedUser}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                Send Alert to {selectedUser?.email}
              </Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
                value={directTitle}
                onChangeText={setDirectTitle}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Message</Text>
              <TextInput
                style={[styles.textArea, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
                value={directBody}
                onChangeText={setDirectBody}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.sendModalBtn, { backgroundColor: colors.primary }]}
                disabled={sendingDirect}
                onPress={handleSendDirectNotification}
              >
                {sendingDirect ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Send size={15} color="#ffffff" />
                    <Text style={styles.sendModalBtnText}>Send Push Alert</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    padding: spacing.sm + 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabItemActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
  },
  tabText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  tabContent: {
    gap: spacing.sm,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 6,
  },
  templateScroll: {
    gap: 8,
    paddingBottom: 4,
    marginBottom: spacing.sm,
  },
  templateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.md,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  routePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  routePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  routePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  broadcastBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  broadcastBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCardEmail: {
    fontSize: 13,
    fontWeight: '700',
  },
  userCardUid: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  userWalletBal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  userDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  userDirectBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  historyCard: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    gap: 4,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  historyTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  historyBody: {
    fontSize: 12,
    marginTop: 2,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  historyBadge: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
  },
  historySender: {
    fontSize: 10,
    color: '#94a3b8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalForm: {
    gap: 6,
  },
  sendModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  sendModalBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  gateContent: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  gateCard: {
    padding: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  gateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  gateTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  authErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 12,
    marginBottom: spacing.md,
    width: '100%',
  },
  authErrorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  gateForm: {
    width: '100%',
    gap: spacing.md,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  unlockBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  gateTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: spacing.lg,
  },
  gateTipText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  lockBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminPanelScreen;

