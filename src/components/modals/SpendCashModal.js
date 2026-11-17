import React, { useState, useEffect, useMemo } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert 
} from 'react-native';
import { 
  X, 
  Coins, 
  Banknote, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw,
  Wallet,
  ChevronDown,
  ChevronUp,
  Utensils,
  Coffee,
  ShoppingBag,
  ShoppingCart,
  Car,
  User as UserIcon,
  Sparkles,
  Check
} from 'lucide-react-native';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { INDIAN_DENOMINATIONS } from '../../config/constants';
import Button from '../common/Button';
import { colors } from '../../theme/colors';
import { notifyTransaction } from '../../services/notificationService';
import { navigate } from '../../navigation/navigationRef';

const CASH_EXPENSE_CATEGORIES = [
  'Food',
  'Tea & Snacks',
  'Transport',
  'Shopping',
  'Groceries',
  'Dining',
  'Personal',
  'Other'
];

const CASH_INCOME_CATEGORIES = [
  'ATM Withdrawal',
  'Salary in Cash',
  'Received from Friend',
  'Cash Allowance',
  'Refund',
  'Other'
];

const getCategoryMeta = (cat) => {
  switch (cat) {
    case 'Food':
      return { icon: Utensils, color: '#f97316', bg: '#fff7ed' };
    case 'Tea & Snacks':
      return { icon: Coffee, color: '#d97706', bg: '#fffbeb' };
    case 'Shopping':
      return { icon: ShoppingBag, color: '#3b82f6', bg: '#eff6ff' };
    case 'Groceries':
      return { icon: ShoppingCart, color: '#10b981', bg: '#ecfdf5' };
    case 'Transport':
      return { icon: Car, color: '#6366f1', bg: '#eef2ff' };
    case 'Dining':
      return { icon: Utensils, color: '#ef4444', bg: '#fef2f2' };
    case 'Personal':
      return { icon: UserIcon, color: '#06b6d4', bg: '#ecfeff' };
    case 'ATM Withdrawal':
      return { icon: Banknote, color: '#f97316', bg: '#fff7ed' };
    case 'Salary in Cash':
      return { icon: Banknote, color: '#10b981', bg: '#ecfdf5' };
    case 'Received from Friend':
      return { icon: UserIcon, color: '#6366f1', bg: '#eef2ff' };
    case 'Cash Allowance':
      return { icon: Coins, color: '#eab308', bg: '#fefce8' };
    case 'Refund':
      return { icon: RotateCcw, color: '#10b981', bg: '#ecfdf5' };
    case 'Other':
    default:
      return { icon: Sparkles, color: '#64748b', bg: '#f8fafc' };
  }
};

const SpendCashModal = ({ 
  visible, 
  onClose, 
  mode = 'expense', // 'expense' or 'income'
  currentWalletBalance = 0,
  currentDenominations = {},
  onSuccess 
}) => {
  const { user } = useAuth();
  const { symbol, formatCurrency, themeColors, isDarkMode } = useSettings();

  const [inputMode, setInputMode] = useState('notes'); // 'notes' or 'direct'
  const [directAmount, setDirectAmount] = useState('');
  const [selectedNotes, setSelectedNotes] = useState({
    500: '',
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
    coins: ''
  });
  const [category, setCategory] = useState(mode === 'expense' ? 'Food' : 'ATM Withdrawal');
  const [customCategory, setCustomCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowCategoryPicker(false);
      setInputMode('notes');
      setDirectAmount('');
      setSelectedNotes({
        500: '',
        200: '',
        100: '',
        50: '',
        20: '',
        10: '',
        coins: ''
      });
      setCategory(mode === 'expense' ? 'Food' : 'ATM Withdrawal');
      setCustomCategory('');
      setDescription('');
      setLoading(false);
    }
  }, [visible, mode]);

  // Calculate total from selected notes
  const notesTotal = useMemo(() => {
    const billSum = INDIAN_DENOMINATIONS.reduce((sum, item) => {
      const count = parseInt(selectedNotes[item.value], 10) || 0;
      return sum + (count * item.value);
    }, 0);
    const coinsSum = parseFloat(selectedNotes.coins) || 0;
    return billSum + coinsSum;
  }, [selectedNotes]);

  const finalAmount = inputMode === 'notes' ? notesTotal : parseFloat(directAmount) || 0;

  const projectedBalance = mode === 'expense'
    ? Math.max(0, currentWalletBalance - finalAmount)
    : currentWalletBalance + finalAmount;

  const notesSummary = useMemo(() => {
    if (inputMode !== 'notes' || notesTotal === 0) return null;
    const parts = [];
    INDIAN_DENOMINATIONS.forEach(d => {
      const count = parseInt(selectedNotes[d.value], 10) || 0;
      if (count > 0) parts.push(`${count} × ${d.label}`);
    });
    const coins = parseFloat(selectedNotes.coins) || 0;
    if (coins > 0) parts.push(`${symbol}${coins.toFixed(2)} coins`);
    return parts.join(', ');
  }, [inputMode, notesTotal, selectedNotes, symbol]);

  const handleStep = (val, delta) => {
    const current = parseInt(selectedNotes[val], 10) || 0;
    const available = parseInt(currentDenominations?.[val], 10) || 0;

    let next = current + delta;
    if (next < 0) next = 0;
    if (mode === 'expense' && available > 0 && next > available) {
      next = available;
    }

    setSelectedNotes(prev => ({
      ...prev,
      [val]: next === 0 ? '' : next
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (finalAmount <= 0) {
      Alert.alert('Specify Amount', 'Please select notes or enter an amount greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const finalCategory = category === 'Other' && customCategory.trim() 
        ? customCategory.trim() 
        : category;

      const txAmount = mode === 'expense' ? -Math.abs(finalAmount) : Math.abs(finalAmount);
      const desc = description.trim() || (mode === 'expense' ? `${finalCategory} in cash` : 'Cash added to wallet');
      const todayDate = new Date().toISOString().split('T')[0];

      // 1. Add transaction document
      const docRef = await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        amount: txAmount,
        category: finalCategory,
        description: desc,
        paymentMethod: 'Cash',
        date: todayDate,
        createdAt: serverTimestamp(),
        notesSummary: notesSummary || null
      });

      const loggedCashTx = {
        id: docRef.id,
        amount: txAmount,
        category: finalCategory,
        description: desc,
        paymentMethod: 'Cash',
        date: todayDate,
        notesSummary: notesSummary || null
      };

      // 2. Update remaining notes in user physical wallet
      if (inputMode === 'notes') {
        const updatedDenoms = {};
        INDIAN_DENOMINATIONS.forEach(note => {
          const currentCount = parseInt(currentDenominations?.[note.value], 10) || 0;
          const delta = parseInt(selectedNotes[note.value], 10) || 0;
          updatedDenoms[note.value] = mode === 'expense'
            ? Math.max(0, currentCount - delta)
            : currentCount + delta;
        });

        const currentCoins = parseFloat(currentDenominations?.coins) || 0;
        const deltaCoins = parseFloat(selectedNotes.coins) || 0;
        updatedDenoms.coins = mode === 'expense'
          ? Math.max(0, currentCoins - deltaCoins)
          : currentCoins + deltaCoins;

        await setDoc(doc(db, 'users', user.uid), {
          physicalWallet: {
            amount: projectedBalance,
            denominations: updatedDenoms,
            updatedAt: serverTimestamp()
          }
        }, { merge: true });
      }

      // Fire push / local notification
      notifyTransaction({
        type: mode,
        amount: finalAmount,
        category: finalCategory,
        paymentMethod: 'Cash',
        walletBalance: projectedBalance,
        transaction: loggedCashTx
      });

      if (onSuccess) onSuccess();
      onClose();

      navigate('LoggedTransaction', { transaction: loggedCashTx });
    } catch (err) {
      console.error("Error saving cash transaction:", err);
      Alert.alert('Error', 'Failed to record cash transaction.');
    } finally {
      setLoading(false);
    }
  };

  const categories = mode === 'expense' ? CASH_EXPENSE_CATEGORIES : CASH_INCOME_CATEGORIES;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: mode === 'expense' ? colors.dangerLight : colors.primaryMuted }]}>
                {mode === 'expense' ? (
                  <ArrowDownLeft size={20} color={colors.danger} />
                ) : (
                  <ArrowUpRight size={20} color={colors.primary} />
                )}
              </View>
              <View>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                  {mode === 'expense' ? 'Spend from Wallet' : 'Add Cash to Wallet'}
                </Text>
                <Text style={styles.walletSubtitle}>
                  In Wallet: <Text style={styles.walletBold}>{formatCurrency(currentWalletBalance)}</Text>
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Input Mode Toggle */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                onPress={() => setInputMode('notes')}
                style={[styles.modeTab, inputMode === 'notes' && styles.modeTabActive]}
              >
                <Coins size={14} color={inputMode === 'notes' ? colors.primaryDark : '#64748b'} />
                <Text style={[styles.modeTabText, inputMode === 'notes' && styles.modeTabTextActive]}>
                  {mode === 'expense' ? 'Pick Bills Spent' : 'Pick Bills Added'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setInputMode('direct')}
                style={[styles.modeTab, inputMode === 'direct' && styles.modeTabActive]}
              >
                <Banknote size={14} color={inputMode === 'direct' ? colors.primaryDark : '#64748b'} />
                <Text style={[styles.modeTabText, inputMode === 'direct' && styles.modeTabTextActive]}>
                  Type Amount
                </Text>
              </TouchableOpacity>
            </View>

            {/* Total Hero Box */}
            <View style={[styles.totalHero, { backgroundColor: mode === 'expense' ? '#fef2f2' : '#ecfdf5' }]}>
              <Text style={styles.totalHeroLabel}>
                {mode === 'expense' ? 'Cash to Deduct' : 'Cash to Add'}
              </Text>
              <Text style={[styles.totalHeroValue, { color: mode === 'expense' ? colors.danger : colors.primary }]}>
                {mode === 'expense' ? '-' : '+'}{formatCurrency(finalAmount)}
              </Text>
              {notesSummary && (
                <Text style={styles.notesSummaryText}>Bills: {notesSummary}</Text>
              )}
              <Text style={styles.walletAfterText}>
                Wallet After: <Text style={styles.walletAfterBold}>{formatCurrency(projectedBalance)}</Text>
              </Text>
            </View>

            {/* Notes Selector */}
            {inputMode === 'notes' ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: themeColors.textPrimary }}>
                    {mode === 'expense' ? 'Select Notes You Gave' : 'Select Notes You Received'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedNotes({ 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', coins: '' })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2 }}
                  >
                    <RotateCcw size={12} color="#ef4444" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444' }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.billsGrid}>
                {INDIAN_DENOMINATIONS.map(note => {
                  const available = parseInt(currentDenominations?.[note.value], 10) || 0;
                  const picked = selectedNotes[note.value] ?? '';
                  const hasInWallet = available > 0 || mode === 'income';

                  return (
                    <View 
                      key={note.value}
                      style={[
                        styles.billCard,
                        { backgroundColor: note.bg, borderColor: note.border },
                        !hasInWallet && mode === 'expense' && styles.billCardDisabled
                      ]}
                    >
                      <View style={styles.billHeader}>
                        <Text style={[styles.billLabel, { color: note.color }]}>{note.label}</Text>
                        {mode === 'expense' && (
                          <Text style={styles.billAvailable}>({available} left)</Text>
                        )}
                      </View>

                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          onPress={() => handleStep(note.value, -1)}
                          style={styles.stepBtn}
                        >
                          <Text style={styles.stepBtnText}>-</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={String(picked)}
                          onChangeText={(txt) => {
                            const val = txt === '' ? '' : Math.max(0, parseInt(txt, 10) || 0);
                            setSelectedNotes(p => ({ ...p, [note.value]: val }));
                          }}
                          placeholder="0"
                          keyboardType="number-pad"
                          style={styles.stepInput}
                        />
                        <TouchableOpacity
                          onPress={() => handleStep(note.value, 1)}
                          style={[styles.stepBtn, { backgroundColor: colors.primaryMuted }]}
                        >
                          <Text style={[styles.stepBtnText, { color: colors.primary }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Loose Coins Box */}
                <View style={styles.coinsBox}>
                  <Text style={styles.coinsLabel}>Loose Coins / Change ({symbol})</Text>
                  <TextInput
                    value={String(selectedNotes.coins)}
                    onChangeText={(txt) => setSelectedNotes(p => ({ ...p, coins: txt }))}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    style={styles.coinsInput}
                  />
                </View>
              </View>
            </View>
            ) : (
              <View style={styles.directInputBox}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Amount</Text>
                <TextInput
                  value={directAmount}
                  onChangeText={setDirectAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  style={[styles.directInput, { color: themeColors.textPrimary }]}
                  autoFocus
                />
              </View>
            )}

            {/* Category Selector */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Category</Text>
                <TouchableOpacity 
                  onPress={() => setShowCategoryPicker(prev => !prev)} 
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
                    {showCategoryPicker ? 'Collapse ▲' : `View All (${categories.length}) ▼`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Web-Style Dropdown Bar */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowCategoryPicker(prev => !prev)}
                style={[
                  styles.categoryDropdownBar,
                  { 
                    borderColor: showCategoryPicker ? colors.primary : themeColors.border,
                    backgroundColor: isDarkMode ? themeColors.surfaceSubtle : '#ffffff' 
                  }
                ]}
              >
                <View style={styles.categoryDropdownLeft}>
                  {(() => {
                    const meta = getCategoryMeta(category);
                    const SelectedCatIcon = meta.icon;
                    return (
                      <>
                        <View style={[styles.categoryIconBadge, { backgroundColor: isDarkMode ? '#1e293b' : meta.bg }]}>
                          <SelectedCatIcon size={18} color={meta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.categorySelectedName, { color: themeColors.textPrimary }]}>
                            {category}
                          </Text>
                          <Text style={[styles.categorySelectedSubtitle, { color: themeColors.textMuted }]}>
                            {showCategoryPicker ? 'Tap any card below to select' : 'Tap to choose from all categories'}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
                <View style={[styles.dropdownChevronCircle, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
                  {showCategoryPicker ? (
                    <ChevronUp size={16} color={colors.primary} />
                  ) : (
                    <ChevronDown size={16} color={themeColors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Full Category Grid when expanded */}
              {showCategoryPicker ? (
                <View style={styles.categoryGridContainer}>
                  <View style={styles.categoryGrid}>
                    {categories.map(cat => {
                      const isSelected = category === cat;
                      const meta = getCategoryMeta(cat);
                      const CatIcon = meta.icon;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => {
                            setCategory(cat);
                            setShowCategoryPicker(false);
                          }}
                          activeOpacity={0.7}
                          style={[
                            styles.categoryGridCard,
                            {
                              borderColor: isSelected ? colors.primary : themeColors.border,
                              backgroundColor: isSelected 
                                ? (isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5') 
                                : (isDarkMode ? themeColors.surfaceSubtle : '#ffffff')
                            }
                          ]}
                        >
                          <View style={[styles.categoryGridIconBox, { backgroundColor: isDarkMode ? '#1e293b' : meta.bg }]}>
                            <CatIcon size={16} color={meta.color} />
                          </View>
                          <Text 
                            numberOfLines={1} 
                            style={[
                              styles.categoryGridText,
                              { color: isSelected ? colors.primary : themeColors.textPrimary },
                              isSelected && { fontWeight: '900' }
                            ]}
                          >
                            {cat}
                          </Text>
                          {isSelected && (
                            <View style={styles.categoryGridCheckBadge}>
                              <Check size={9} color="#ffffff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* Quick selection chips when collapsed */
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.categoryQuickScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {categories.slice(0, 5).map(cat => {
                    const isSelected = category === cat;
                    const meta = getCategoryMeta(cat);
                    const CatIcon = meta.icon;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategory(cat)}
                        activeOpacity={0.7}
                        style={[
                          styles.categoryQuickChip,
                          { 
                            borderColor: isSelected ? colors.primary : themeColors.border,
                            backgroundColor: isSelected 
                              ? colors.primary 
                              : (isDarkMode ? themeColors.surfaceSubtle : '#f8fafc')
                          }
                        ]}
                      >
                        <CatIcon size={13} color={isSelected ? '#ffffff' : meta.color} />
                        <Text style={[
                          styles.categoryQuickChipText,
                          { color: isSelected ? '#ffffff' : themeColors.textPrimary },
                          isSelected && { fontWeight: '900' }
                        ]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {categories.length > 5 && (
                    <TouchableOpacity
                      onPress={() => setShowCategoryPicker(true)}
                      activeOpacity={0.7}
                      style={[
                        styles.categoryQuickChipMore,
                        { borderColor: themeColors.border, backgroundColor: isDarkMode ? themeColors.surfaceSubtle : '#f1f5f9' }
                      ]}
                    >
                      <Text style={[styles.categoryQuickChipMoreText, { color: colors.primary }]}>
                        + More ({categories.length - 5})
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>

            {/* Custom Category Input if 'Other' */}
            {category === 'Other' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Specify Category</Text>
                <TextInput
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder="e.g. Street Food, Auto, Rickshaw"
                  placeholderTextColor={themeColors.textMuted}
                  style={[styles.textInput, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceSubtle, color: themeColors.textPrimary }]}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Description / Memo</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={mode === 'expense' ? 'e.g. Lunch with team, Auto to station' : 'e.g. ATM SBI withdrawal'}
                placeholderTextColor={themeColors.textMuted}
                style={[styles.textInput, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceSubtle, color: themeColors.textPrimary }]}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title={loading ? 'Updating...' : mode === 'expense' ? `Deduct -${formatCurrency(finalAmount)}` : `Add +${formatCurrency(finalAmount)}`}
              variant={mode === 'expense' ? 'danger' : 'primary'}
              onPress={handleSave}
              loading={loading}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  walletSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  walletBold: {
    fontWeight: '900',
    color: colors.primary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 14,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: '#0f172a',
    fontWeight: '900',
  },
  totalHero: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  totalHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
  },
  totalHeroValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  notesSummaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDarker,
    marginTop: 4,
  },
  walletAfterText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  walletAfterBold: {
    fontWeight: '900',
    color: '#0f172a',
  },
  billsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  billCard: {
    width: '48.5%',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  billCardDisabled: {
    opacity: 0.45,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  billAvailable: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  stepInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    paddingVertical: 2,
  },
  coinsBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    borderRadius: 16,
    marginTop: 4,
  },
  coinsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  coinsInput: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '900',
    padding: 4,
  },
  directInputBox: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  directInput: {
    fontSize: 28,
    fontWeight: '900',
    padding: 0,
    marginTop: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryDropdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  categoryDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySelectedName: {
    fontSize: 15,
    fontWeight: '800',
  },
  categorySelectedSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  dropdownChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  categoryGridContainer: {
    paddingTop: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryGridCard: {
    width: '31.3%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    position: 'relative',
    gap: 6,
  },
  categoryGridIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGridText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryGridCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryQuickScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  categoryQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryQuickChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryQuickChipMore: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryQuickChipMoreText: {
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 12,
  },
});

export default SpendCashModal;

