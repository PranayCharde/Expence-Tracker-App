import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  RefreshControl,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Wallet, 
  Coins, 
  Banknote, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Edit3, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Plus, 
  TrendingUp, 
  X,
  FileText,
  Calculator,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react-native';
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { INDIAN_DENOMINATIONS } from '../../config/constants';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import SpendCashModal from '../../components/modals/SpendCashModal';
import TransactionDetailModal from '../../components/modals/TransactionDetailModal';
import { colors } from '../../theme/colors';

const CashWalletScreen = () => {
  const { user } = useAuth();
  const { symbol, formatCurrency, themeColors, isDarkMode } = useSettings();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Physical wallet data from user document
  const [walletData, setWalletData] = useState({
    amount: 0,
    denominations: {},
    note: '',
    updatedAt: null
  });

  // Recount Drawer State
  const [showRecount, setShowRecount] = useState(false);
  const [recountAmount, setRecountAmount] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [showBillCounter, setShowBillCounter] = useState(true);
  const [autoAdjustLedger, setAutoAdjustLedger] = useState(true);
  const [recountDenominations, setRecountDenominations] = useState({
    500: '',
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
    coins: ''
  });
  const [savingRecount, setSavingRecount] = useState(false);

  // Spend / Add Cash Modal
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashModalMode, setCashModalMode] = useState('expense');
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Listen to CASH transactions only
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubTx = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data();
        let jsDate = new Date();
        if (data.date) jsDate = new Date(data.date);
        return {
          id: d.id,
          ...data,
          dateStr: jsDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
        };
      });

      const cashOnly = list.filter(t => t.paymentMethod === 'Cash');
      setTransactions(cashOnly);
      setLoading(false);
    });

    // Listen to user profile for wallet denominations
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.physicalWallet) {
          setWalletData({
            amount: data.physicalWallet.amount ?? 0,
            denominations: data.physicalWallet.denominations || {},
            updatedAt: data.physicalWallet.updatedAt?.toDate ? data.physicalWallet.updatedAt.toDate() : null
          });
        }
      }
    });

    return () => {
      unsubTx();
      unsubUser();
    };
  }, [user]);

  // Ledger stats
  const stats = useMemo(() => {
    const cashIn = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const cashOut = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const cashBalance = cashIn - cashOut;

    return { cashIn, cashOut, cashBalance };
  }, [transactions]);

  const activeDenominations = walletData.denominations || {};

  // Recount Denominations Math
  const calculateRecountTotal = (denoms) => {
    const billSum = INDIAN_DENOMINATIONS.reduce((sum, item) => {
      const count = parseInt(denoms[item.value], 10) || 0;
      return sum + (count * item.value);
    }, 0);
    const coinsSum = parseFloat(denoms.coins) || 0;
    return billSum + coinsSum;
  };

  const handleRecountStep = (val, delta) => {
    const current = parseInt(recountDenominations[val], 10) || 0;
    const nextVal = Math.max(0, current + delta);
    const updated = { ...recountDenominations, [val]: nextVal === 0 ? '' : nextVal };
    setRecountDenominations(updated);
    setRecountAmount(String(calculateRecountTotal(updated)));
  };

  const handleRecountCoinChange = (txt) => {
    const clean = txt === '' ? '' : Math.max(0, parseFloat(txt) || 0);
    const updated = { ...recountDenominations, coins: clean };
    setRecountDenominations(updated);
    setRecountAmount(String(calculateRecountTotal(updated)));
  };

  const handleResetRecountDenominations = () => {
    const resetState = {
      500: '',
      200: '',
      100: '',
      50: '',
      20: '',
      10: '',
      coins: ''
    };
    setRecountDenominations(resetState);
    setRecountAmount('0');
  };

  const handleSaveRecount = async () => {
    if (!user) return;
    const numAmount = parseFloat(recountAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid cash amount.');
      return;
    }

    setSavingRecount(true);
    try {
      const diff = numAmount - stats.cashBalance;
      if (autoAdjustLedger && Math.abs(diff) >= 0.01) {
        const isPositive = diff > 0;
        const adjustAmount = isPositive 
          ? Math.round(diff * 100) / 100 
          : -Math.round(Math.abs(diff) * 100) / 100;

        await addDoc(collection(db, 'users', user.uid, 'transactions'), {
          amount: adjustAmount,
          category: 'Wallet Balance',
          description: transactions.length === 0 
            ? `Initial physical wallet cash: ${formatCurrency(numAmount)}`
            : (isPositive 
                ? `Updated wallet cash (+${formatCurrency(diff)})` 
                : `Updated wallet cash (-${formatCurrency(Math.abs(diff))})`),
          paymentMethod: 'Cash',
          date: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp(),
          isReconciliation: true
        });
      }

      await setDoc(doc(db, 'users', user.uid), {
        physicalWallet: {
          amount: numAmount,
          denominations: recountDenominations,
          note: walletLabel.trim(),
          updatedAt: serverTimestamp()
        }
      }, { merge: true });

      setShowRecount(false);
      Alert.alert('Wallet Updated', `Physical wallet balance set to ${formatCurrency(numAmount)}!`);
    } catch (err) {
      console.error("Error updating wallet recount:", err);
      Alert.alert('Error', 'Failed to update wallet cash.');
    } finally {
      setSavingRecount(false);
    }
  };

  const openRecountTool = () => {
    setRecountAmount(String(walletData.amount !== null && walletData.amount !== undefined ? walletData.amount : (stats.cashBalance || '')));
    setRecountDenominations(walletData.denominations || {});
    setWalletLabel(walletData.note || '');
    setShowRecount(true);
  };

  // Variance calculations
  const recountNum = parseFloat(recountAmount) || 0;
  const varianceDiff = recountNum - stats.cashBalance;
  const hasVariance = Math.abs(varianceDiff) >= 0.01;
  const isPositiveVariance = varianceDiff > 0;

  const openCashAction = (mode = 'expense') => {
    setCashModalMode(mode);
    setCashModalOpen(true);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} colors={[colors.primary]} />}
      >
        {/* Screen Header */}
        <View style={styles.headerBox}>
          <Text style={[styles.screenTitle, { color: themeColors.textPrimary }]}>Physical Wallet</Text>
          <Text style={[styles.screenSubtitle, { color: themeColors.textSecondary }]}>
            Count, spend, and audit the real money in your pocket
          </Text>
        </View>

        {/* Hero Green Leather Wallet Card */}
        <View style={styles.heroWalletCard}>
          <View style={styles.heroTop}>
            <View style={styles.walletHeaderTag}>
              <View style={styles.walletIconCircle}>
                <Wallet size={22} color="#ffffff" />
              </View>
              <View>
                <View style={styles.walletLiveRow}>
                  <Text style={styles.walletLiveTitle}>Physical Wallet Cash</Text>
                  <View style={styles.walletPulse} />
                </View>
                <Text style={styles.walletDesc}>Actual money in your leather pocket</Text>
              </View>
            </View>
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Current Wallet Balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(stats.cashBalance)}</Text>
          </View>

          {/* Quick Stats Pills */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>
                Spent: <Text style={styles.statPillBold}>{formatCurrency(stats.cashOut)}</Text>
              </Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>
                Added: <Text style={styles.statPillBold}>{formatCurrency(stats.cashIn)}</Text>
              </Text>
            </View>
          </View>

          {/* Action Buttons inside Card */}
          <View style={styles.walletActionRow}>
            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => openCashAction('expense')}
              style={styles.spendActionBtn}
            >
              <ArrowDownLeft size={16} color="#ef4444" />
              <Text style={styles.spendActionText}>Spend from Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => openCashAction('income')}
              style={styles.addActionBtn}
            >
              <ArrowUpRight size={16} color="#a7f3d0" />
              <Text style={styles.addActionText}>+ Add Cash</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recount Drawer (If Open) */}
        {showRecount && (
          <Card style={styles.recountCard}>
            <View style={styles.recountHeader}>
              <View style={styles.recountTitleRow}>
                <View style={styles.recountIconCircle}>
                  <Calculator size={18} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recountTitle, { color: themeColors.textPrimary }]}>
                    Recount or Set Wallet Cash
                  </Text>
                  <Text style={styles.recountInstruction}>
                    Type the exact money currently in your pocket to update your wallet balance.
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowRecount(false)} style={styles.closeBtn}>
                <X size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Inputs: Exact Cash & Wallet Label */}
            <View style={styles.recountInputsRow}>
              <View style={styles.recountInputCol}>
                <Text style={styles.inputFieldLabel}>Exact Cash Currently in Wallet</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.amountPrefix}>{symbol}</Text>
                  <TextInput
                    value={recountAmount}
                    onChangeText={(txt) => setRecountAmount(txt)}
                    placeholder="710"
                    keyboardType="numeric"
                    style={styles.amountInputField}
                  />
                </View>
              </View>

              <View style={styles.recountInputCol}>
                <Text style={styles.inputFieldLabel}>Wallet Label (Optional)</Text>
                <TextInput
                  value={walletLabel}
                  onChangeText={(txt) => setWalletLabel(txt)}
                  placeholder="e.g. Pocket wallet, cash drawer"
                  style={styles.labelInputField}
                />
              </View>
            </View>

            {/* Toggle Bill Counter */}
            <TouchableOpacity 
              onPress={() => setShowBillCounter(prev => !prev)}
              style={styles.billCounterToggleRow}
            >
              <Coins size={16} color={colors.primary} />
              <Text style={styles.billCounterToggleText}>
                {showBillCounter ? 'Hide bill counter' : 'Count with ₹500, ₹200, ₹100 bills & coins'}
              </Text>
              {showBillCounter ? (
                <ChevronUp size={16} color={colors.primary} />
              ) : (
                <ChevronDown size={16} color={colors.primary} />
              )}
            </TouchableOpacity>

            {/* Bill Counter Grid */}
            {showBillCounter && (
              <View style={styles.billCounterContainer}>
                <View style={styles.billCounterHeaderRow}>
                  <Text style={styles.billCounterTitle}>Count Individual Notes</Text>
                  <TouchableOpacity onPress={handleResetRecountDenominations} style={styles.resetBtn}>
                    <RotateCcw size={12} color="#94a3b8" />
                    <Text style={styles.resetBtnText}>Reset</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.recountGrid}>
                  {INDIAN_DENOMINATIONS.map(note => {
                    const count = recountDenominations[note.value] ?? '';
                    const subtotal = (parseInt(count, 10) || 0) * note.value;

                    return (
                      <View 
                        key={note.value}
                        style={[styles.recountNoteCard, { backgroundColor: note.bg, borderColor: note.border }]}
                      >
                        <View style={styles.recountNoteTop}>
                          <Text style={[styles.recountNoteLabel, { color: note.color }]}>{note.label}</Text>
                          <Text style={styles.recountNoteSubtotal}>{formatCurrency(subtotal)}</Text>
                        </View>

                        <View style={styles.recountStepper}>
                          <TouchableOpacity 
                            onPress={() => handleRecountStep(note.value, -1)}
                            style={styles.recountStepBtn}
                          >
                            <Text style={styles.recountStepText}>-</Text>
                          </TouchableOpacity>
                          <TextInput
                            value={String(count)}
                            onChangeText={(txt) => {
                              const val = txt === '' ? '' : Math.max(0, parseInt(txt, 10) || 0);
                              const updated = { ...recountDenominations, [note.value]: val };
                              setRecountDenominations(updated);
                              setRecountAmount(String(calculateRecountTotal(updated)));
                            }}
                            placeholder="0"
                            keyboardType="number-pad"
                            style={styles.recountInput}
                          />
                          <TouchableOpacity 
                            onPress={() => handleRecountStep(note.value, 1)}
                            style={[styles.recountStepBtn, { backgroundColor: colors.primaryMuted }]}
                          >
                            <Text style={[styles.recountStepText, { color: colors.primary }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Coins Input */}
                <View style={styles.recountCoinsBox}>
                  <View>
                    <Text style={styles.recountCoinsLabel}>Coins & Loose Change</Text>
                    <Text style={styles.recountCoinsSub}>Total coin value in {symbol}</Text>
                  </View>
                  <View style={styles.coinsInputWrap}>
                    <Text style={styles.coinPrefix}>{symbol}</Text>
                    <TextInput
                      value={String(recountDenominations.coins)}
                      onChangeText={handleRecountCoinChange}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      style={styles.recountCoinsInput}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* AUDIT & RECONCILIATION CARD (Matching media_1794556407187_42234f70.png) */}
            <View style={styles.auditContainer}>
              <View style={styles.auditHeaderRow}>
                <Text style={styles.auditHeaderTitle}>AUDIT & RECONCILIATION</Text>
                <View style={[styles.varianceBadge, !hasVariance && styles.inSyncBadge]}>
                  <AlertCircle size={12} color={hasVariance ? '#b45309' : '#047857'} />
                  <Text style={[styles.varianceBadgeText, !hasVariance && styles.inSyncBadgeText]}>
                    {hasVariance ? 'Variance' : 'In Sync'}
                  </Text>
                </View>
              </View>

              {/* Physical Count Pill */}
              <View style={styles.auditRowItem}>
                <Text style={styles.auditItemLabel}>Physical Wallet Count:</Text>
                <Text style={styles.auditItemValue}>{formatCurrency(recountNum)}</Text>
              </View>

              {/* Ledger Balance Pill */}
              <View style={styles.auditRowItem}>
                <Text style={styles.auditItemLabel}>App Cash Ledger Balance:</Text>
                <Text style={styles.auditItemValue}>{formatCurrency(stats.cashBalance)}</Text>
              </View>

              {/* Difference / Variance Highlight Box */}
              <View style={[styles.varianceHighlightBox, !hasVariance && styles.inSyncHighlightBox]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.varianceBoxTitle, !hasVariance && styles.inSyncBoxTitle]}>
                    DIFFERENCE / VARIANCE
                  </Text>
                  <Text style={[styles.varianceBoxDesc, !hasVariance && styles.inSyncBoxDesc]}>
                    {hasVariance
                      ? `${isPositiveVariance ? '+' : '-'}${formatCurrency(Math.abs(varianceDiff))} ${isPositiveVariance ? 'more in wallet (untracked cash in)' : 'less in wallet (untracked cash expense)'}`
                      : 'Physical wallet matches cash ledger perfectly!'}
                  </Text>
                </View>
                <Text style={[styles.varianceBoxAmount, !hasVariance && styles.inSyncBoxAmount]}>
                  {isPositiveVariance ? '+' : ''}{formatCurrency(varianceDiff)}
                </Text>
              </View>

              {/* Checkbox: Auto-adjust app cash balance */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setAutoAdjustLedger(prev => !prev)}
                style={styles.checkboxContainer}
              >
                <View style={styles.checkboxIconWrap}>
                  {autoAdjustLedger ? (
                    <CheckSquare size={18} color="#047857" />
                  ) : (
                    <Square size={18} color="#94a3b8" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkboxTitle}>Auto-adjust app cash balance</Text>
                  <Text style={styles.checkboxSubtext}>
                    Creates a Cash {isPositiveVariance ? 'In' : 'Out'} adjustment transaction so your recorded Cash in Hand matches your wallet.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Save & Log Wallet Cash Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={savingRecount}
                onPress={handleSaveRecount}
                style={styles.saveWalletCashBtn}
              >
                <Wallet size={18} color="#ffffff" />
                <Text style={styles.saveWalletCashBtnText}>
                  {savingRecount ? 'Saving...' : 'Save & Log Wallet Cash'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cancel Footer */}
            <View style={styles.recountFooter}>
              <Button
                title="Cancel"
                variant="secondary"
                size="sm"
                onPress={() => setShowRecount(false)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        {/* Notes & Coins Breakdown Card (Always Visible) */}
        <Card style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <View>
              <View style={styles.breakdownTitleRow}>
                <Coins size={16} color={colors.primary} />
                <Text style={[styles.breakdownTitle, { color: themeColors.textPrimary }]}>
                  Notes & Coins in Your Wallet
                </Text>
              </View>
              <Text style={styles.breakdownSub}>Bills currently in your pocket</Text>
            </View>
            <TouchableOpacity onPress={openRecountTool} style={styles.recountBtnSmall}>
              <Edit3 size={13} color={colors.primary} />
              <Text style={styles.recountBtnSmallText}>Recount</Text>
            </TouchableOpacity>
          </View>

          {/* Chips Grid */}
          <View style={styles.chipsGrid}>
            {INDIAN_DENOMINATIONS.map(note => {
              const count = parseInt(activeDenominations?.[note.value], 10) || 0;
              const subtotal = count * note.value;
              const hasNotes = count > 0;

              return (
                <View 
                  key={note.value}
                  style={[
                    styles.chipCard,
                    { backgroundColor: note.bg, borderColor: note.border },
                    !hasNotes && styles.chipCardMuted
                  ]}
                >
                  <View style={styles.chipTop}>
                    <Text style={[styles.chipLabel, { color: note.color }]}>{note.label}</Text>
                    {hasNotes && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>×{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.chipTotal, { color: hasNotes ? '#0f172a' : '#94a3b8' }]}>
                    {formatCurrency(subtotal)}
                  </Text>
                  <Text style={styles.chipBillsText}>
                    {count} {count === 1 ? 'bill' : 'bills'}
                  </Text>
                </View>
              );
            })}

            {/* Coins Chip */}
            <View style={[styles.chipCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
              <View style={styles.chipTop}>
                <Text style={[styles.chipLabel, { color: '#b45309' }]}>Coins</Text>
                <Coins size={12} color="#b45309" />
              </View>
              <Text style={[styles.chipTotal, { color: '#0f172a' }]}>
                {formatCurrency(parseFloat(activeDenominations?.coins) || 0)}
              </Text>
              <Text style={styles.chipBillsText}>Change</Text>
            </View>
          </View>
        </Card>

        {/* Cash History Section */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Cash Transactions History ({transactions.length})
          </Text>

          {transactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Banknote size={32} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No cash records yet</Text>
              <Text style={styles.emptySubtitle}>Tap "- Spend from Wallet" or "+ Add Cash" to start logging.</Text>
            </Card>
          ) : (
            <View style={styles.historyList}>
              {transactions.map(tx => {
                const isIncome = tx.amount > 0;
                return (
                  <TouchableOpacity
                    key={tx.id}
                    activeOpacity={0.7}
                    onPress={() => setSelectedTx(tx)}
                    style={[styles.txItem, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  >
                    <View style={styles.txLeft}>
                      <View style={[styles.txIconBox, { backgroundColor: isIncome ? '#f0fdf4' : colors.primaryMuted }]}>
                        {isIncome ? (
                          <TrendingUp size={18} color={colors.success} />
                        ) : (
                          <Banknote size={18} color={colors.primaryDark} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.txDescription, { color: themeColors.textPrimary }]} numberOfLines={1}>
                          {tx.description || tx.category}
                        </Text>
                        <View style={styles.txMetaRow}>
                          <Text style={styles.txDate}>{tx.dateStr}</Text>
                          <Badge text={tx.category || 'Cash'} variant={isIncome ? 'success' : 'cash'} />
                          {tx.notesSummary && (
                            <Text style={styles.notesTag} numberOfLines={1}>
                              {tx.notesSummary}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.txAmount, { color: isIncome ? colors.success : colors.danger }]}>
                      {formatCurrency(tx.amount, { showSign: true })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <SpendCashModal
        visible={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        mode={cashModalMode}
        currentWalletBalance={stats.cashBalance}
        currentDenominations={activeDenominations}
      />

      <TransactionDetailModal
        visible={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
      />
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
    paddingBottom: 110,
    gap: 16,
  },
  headerBox: {
    gap: 2,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  heroWalletCard: {
    borderRadius: 28,
    backgroundColor: '#064e3b',
    padding: 22,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletHeaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletLiveTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#a7f3d0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  walletDesc: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '500',
    marginTop: 1,
  },
  balanceContainer: {
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a7f3d0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statPillText: {
    fontSize: 12,
    color: '#a7f3d0',
    fontWeight: '600',
  },
  statPillBold: {
    color: '#ffffff',
    fontWeight: '900',
  },
  walletActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  spendActionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  spendActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  addActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    borderRadius: 16,
  },
  addActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  breakdownCard: {
    gap: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  breakdownSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  recountBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
  },
  recountBtnSmallText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipCard: {
    width: '31%',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  chipCardMuted: {
    opacity: 0.45,
  },
  chipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  countBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  chipTotal: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
  chipBillsText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  recountCard: {
    gap: 14,
    borderColor: '#a7f3d0',
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 18,
  },
  recountHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recountTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  recountIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  recountTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  recountInstruction: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  recountInputsRow: {
    gap: 10,
  },
  recountInputCol: {
    gap: 4,
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  amountPrefix: {
    fontSize: 18,
    fontWeight: '900',
    color: '#475569',
    marginRight: 6,
  },
  amountInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    paddingVertical: 10,
  },
  labelInputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  billCounterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  billCounterToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  billCounterContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  billCounterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  billCounterTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  recountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recountNoteCard: {
    width: '48.5%',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  recountNoteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recountNoteLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  recountNoteSubtotal: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  recountStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recountStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recountStepText: {
    fontSize: 15,
    fontWeight: '900',
  },
  recountInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
    paddingVertical: 0,
  },
  recountCoinsBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    borderRadius: 14,
  },
  recountCoinsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  recountCoinsSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 1,
  },
  coinsInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    width: 90,
  },
  coinPrefix: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
  },
  recountCoinsInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
    paddingVertical: 4,
    color: '#0f172a',
  },
  auditContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#fef08a',
    padding: 14,
    gap: 10,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  auditHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  auditHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
  },
  varianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  inSyncBadge: {
    backgroundColor: '#d1fae5',
    borderColor: '#a7f3d0',
  },
  varianceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  inSyncBadgeText: {
    color: '#047857',
  },
  auditRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  auditItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  auditItemValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  varianceHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  inSyncHighlightBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  varianceBoxTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.4,
  },
  inSyncBoxTitle: {
    color: '#065f46',
  },
  varianceBoxDesc: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    marginTop: 2,
  },
  inSyncBoxDesc: {
    color: '#047857',
  },
  varianceBoxAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#b45309',
  },
  inSyncBoxAmount: {
    color: '#047857',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 12,
  },
  checkboxIconWrap: {
    marginTop: 1,
  },
  checkboxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#064e3b',
  },
  checkboxSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: '#047857',
    marginTop: 2,
    lineHeight: 15,
  },
  saveWalletCashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  saveWalletCashBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  recountFooter: {
    flexDirection: 'row',
    paddingTop: 4,
  },
  historySection: {
    gap: 12,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  historyList: {
    gap: 8,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDescription: {
    fontSize: 13,
    fontWeight: '800',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  txDate: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  notesTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    maxWidth: 120,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 6,
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

export default CashWalletScreen;
