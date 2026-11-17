import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Banknote, 
  ChevronRight,
  Sparkles,
  User,
  Smartphone,
  PieChart as PieChartIcon
} from 'lucide-react-native';
import { collection, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Logo from '../../components/common/Logo';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import NewTransactionModal from '../../components/modals/NewTransactionModal';
import SpendCashModal from '../../components/modals/SpendCashModal';
import TransactionDetailModal from '../../components/modals/TransactionDetailModal';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';
import { formatTransactionDate } from '../../utils/formatDate';

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { symbol, formatCurrency, themeColors, isDarkMode } = useSettings();

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [newTxModalOpen, setNewTxModalOpen] = useState(false);
  const [newTxType, setNewTxType] = useState('expense');
  const [spendCashModalOpen, setSpendCashModalOpen] = useState(false);
  const [spendCashMode, setSpendCashMode] = useState('expense');
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  // Physical wallet data from user profile
  const [walletData, setWalletData] = useState({ amount: 0, denominations: {} });

  useEffect(() => {
    if (!user) return;

    // Listen to transactions
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubTx = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateStr: formatTransactionDate(data.date || data.createdAt)
        };
      });
      setTransactions(list);
      setLoading(false);
    }, (err) => {
      console.error("Dashboard transactions listener error:", err);
      setLoading(false);
    });

    // Listen to user profile for wallet denominations (isolated document)
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
      if (userDoc && userDoc.exists()) {
        const data = userDoc.data();
        if (data.physicalWallet) {
          setWalletData({
            amount: data.physicalWallet.amount ?? 0,
            denominations: data.physicalWallet.denominations || {}
          });
        }
      }
    });

    // Listen to budgets
    const bQuery = query(collection(db, 'users', user.uid, 'budgets'));
    const unsubBudgets = onSnapshot(bQuery, (snap) => {
      const bList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBudgets(bList);
    });

    return () => {
      unsubTx();
      unsubUser();
      unsubBudgets();
    };
  }, [user]);

  // Financial Stats Calculation (Strict ATM & Cash Accounting)
  const stats = useMemo(() => {
    // Real Income: Excludes ATM withdrawals (which are account transfers, not new income)
    const totalIncome = transactions
      .filter(t => t.amount > 0 && t.category !== 'ATM Withdrawal')
      .reduce((sum, t) => sum + t.amount, 0);

    // Real Expenses: Excludes ATM withdrawals (which convert bank balance to cash, not spend)
    const totalExpense = transactions
      .filter(t => t.amount < 0 && t.category !== 'ATM Withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalBalance = totalIncome - totalExpense;

    // Physical Cash Balance:
    // Cash In: Positive cash transactions OR ATM withdrawals that put cash into wallet
    const cashIn = transactions
      .filter(t => (t.paymentMethod === 'Cash' && t.amount > 0) || t.category === 'ATM Withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Cash Out: Negative cash expenses (excluding ATM transfers)
    const cashOut = transactions
      .filter(t => t.paymentMethod === 'Cash' && t.amount < 0 && t.category !== 'ATM Withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const cashBalance = cashIn - cashOut;

    return { totalBalance, totalIncome, totalExpense, cashBalance };
  }, [transactions]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const openNewTransaction = (type = 'expense') => {
    setNewTxType(type);
    setNewTxModalOpen(true);
  };

  const openCashModal = (mode = 'expense') => {
    setSpendCashMode(mode);
    setSpendCashModalOpen(true);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Top Navbar */}
      <View style={[styles.navHeader, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <Logo size={32} showText={true} textColor={themeColors.textPrimary} />
        <View style={styles.navRight}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => openNewTransaction('expense')} 
            style={styles.addBtnHeader}
          >
            <Plus size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Settings')} 
            style={[styles.profileBtnHeader, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <User size={18} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Welcome Greeting */}
        <View style={styles.greetingBox}>
          <Text style={[styles.greetingText, { color: themeColors.textPrimary }]}>
            Hello, {user?.displayName?.split(' ')[0] || 'there'} 👋
          </Text>
          <Text style={[styles.greetingSub, { color: themeColors.textSecondary }]}>
            Here is your financial summary for this month
          </Text>
        </View>

        {/* Hero Total Balance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Total Net Balance</Text>
              <Text style={styles.heroAmount}>{formatCurrency(stats.totalBalance)}</Text>
            </View>
            <View style={styles.heroIconCircle}>
              <CreditCard size={24} color="#ffffff" />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <View style={styles.statIconBoxIncome}>
                <ArrowUpRight size={14} color="#10B981" />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Income</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(stats.totalIncome)}</Text>
              </View>
            </View>

            <View style={styles.heroStatItem}>
              <View style={styles.statIconBoxExpense}>
                <ArrowDownLeft size={14} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.heroStatLabel}>Spending</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(stats.totalExpense)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Physical Cash in Hand Card (Direct Tap to Cash Wallet) */}
        <TouchableOpacity 
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Cash')}
          style={styles.cashInHandCard}
        >
          <View style={styles.cashLeft}>
            <View style={styles.cashIconBox}>
              <Banknote size={22} color="#ffffff" />
            </View>
            <View>
              <View style={styles.cashBadgeRow}>
                <Text style={styles.cashTitle}>Physical Wallet Cash</Text>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.cashSubtitle}>Live cash in your pocket</Text>
              <Text style={styles.cashBalanceText}>{formatCurrency(stats.cashBalance)}</Text>
            </View>
          </View>
          <View style={styles.cashRightArrow}>
            <ChevronRight size={20} color="#047857" />
          </View>
        </TouchableOpacity>

        {/* Quick Action Grid */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            onPress={() => openCashModal('expense')} 
            style={[styles.actionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#fee2e2' }]}>
              <ArrowDownLeft size={18} color="#ef4444" />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.textPrimary }]}>Spend Cash</Text>
            <Text style={styles.actionDesc}>Deduct notes</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => openCashModal('income')} 
            style={[styles.actionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#dcfce7' }]}>
              <ArrowUpRight size={18} color="#10b981" />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.textPrimary }]}>Add Cash</Text>
            <Text style={styles.actionDesc}>ATM / Inflow</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => openNewTransaction('expense')} 
            style={[styles.actionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#ede9fe' }]}>
              <Plus size={18} color="#7c3aed" />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.textPrimary }]}>Add Online</Text>
            <Text style={styles.actionDesc}>UPI / Card</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions Section */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Recent Activity</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('SmsLog')}
              style={[styles.smsActivityBadge, { backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5', borderColor: colors.primary }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Smartphone size={11} color={colors.primary} />
              <Text style={[styles.smsActivityBadgeText, { color: colors.primary }]}>SMS Log</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.seeAllText}>See all ({transactions.length})</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : transactions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Banknote size={32} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>Tap "+ Add Online" or "Spend Cash" to log your first record.</Text>
          </Card>
        ) : (
          <View style={styles.txList}>
            {transactions.slice(0, 5).map(tx => {
              const isIncome = tx.amount > 0;
              const isCash = tx.paymentMethod === 'Cash';

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTx(tx)}
                  style={[styles.txItem, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <View style={styles.txLeft}>
                    <View style={[
                      styles.txIconBox,
                      { backgroundColor: isCash ? colors.primaryMuted : isIncome ? '#f0fdf4' : '#f8fafc' }
                    ]}>
                      {isCash ? (
                        <Banknote size={18} color={colors.primaryDark} />
                      ) : isIncome ? (
                        <TrendingUp size={18} color={colors.success} />
                      ) : (
                        <CreditCard size={18} color="#64748b" />
                      )}
                    </View>
                    <View style={styles.txContent}>
                      <Text style={[styles.txDescription, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {tx.description || tx.category}
                      </Text>
                      <View style={styles.txMetaRow}>
                        <Text style={styles.txDate}>{tx.dateStr}</Text>
                        <Badge 
                          text={tx.category || 'Other'} 
                          variant={isIncome ? 'success' : 'default'} 
                          style={{ paddingVertical: 1, paddingHorizontal: 6 }} 
                        />
                        {isCash && (
                          <Badge text="Cash" variant="cash" style={{ paddingVertical: 1, paddingHorizontal: 6 }} />
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.txRight}>
                    <Text style={[
                      styles.txAmount,
                      { color: isIncome ? colors.success : colors.danger }
                    ]}>
                      {formatCurrency(tx.amount, { showSign: true })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <NewTransactionModal
        visible={newTxModalOpen}
        onClose={() => {
          setNewTxModalOpen(false);
          setEditingTx(null);
        }}
        defaultType={newTxType}
        initialTransaction={editingTx}
      />

      <SpendCashModal
        visible={spendCashModalOpen}
        onClose={() => setSpendCashModalOpen(false)}
        mode={spendCashMode}
        currentWalletBalance={stats.cashBalance}
        currentDenominations={walletData.denominations}
      />

      <TransactionDetailModal
        visible={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
        onEdit={(tx) => {
          setSelectedTx(null);
          setEditingTx(tx);
          setNewTxModalOpen(true);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtnHeader: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  profileBtnHeader: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 18,
  },
  greetingBox: {
    gap: 2,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#064e3b',
    padding: 22,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#a7f3d0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 18,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconBoxIncome: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBoxExpense: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '700',
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 1,
  },
  cashInHandCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cashLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  cashIconBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cashBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cashTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#064e3b',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  cashSubtitle: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 1,
  },
  cashBalanceText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#064e3b',
    marginTop: 4,
  },
  cashRightArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  actionDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  smsActivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  smsActivityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  txList: {
    gap: 10,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    minHeight: 70,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  txIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  txDescription: {
    fontSize: typography.fontSizes.body,
    fontWeight: '800',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  txDate: {
    fontSize: typography.fontSizes.caption,
    color: '#64748b',
    fontWeight: '700',
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 84,
    paddingLeft: spacing.xs,
  },
  txAmount: {
    fontSize: typography.fontSizes.bodyLg,
    fontWeight: '900',
    textAlign: 'right',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 220,
  },
});

export default DashboardScreen;

