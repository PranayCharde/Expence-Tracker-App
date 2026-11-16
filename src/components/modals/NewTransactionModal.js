import React, { useState, useEffect, useMemo } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { 
  X, 
  Calendar, 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  Banknote, 
  Smartphone, 
  CreditCard, 
  Building2,
  Coins,
  RotateCcw
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, updateDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { notifyTransaction } from '../../services/notificationService';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, INDIAN_DENOMINATIONS } from '../../config/constants';
import { getTodayDateString, getYesterdayDateString, formatTransactionDate } from '../../utils/formatDate';
import Button from '../common/Button';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';

const NewTransactionModal = ({ 
  visible, 
  onClose, 
  defaultType = 'expense', 
  defaultPaymentMethod = 'Online / UPI', 
  initialTransaction = null,
  onSuccess 
}) => {
  const { user } = useAuth();
  const { symbol, themeColors, isDarkMode } = useSettings();

  const isEditMode = !!initialTransaction;

  const [type, setType] = useState(defaultType); // 'expense' or 'income'
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultType === 'income' ? 'Salary' : 'Shopping');
  const [customCategory, setCustomCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(getTodayDateString());
  const [receiptImage, setReceiptImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cash denomination notes state
  const [cashInputMode, setCashInputMode] = useState('notes'); // 'notes' or 'direct'
  const [selectedNotes, setSelectedNotes] = useState({
    500: '',
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
    coins: ''
  });
  const [walletDenominations, setWalletDenominations] = useState({});
  const [walletBalance, setWalletBalance] = useState(0);

  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  useEffect(() => {
    if (visible) {
      setCashInputMode('notes');
      setSelectedNotes({
        500: '',
        200: '',
        100: '',
        50: '',
        20: '',
        10: '',
        coins: ''
      });

      if (initialTransaction) {
        // Populate edit mode
        const isTxIncome = initialTransaction.amount > 0;
        setType(isTxIncome ? 'income' : 'expense');
        setAmount(Math.abs(initialTransaction.amount).toString());
        setPaymentMethod(initialTransaction.paymentMethod || defaultPaymentMethod);
        setDescription(initialTransaction.description || '');

        let parsedDate = todayStr;
        if (initialTransaction.date) {
          parsedDate = typeof initialTransaction.date === 'string' 
            ? initialTransaction.date.split('T')[0] 
            : todayStr;
        }
        setDateStr(parsedDate);

        const allCats = isTxIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        if (allCats.includes(initialTransaction.category)) {
          setCategory(initialTransaction.category);
          setCustomCategory('');
        } else {
          setCategory('Other');
          setCustomCategory(initialTransaction.category || '');
        }

        setReceiptImage(initialTransaction.receiptUrl || null);
      } else {
        // Reset for new transaction
        setType(defaultType);
        setAmount('');
        setCategory(defaultType === 'income' ? 'Salary' : 'Shopping');
        setCustomCategory('');
        setPaymentMethod(defaultPaymentMethod);
        setDescription('');
        setDateStr(todayStr);
        setReceiptImage(null);
      }
      setLoading(false);

      // Load user's physical wallet data
      if (user) {
        getDoc(doc(db, 'users', user.uid))
          .then(snap => {
            if (snap.exists()) {
              const data = snap.data();
              if (data.physicalWallet) {
                setWalletDenominations(data.physicalWallet.denominations || {});
                setWalletBalance(parseFloat(data.physicalWallet.amount) || 0);
              }
            }
          })
          .catch(err => console.warn('Could not load physical wallet:', err));
      }
    }
  }, [visible, initialTransaction, defaultType, defaultPaymentMethod]);

  // Calculate notes total
  const notesTotal = useMemo(() => {
    const billSum = INDIAN_DENOMINATIONS.reduce((sum, item) => {
      const count = parseInt(selectedNotes[item.value], 10) || 0;
      return sum + (count * item.value);
    }, 0);
    const coinsSum = parseFloat(selectedNotes.coins) || 0;
    return billSum + coinsSum;
  }, [selectedNotes]);

  const handleNoteStep = (val, delta) => {
    const current = parseInt(selectedNotes[val], 10) || 0;
    const available = parseInt(walletDenominations?.[val], 10) || 0;

    let next = current + delta;
    if (next < 0) next = 0;
    if (type === 'expense' && available > 0 && next > available) {
      next = available;
    }

    const updated = { ...selectedNotes, [val]: next === 0 ? '' : next };
    setSelectedNotes(updated);

    const billSum = INDIAN_DENOMINATIONS.reduce((sum, item) => {
      const count = parseInt(updated[item.value], 10) || 0;
      return sum + (count * item.value);
    }, 0);
    const coinsSum = parseFloat(updated.coins) || 0;
    const newTotal = billSum + coinsSum;
    setAmount(newTotal > 0 ? newTotal.toString() : '');
  };

  const handleNoteDirectChange = (val, txt) => {
    const clean = txt === '' ? '' : Math.max(0, parseInt(txt, 10) || 0);
    const updated = { ...selectedNotes, [val]: clean };
    setSelectedNotes(updated);

    const billSum = INDIAN_DENOMINATIONS.reduce((sum, item) => {
      const count = parseInt(updated[item.value], 10) || 0;
      return sum + (count * item.value);
    }, 0);
    const coinsSum = parseFloat(updated.coins) || 0;
    const newTotal = billSum + coinsSum;
    setAmount(newTotal > 0 ? newTotal.toString() : '');
  };

  const handleCoinsChange = (txt) => {
    const clean = txt === '' ? '' : Math.max(0, parseFloat(txt) || 0);
    const updated = { ...selectedNotes, coins: clean };
    setSelectedNotes(updated);

    const billSum = INDIAN_DENOMINATIONS.reduce((sum, item) => {
      const count = parseInt(updated[item.value], 10) || 0;
      return sum + (count * item.value);
    }, 0);
    const coinsSum = parseFloat(updated.coins) || 0;
    const newTotal = billSum + coinsSum;
    setAmount(newTotal > 0 ? newTotal.toString() : '');
  };

  const handleClearNotes = () => {
    setSelectedNotes({ 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', coins: '' });
    if (cashInputMode === 'notes') {
      setAmount('');
    }
  };

  const notesSummary = useMemo(() => {
    if (paymentMethod !== 'Cash' || notesTotal === 0) return null;
    const parts = [];
    INDIAN_DENOMINATIONS.forEach(d => {
      const count = parseInt(selectedNotes[d.value], 10) || 0;
      if (count > 0) parts.push(`${count} × ${d.label}`);
    });
    const coins = parseFloat(selectedNotes.coins) || 0;
    if (coins > 0) parts.push(`${symbol}${coins.toFixed(2)} coins`);
    return parts.join(', ');
  }, [paymentMethod, notesTotal, selectedNotes, symbol]);

  const projectedBalance = useMemo(() => {
    const parsed = parseFloat(amount) || 0;
    if (type === 'expense') {
      return Math.max(0, walletBalance - parsed);
    }
    return walletBalance + parsed;
  }, [type, walletBalance, amount]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access photos is needed for receipt attachments.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Camera permission is needed to snap receipt photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    // Validate date format YYYY-MM-DD
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setLoading(true);
    try {
      let receiptUrl = receiptImage;
      // If a local image was picked/taken, upload it
      if (receiptImage && (receiptImage.startsWith('file:') || receiptImage.startsWith('content:'))) {
        try {
          const response = await fetch(receiptImage);
          const blob = await response.blob();
          const fileRef = ref(storage, `users/${user.uid}/receipts/${Date.now()}_receipt.jpg`);
          await uploadBytes(fileRef, blob);
          receiptUrl = await getDownloadURL(fileRef);
        } catch (uploadErr) {
          console.error("Receipt upload error:", uploadErr);
        }
      }

      const finalCategory = category === 'Other' && customCategory.trim() 
        ? customCategory.trim() 
        : category;

      const txAmount = type === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount);
      const cleanDate = dateStr.trim();

      if (isEditMode) {
        // Update existing transaction
        await updateDoc(doc(db, 'users', user.uid, 'transactions', initialTransaction.id), {
          amount: txAmount,
          category: finalCategory,
          description: description.trim() || finalCategory,
          paymentMethod: paymentMethod,
          date: cleanDate,
          notesSummary: (paymentMethod === 'Cash' && notesSummary) ? notesSummary : null,
          receiptUrl: receiptUrl || null
        });
      } else {
        // Create new transaction
        await addDoc(collection(db, 'users', user.uid, 'transactions'), {
          amount: txAmount,
          category: finalCategory,
          description: description.trim() || finalCategory,
          paymentMethod: paymentMethod,
          date: cleanDate,
          notesSummary: (paymentMethod === 'Cash' && notesSummary) ? notesSummary : null,
          createdAt: serverTimestamp(),
          receiptUrl: receiptUrl || null
        });

        // Fire notification for new records
        notifyTransaction({
          type: type,
          amount: numAmount,
          category: finalCategory,
          paymentMethod: paymentMethod
        });
      }

      // If Cash and user used notes, sync physicalWallet denominations
      if (paymentMethod === 'Cash' && notesTotal > 0 && cashInputMode === 'notes') {
        try {
          const updatedDenoms = {};
          INDIAN_DENOMINATIONS.forEach(d => {
            const currentCount = parseInt(walletDenominations?.[d.value], 10) || 0;
            const delta = parseInt(selectedNotes[d.value], 10) || 0;
            const nextCount = type === 'expense'
              ? Math.max(0, currentCount - delta)
              : currentCount + delta;
            updatedDenoms[d.value] = nextCount;
          });

          const currentCoins = parseFloat(walletDenominations?.coins) || 0;
          const deltaCoins = parseFloat(selectedNotes.coins) || 0;
          updatedDenoms.coins = type === 'expense'
            ? Math.max(0, currentCoins - deltaCoins)
            : currentCoins + deltaCoins;

          await setDoc(doc(db, 'users', user.uid), {
            physicalWallet: {
              amount: projectedBalance,
              denominations: updatedDenoms,
              updatedAt: serverTimestamp()
            }
          }, { merge: true });
        } catch (walletSyncErr) {
          console.warn('Could not sync physical wallet denominations:', walletSyncErr);
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving transaction:", err);
      Alert.alert('Error', isEditMode ? 'Failed to update transaction.' : 'Failed to save transaction.');
    } finally {
      setLoading(false);
    }
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.overlay}
      >
        <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {isEditMode ? 'Edit Transaction' : (type === 'expense' ? 'Add Expense' : 'Add Income')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Income / Expense Tabs */}
            <View style={[styles.typeTabs, { backgroundColor: isDarkMode ? themeColors.surfaceSubtle : '#f1f5f9' }]}>
              <TouchableOpacity
                onPress={() => {
                  setType('expense');
                  if (!isEditMode) setCategory('Shopping');
                }}
                style={[
                  styles.typeTab, 
                  type === 'expense' && [styles.typeTabExpenseActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]
                ]}
              >
                <Text style={[
                  styles.typeTabText,
                  type === 'expense' ? { color: colors.danger, fontWeight: '900' } : { color: themeColors.textSecondary }
                ]}>
                  Expense
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setType('income');
                  if (!isEditMode) setCategory('Salary');
                }}
                style={[
                  styles.typeTab, 
                  type === 'income' && [styles.typeTabIncomeActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]
                ]}
              >
                <Text style={[
                  styles.typeTabText,
                  type === 'income' ? { color: colors.success, fontWeight: '900' } : { color: themeColors.textSecondary }
                ]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Amount</Text>
              <View style={[styles.amountContainer, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceSubtle }]}>
                <Text style={[styles.currencyPrefix, { color: type === 'expense' ? colors.danger : colors.success }]}>
                  {type === 'expense' ? '-' : '+'}{symbol}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: themeColors.textPrimary }]}
                  autoFocus={!isEditMode}
                />
              </View>
            </View>

            {/* Transaction Date Picker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Transaction Date</Text>
              <View style={styles.dateSelectorRow}>
                <TouchableOpacity
                  onPress={() => setDateStr(todayStr)}
                  style={[
                    styles.dateQuickPill,
                    { borderColor: dateStr === todayStr ? colors.primary : themeColors.border },
                    dateStr === todayStr && { backgroundColor: colors.primaryMuted }
                  ]}
                >
                  <Text style={[
                    styles.dateQuickPillText,
                    { color: dateStr === todayStr ? colors.primaryDark : themeColors.textSecondary },
                    dateStr === todayStr && { fontWeight: '900' }
                  ]}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setDateStr(yesterdayStr)}
                  style={[
                    styles.dateQuickPill,
                    { borderColor: dateStr === yesterdayStr ? colors.primary : themeColors.border },
                    dateStr === yesterdayStr && { backgroundColor: colors.primaryMuted }
                  ]}
                >
                  <Text style={[
                    styles.dateQuickPillText,
                    { color: dateStr === yesterdayStr ? colors.primaryDark : themeColors.textSecondary },
                    dateStr === yesterdayStr && { fontWeight: '900' }
                  ]}>
                    Yesterday
                  </Text>
                </TouchableOpacity>

                <View style={[styles.dateInputWrapper, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceSubtle }]}>
                  <Calendar size={14} color={colors.primary} />
                  <TextInput
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={themeColors.textMuted}
                    style={[styles.dateTextInput, { color: themeColors.textPrimary }]}
                  />
                </View>
              </View>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Payment Method</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: paymentMethod === 'Cash' ? colors.primary : colors.info }}>
                  {paymentMethod === 'Cash' ? (type === 'expense' ? '💵 Cash Expense' : '💵 Cash Income') : '⚡ Digital / Online'}
                </Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.methodScroll}
                keyboardShouldPersistTaps="handled"
              >
                {PAYMENT_METHODS.map(m => {
                  const isSelected = paymentMethod === m;
                  const renderIcon = () => {
                    const iconColor = isSelected ? '#ffffff' : (m === 'Cash' ? colors.primary : m === 'Online / UPI' ? '#3b82f6' : m.includes('Card') ? '#a855f7' : '#f59e0b');
                    if (m === 'Cash') return <Banknote size={15} color={iconColor} />;
                    if (m === 'Online / UPI') return <Smartphone size={15} color={iconColor} />;
                    if (m.includes('Card')) return <CreditCard size={15} color={iconColor} />;
                    return <Building2 size={15} color={iconColor} />;
                  };

                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setPaymentMethod(m)}
                      activeOpacity={0.7}
                      style={[
                        styles.methodPill,
                        { 
                          borderColor: isSelected ? colors.primary : themeColors.border,
                          backgroundColor: isSelected 
                            ? colors.primary 
                            : (isDarkMode ? themeColors.surfaceSubtle : '#f8fafc')
                        }
                      ]}
                    >
                      {renderIcon()}
                      <Text style={[
                        styles.methodPillText,
                        { color: isSelected ? '#ffffff' : themeColors.textPrimary },
                        isSelected && { fontWeight: '900' }
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Cash Denomination Notes Picker (when Cash selected) */}
            {paymentMethod === 'Cash' && (
              <View style={[styles.cashSectionBox, { backgroundColor: themeColors.surfaceSubtle, borderColor: themeColors.border }]}>
                {/* Cash Mode Toggle */}
                <View style={[styles.cashModeTabs, { backgroundColor: isDarkMode ? themeColors.surfaceSubtle : '#f1f5f9' }]}>
                  <TouchableOpacity
                    onPress={() => setCashInputMode('notes')}
                    style={[
                      styles.cashModeTab, 
                      cashInputMode === 'notes' && [styles.cashModeTabActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]
                    ]}
                  >
                    <Banknote size={14} color={cashInputMode === 'notes' ? colors.primary : themeColors.textSecondary} />
                    <Text style={[
                      styles.cashModeTabText, 
                      { color: themeColors.textSecondary },
                      cashInputMode === 'notes' && { color: themeColors.textPrimary, fontWeight: '900' }
                    ]}>
                      Select Notes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCashInputMode('direct')}
                    style={[
                      styles.cashModeTab, 
                      cashInputMode === 'direct' && [styles.cashModeTabActive, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]
                    ]}
                  >
                    <Text style={[
                      styles.cashModeTabText, 
                      { color: themeColors.textSecondary },
                      cashInputMode === 'direct' && { color: themeColors.textPrimary, fontWeight: '900' }
                    ]}>
                      Type Direct Amount
                    </Text>
                  </TouchableOpacity>
                </View>

                {cashInputMode === 'notes' ? (
                  <View style={{ gap: 10 }}>
                    <View style={styles.cashNotesHeader}>
                      <Text style={[styles.cashNotesTitle, { color: themeColors.textPrimary }]}>
                        {type === 'expense' ? 'Select Notes You Gave' : 'Select Notes You Received'}
                      </Text>
                      <TouchableOpacity onPress={handleClearNotes} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <RotateCcw size={12} color="#ef4444" />
                        <Text style={styles.clearBtnText}>Clear</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Denominations Grid */}
                    <View style={styles.billsGrid}>
                      {INDIAN_DENOMINATIONS.map(note => {
                        const available = parseInt(walletDenominations?.[note.value], 10) || 0;
                        const picked = selectedNotes[note.value] ?? '';
                        const isAvailable = available > 0 || type === 'income';

                        return (
                          <View
                            key={note.value}
                            style={[
                              styles.billCard,
                              { backgroundColor: note.bg, borderColor: note.border },
                              !isAvailable && type === 'expense' && styles.billCardDisabled
                            ]}
                          >
                            <View style={styles.billHeader}>
                              <Text style={[styles.billValue, { color: note.color }]}>{note.label}</Text>
                              {type === 'expense' && (
                                <Text style={styles.billAvailable}>({available} left)</Text>
                              )}
                            </View>

                            <View style={styles.stepperRow}>
                              <TouchableOpacity
                                onPress={() => handleNoteStep(note.value, -1)}
                                style={[styles.stepBtn, isDarkMode && { backgroundColor: '#334155' }]}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text style={[styles.stepBtnText, isDarkMode && { color: '#f8fafc' }]}>-</Text>
                              </TouchableOpacity>
                              <TextInput
                                value={String(picked)}
                                onChangeText={(txt) => handleNoteDirectChange(note.value, txt)}
                                placeholder="0"
                                placeholderTextColor={themeColors.textMuted}
                                keyboardType="number-pad"
                                style={[
                                  styles.stepInput,
                                  {
                                    backgroundColor: isDarkMode ? themeColors.surface : '#ffffff',
                                    borderColor: isDarkMode ? themeColors.border : '#cbd5e1',
                                    color: themeColors.textPrimary
                                  }
                                ]}
                              />
                              <TouchableOpacity
                                onPress={() => handleNoteStep(note.value, 1)}
                                style={[styles.stepBtn, { backgroundColor: colors.primaryMuted }]}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text style={[styles.stepBtnText, { color: colors.primary }]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Loose Coins Box */}
                    <View style={[styles.coinsBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Coins size={14} color="#f59e0b" />
                        <Text style={[styles.coinsLabel, { color: themeColors.textSecondary }]}>
                          Coins / Change ({symbol})
                        </Text>
                      </View>
                      <TextInput
                        value={String(selectedNotes.coins)}
                        onChangeText={handleCoinsChange}
                        placeholder="0.00"
                        placeholderTextColor={themeColors.textMuted}
                        keyboardType="decimal-pad"
                        style={[styles.coinsInput, { color: themeColors.textPrimary }]}
                      />
                    </View>

                    {/* Notes Summary & Wallet Projection */}
                    <View style={styles.cashSummaryBox}>
                      {notesSummary ? (
                        <Text style={styles.notesSummaryText}>Bills: {notesSummary}</Text>
                      ) : null}
                      {walletBalance > 0 && (
                        <Text style={[styles.walletAfterText, { color: themeColors.textSecondary }]}>
                          Wallet balance: {symbol}{walletBalance.toFixed(2)} → after: <Text style={styles.walletAfterBold}>{symbol}{projectedBalance.toFixed(2)}</Text>
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.cashDirectHint, { color: themeColors.textMuted }]}>
                    Direct amount mode active. Enter the amount in the field above.
                  </Text>
                )}
              </View>
            )}

            {/* Category Pills */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary, marginBottom: 2 }]}>Category</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.categoryScroll}
                keyboardShouldPersistTaps="handled"
              >
                {categories.map(cat => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.7}
                      style={[
                        styles.categoryChip,
                        { 
                          borderColor: isSelected ? colors.primary : themeColors.border,
                          backgroundColor: isSelected 
                            ? colors.primary 
                            : (isDarkMode ? themeColors.surfaceSubtle : '#f8fafc')
                        }
                      ]}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        { color: isSelected ? '#ffffff' : themeColors.textPrimary },
                        isSelected && { fontWeight: '900' }
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Custom Category Input if 'Other' */}
            {category === 'Other' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Custom Category Name</Text>
                <TextInput
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder="e.g. Street Food, Gym, Subscriptions"
                  placeholderTextColor={themeColors.textMuted}
                  style={[styles.textInput, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceSubtle, color: themeColors.textPrimary }]}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Description / Note</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Dinner with friends, Uber ride"
                placeholderTextColor={themeColors.textMuted}
                style={[styles.textInput, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceSubtle, color: themeColors.textPrimary }]}
              />
            </View>

            {/* Receipt Image Attachment */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Attach Receipt (Optional)</Text>
              {receiptImage ? (
                <View style={styles.imagePreviewBox}>
                  <Image source={{ uri: receiptImage }} style={styles.previewImage} />
                  <TouchableOpacity onPress={() => setReceiptImage(null)} style={styles.removeImageBtn}>
                    <Trash2 size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imageActionRow}>
                  <TouchableOpacity onPress={takePhoto} style={[styles.imageBtn, { borderColor: themeColors.border }]}>
                    <Camera size={16} color={colors.primary} />
                    <Text style={[styles.imageBtnText, { color: colors.primary }]}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickImage} style={[styles.imageBtn, { borderColor: themeColors.border }]}>
                    <ImageIcon size={16} color={colors.primary} />
                    <Text style={[styles.imageBtnText, { color: colors.primary }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title={loading ? 'Saving...' : isEditMode ? 'Update Transaction' : (type === 'expense' ? 'Save Expense' : 'Save Income')}
              variant={type === 'expense' ? 'danger' : 'primary'}
              onPress={handleSave}
              loading={loading}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  typeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  typeTabExpenseActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeTabIncomeActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '900',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateQuickPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateQuickPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    padding: 0,
  },
  methodScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  imageBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  imagePreviewBox: {
    position: 'relative',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cashSectionBox: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  cashModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 3,
  },
  cashModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
  },
  cashModeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cashModeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  cashModeTabTextActive: {
    color: '#0f172a',
    fontWeight: '900',
  },
  cashNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cashNotesTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
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
    marginBottom: 8,
  },
  billValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  billAvailable: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#334155',
  },
  stepInput: {
    flex: 1,
    height: 30,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    padding: 0,
  },
  coinsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  coinsLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  coinsInput: {
    width: 80,
    height: 30,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    padding: 0,
  },
  cashSummaryBox: {
    gap: 2,
    paddingTop: 2,
  },
  notesSummaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDarker,
  },
  walletAfterText: {
    fontSize: 11,
  },
  walletAfterBold: {
    fontWeight: '900',
    color: colors.primary,
  },
  cashDirectHint: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default NewTransactionModal;
