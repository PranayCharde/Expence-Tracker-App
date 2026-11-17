import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  RefreshControl, 
  ActivityIndicator, 
  Alert,
  Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Smartphone, 
  Building2, 
  Banknote, 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  ChevronRight, 
  Sparkles,
  Zap,
  Tag,
  MoreVertical,
  Settings as SettingsIcon
} from 'lucide-react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import TransactionDetailModal from '../../components/modals/TransactionDetailModal';
import NewTransactionModal from '../../components/modals/NewTransactionModal';
import { syncRecentSms, isSmsTrackingEnabled, processRawSms } from '../../modules/smsTracking';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';
import { formatTransactionDate } from '../../utils/formatDate';

const BANK_FILTERS = ['All Banks', 'HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'Other'];

const SmsLogScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { symbol, formatCurrency, themeColors, isDarkMode } = useSettings();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingActive, setTrackingActive] = useState(true);
  const [syncingInbox, setSyncingInbox] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBank, setSelectedBank] = useState('All Banks');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'debit', 'credit'

  // Modals
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);

  useEffect(() => {
    isSmsTrackingEnabled().then(enabled => setTrackingActive(enabled));
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTx = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateStr: formatTransactionDate(data.date || data.createdAt)
        };
      });

      // Filter only SMS auto-detected or SMS-linked transactions
      const smsTxList = allTx.filter(t => 
        t.source === 'sms_auto_detected' || 
        t.smsReferenceId || 
        t.bank || 
        t.accountMask
      );

      setTransactions(smsTxList);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.error('SmsLogScreen listener error:', err);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    isSmsTrackingEnabled().then(enabled => setTrackingActive(enabled));
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleSyncInbox = async () => {
    if (!user) return;
    setSyncingInbox(true);
    try {
      const res = await syncRecentSms(user, 30);
      Alert.alert(
        'SMS Inbox Scan Complete',
        `Scanned ${res.checked} messages from your device inbox.\n\nLogged ${res.synced} new transaction(s) to SpendWise.`
      );
    } catch (e) {
      Alert.alert('Scan Failed', 'Could not scan SMS inbox: ' + e?.message);
    } finally {
      setSyncingInbox(false);
    }
  };

  const handleSimulateQuickTest = async () => {
    if (!user) return;
    setSyncingInbox(true);
    try {
      const testBody = `Dear Customer, Rs.650.00 debited from A/C **9876 on ${new Date().toLocaleDateString('en-GB')} to VPA swiggy@icici (UPI Ref ${Math.floor(100000000000 + Math.random() * 900000000000)}). Avail Bal: Rs.14,200.00`;
      await processRawSms(testBody, 'VM-HDFCBK', Date.now(), user);
    } catch (e) {
      Alert.alert('Simulation Error', e.message);
    } finally {
      setSyncingInbox(false);
    }
  };

  // Filtered transactions
  const filteredList = useMemo(() => {
    return transactions.filter(t => {
      // Search Match
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = searchTerm ? (
        t.description?.toLowerCase().includes(searchLower) ||
        t.category?.toLowerCase().includes(searchLower) ||
        t.bank?.toLowerCase().includes(searchLower) ||
        t.smsReferenceId?.toLowerCase().includes(searchLower) ||
        t.accountMask?.toLowerCase().includes(searchLower) ||
        t.amount?.toString().includes(searchLower)
      ) : true;

      // Bank Match
      const matchBank = selectedBank === 'All Banks' ? true : (
        selectedBank === 'Other' 
          ? !['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak'].some(b => t.bank?.toLowerCase().includes(b.toLowerCase()))
          : t.bank?.toLowerCase().includes(selectedBank.toLowerCase())
      );

      // Type Match (Debit = Expense, Credit = Income)
      const isIncome = t.amount > 0;
      const matchType = typeFilter === 'all' ? true : (
        typeFilter === 'credit' ? isIncome : !isIncome
      );

      return matchSearch && matchBank && matchType;
    });
  }, [transactions, searchTerm, selectedBank, typeFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = transactions.length;
    let totalExpense = 0;
    let totalIncome = 0;

    transactions.forEach(t => {
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        totalExpense += Math.abs(t.amount);
      }
    });

    return { totalCount, totalExpense, totalIncome };
  }, [transactions]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border, backgroundColor: themeColors.surface }]}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack && navigation.canGoBack() ? (
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5' }]}>
              <Smartphone size={18} color={colors.primary} />
            </View>
          )}
          <View>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>SMS Transaction Log</Text>
            <View style={styles.statusPillRow}>
              <View style={[styles.statusDot, { backgroundColor: trackingActive ? '#10b981' : '#94a3b8' }]} />
              <Text style={[styles.statusText, { color: trackingActive ? '#059669' : themeColors.textMuted }]}>
                {trackingActive ? 'Auto-Tracking Active' : 'Tracking Paused'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleSyncInbox}
            disabled={syncingInbox}
            style={[styles.syncBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5', borderColor: colors.primary }]}
          >
            {syncingInbox ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <RefreshCw size={12} color={colors.primary} />
                <Text style={styles.syncBtnText}>Scan</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setOptionsModalOpen(true)}
            style={[styles.optionsBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: themeColors.border }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={18} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Stats Hero Card */}
        <View style={[styles.statsCard, { backgroundColor: isDarkMode ? themeColors.surface : '#ffffff', borderColor: themeColors.border }]}>
          <View style={styles.statsCardHeader}>
            <View style={styles.statsHeroTitleRow}>
              <Smartphone size={16} color={colors.primary} />
              <Text style={[styles.statsHeroTitle, { color: themeColors.textPrimary }]}>
                SMS Tracking Summary
              </Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{stats.totalCount} Detected</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#1e293b' : '#fef2f2' }]}>
              <View style={styles.statBoxIconRow}>
                <ArrowDownLeft size={14} color="#ef4444" />
                <Text style={styles.statBoxLabel}>SMS Debits</Text>
              </View>
              <Text style={[styles.statBoxValue, { color: '#ef4444' }]}>
                {formatCurrency(stats.totalExpense)}
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4' }]}>
              <View style={styles.statBoxIconRow}>
                <ArrowUpRight size={14} color="#10b981" />
                <Text style={styles.statBoxLabel}>SMS Credits</Text>
              </View>
              <Text style={[styles.statBoxValue, { color: '#10b981' }]}>
                {formatCurrency(stats.totalIncome)}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Search size={16} color={themeColors.textSecondary} />
          <TextInput
            placeholder="Search bank, merchant, ref ID, amount..."
            placeholderTextColor={themeColors.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <X size={16} color={themeColors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Type Filter Tabs (All, Debits, Credits) */}
        <View style={[styles.typeFilterRow, { backgroundColor: isDarkMode ? themeColors.surfaceSubtle : '#f1f5f9' }]}>
          <TouchableOpacity
            onPress={() => setTypeFilter('all')}
            style={[styles.typeTab, typeFilter === 'all' && [styles.typeTabActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]]}
          >
            <Text style={[styles.typeTabText, typeFilter === 'all' ? { color: colors.primary, fontWeight: '900' } : { color: themeColors.textSecondary }]}>
              All ({transactions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTypeFilter('debit')}
            style={[styles.typeTab, typeFilter === 'debit' && [styles.typeTabActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]]}
          >
            <Text style={[styles.typeTabText, typeFilter === 'debit' ? { color: '#ef4444', fontWeight: '900' } : { color: themeColors.textSecondary }]}>
              Debits (-)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTypeFilter('credit')}
            style={[styles.typeTab, typeFilter === 'credit' && [styles.typeTabActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]]}
          >
            <Text style={[styles.typeTabText, typeFilter === 'credit' ? { color: '#10b981', fontWeight: '900' } : { color: themeColors.textSecondary }]}>
              Credits (+)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bank Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bankFilterScroll}
        >
          {BANK_FILTERS.map(bank => {
            const isSelected = selectedBank === bank;
            return (
              <TouchableOpacity
                key={bank}
                onPress={() => setSelectedBank(bank)}
                activeOpacity={0.7}
                style={[
                  styles.bankFilterChip,
                  {
                    borderColor: isSelected ? colors.primary : themeColors.border,
                    backgroundColor: isSelected 
                      ? colors.primary 
                      : (isDarkMode ? themeColors.surfaceSubtle : '#ffffff')
                  }
                ]}
              >
                <Building2 size={12} color={isSelected ? '#ffffff' : themeColors.textSecondary} />
                <Text style={[
                  styles.bankFilterText,
                  { color: isSelected ? '#ffffff' : themeColors.textPrimary },
                  isSelected && { fontWeight: '900' }
                ]}>
                  {bank}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.listHeaderTitle, { color: themeColors.textPrimary }]}>
            Recorded Transactions
          </Text>
          <Text style={[styles.listHeaderCount, { color: themeColors.textMuted }]}>
            Showing {filteredList.length} of {transactions.length}
          </Text>
        </View>

        {/* List of SMS Logged Transactions */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
        ) : filteredList.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.emptyIconCircle}>
              <Smartphone size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              {searchTerm || selectedBank !== 'All Banks' || typeFilter !== 'all' 
                ? 'No matching SMS transactions found' 
                : 'No SMS transactions detected yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
              {searchTerm 
                ? 'Try searching with a different bank name, reference ID, or merchant.'
                : 'When Indian bank transaction SMS messages arrive, SpendWise will automatically parse, verify, and log them here.'}
            </Text>

            <View style={styles.emptyActionRow}>
              <TouchableOpacity
                onPress={handleSyncInbox}
                disabled={syncingInbox}
                style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
              >
                <RefreshCw size={14} color="#ffffff" />
                <Text style={styles.emptyActionBtnText}>Scan SMS Inbox</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSimulateQuickTest}
                disabled={syncingInbox}
                style={[styles.emptyActionBtnOutline, { borderColor: themeColors.border }]}
              >
                <Sparkles size={14} color={colors.primary} />
                <Text style={[styles.emptyActionBtnOutlineText, { color: themeColors.textPrimary }]}>
                  Test ₹650 Swiggy
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.txList}>
            {filteredList.map(tx => {
              const isIncome = tx.amount > 0;
              const isCreditCardBill = tx.description?.toLowerCase().includes('credit card bill');

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTx(tx)}
                  style={[
                    styles.txCard, 
                    { 
                      backgroundColor: themeColors.surface, 
                      borderColor: themeColors.border 
                    }
                  ]}
                >
                  <View style={styles.txCardTop}>
                    <View style={styles.txBankBadgeRow}>
                      <View style={[styles.bankTag, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff' }]}>
                        <Building2 size={11} color="#2563eb" />
                        <Text style={styles.bankTagText}>
                          {tx.bank || 'Bank SMS'}
                        </Text>
                      </View>
                      {tx.accountMask ? (
                        <View style={[styles.accountTag, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                          <Text style={[styles.accountTagText, { color: themeColors.textSecondary }]}>
                            {tx.accountMask}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.autoDetectedTag}>
                        <Zap size={9} color="#10b981" />
                        <Text style={styles.autoDetectedText}>SMS AUTO</Text>
                      </View>
                    </View>

                    <Text style={[
                      styles.txAmount,
                      { color: isIncome ? colors.success : colors.danger }
                    ]}>
                      {formatCurrency(tx.amount, { showSign: true })}
                    </Text>
                  </View>

                  <View style={styles.txCardMiddle}>
                    <View style={styles.txDescriptionCol}>
                      <Text style={[styles.txTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {tx.description || tx.category}
                      </Text>
                      {tx.smsReferenceId ? (
                        <Text style={[styles.txRefId, { color: themeColors.textMuted }]} numberOfLines={1}>
                          Ref: {tx.smsReferenceId}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={[styles.txCardBottom, { borderTopColor: isDarkMode ? '#334155' : '#f8fafc' }]}>
                    <View style={styles.txBottomMetaLeft}>
                      <View style={[styles.categoryTag, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                        <Tag size={10} color={colors.primary} />
                        <Text style={[styles.categoryTagText, { color: themeColors.textSecondary }]}>
                          {tx.category}
                        </Text>
                      </View>
                      <Text style={[styles.txDateText, { color: themeColors.textMuted }]}>
                        {tx.dateStr || tx.date}
                      </Text>
                    </View>

                    <View style={styles.txCardChevron}>
                      <Text style={[styles.viewDetailsText, { color: colors.primary }]}>Details</Text>
                      <ChevronRight size={14} color={colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <TransactionDetailModal
          visible={!!selectedTx}
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onEdit={() => {
            const current = selectedTx;
            setSelectedTx(null);
            setEditingTx(current);
          }}
          onDeleteSuccess={() => setSelectedTx(null)}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <NewTransactionModal
          visible={!!editingTx}
          initialTransaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSuccess={() => setEditingTx(null)}
        />
      )}

      {/* More Options Sheet Modal */}
      <Modal
        visible={optionsModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOptionsModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsModalOpen(false)}
          style={styles.modalBackdrop}
        >
          <View 
            style={[styles.optionsSheetCard, { backgroundColor: themeColors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.optionsSheetHeader}>
              <View>
                <Text style={[styles.optionsSheetTitle, { color: themeColors.textPrimary }]}>
                  SMS Tracking Options
                </Text>
                <Text style={[styles.optionsSheetSubtitle, { color: themeColors.textMuted }]}>
                  Manage SMS auto-detection, scan inbox & test bank parsers
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setOptionsModalOpen(false)}
                style={styles.sheetCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              <TouchableOpacity
                onPress={() => {
                  setOptionsModalOpen(false);
                  handleSyncInbox();
                }}
                style={[styles.optionRow, { borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#ecfdf5' }]}>
                  <RefreshCw size={18} color={colors.primary} />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                    Scan Device SMS Inbox
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Scan past 30 days of bank SMS messages for unrecorded transactions
                  </Text>
                </View>
                <ChevronRight size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setOptionsModalOpen(false);
                  handleSimulateQuickTest();
                }}
                style={[styles.optionRow, { borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#eff6ff' }]}>
                  <Sparkles size={18} color="#2563eb" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                    Simulate Test SMS (₹650 Swiggy)
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Fire a live simulation to test detection and notification pipeline
                  </Text>
                </View>
                <ChevronRight size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setOptionsModalOpen(false);
                  navigation.navigate('Settings');
                }}
                style={[styles.optionRow, { borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }]}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#f5f3ff' }]}>
                  <SettingsIcon size={18} color="#8b5cf6" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                    SMS Permissions & Settings
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Configure auto-monitoring toggle, notification channels & permissions
                  </Text>
                </View>
                <ChevronRight size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSearchTerm('');
                  setSelectedBank('All Banks');
                  setTypeFilter('all');
                  setOptionsModalOpen(false);
                }}
                style={styles.optionRow}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#f1f5f9' }]}>
                  <Filter size={18} color="#64748b" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                    Reset Search & Filters
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Clear active bank filter and search queries
                  </Text>
                </View>
                <ChevronRight size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setOptionsModalOpen(false)}
              style={[styles.sheetCancelBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
            >
              <Text style={[styles.sheetCancelBtnText, { color: themeColors.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  optionsBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  optionsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionsSheetTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  optionsSheetSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 6,
    borderRadius: 12,
  },
  optionsList: {
    gap: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  sheetCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  sheetCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  statsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsHeroTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  totalBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#059669',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    gap: 6,
  },
  statBoxIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
  },
  typeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 11,
  },
  typeTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bankFilterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  bankFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  bankFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  listHeaderCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  txList: {
    gap: 10,
  },
  txCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  txCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txBankBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  bankTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bankTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  accountTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  accountTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  autoDetectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  autoDetectedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.3,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  txCardMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txDescriptionCol: {
    flex: 1,
    gap: 2,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  txRefId: {
    fontSize: 11,
    fontWeight: '600',
  },
  txCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  txBottomMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  txDateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txCardChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyActionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyActionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

export default SmsLogScreen;

