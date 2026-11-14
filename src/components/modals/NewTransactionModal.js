import React, { useState, useEffect } from 'react';
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
  Alert 
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
  Building2 
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { notifyTransaction } from '../../services/notificationService';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../config/constants';
import Button from '../common/Button';
import { colors } from '../../theme/colors';

const NewTransactionModal = ({ visible, onClose, defaultType = 'expense', defaultPaymentMethod = 'Online / UPI', onSuccess }) => {
  const { user } = useAuth();
  const { symbol, themeColors, isDarkMode } = useSettings();

  const [type, setType] = useState(defaultType); // 'expense' or 'income'
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultType === 'income' ? 'Salary' : 'Shopping');
  const [customCategory, setCustomCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [receiptImage, setReceiptImage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setType(defaultType);
      setAmount('');
      setCategory(defaultType === 'income' ? 'Salary' : 'Shopping');
      setCustomCategory('');
      setPaymentMethod(defaultPaymentMethod);
      setDescription('');
      setDateStr(new Date().toISOString().split('T')[0]);
      setReceiptImage(null);
      setLoading(false);
    }
  }, [visible, defaultType, defaultPaymentMethod]);

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

    setLoading(true);
    try {
      let receiptUrl = null;
      if (receiptImage) {
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

      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        amount: txAmount,
        category: finalCategory,
        description: description.trim() || finalCategory,
        paymentMethod: paymentMethod,
        date: dateStr,
        createdAt: serverTimestamp(),
        receiptUrl: receiptUrl
      });

      // Fire notification
      notifyTransaction({
        type: type,
        amount: numAmount,
        category: finalCategory,
        paymentMethod: paymentMethod
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error creating transaction:", err);
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {type === 'expense' ? 'Add Expense' : 'Add Income'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Type Switcher Tabs */}
            <View style={styles.typeTabs}>
              <TouchableOpacity
                onPress={() => { setType('expense'); setCategory('Shopping'); }}
                style={[styles.typeTab, type === 'expense' && styles.typeTabExpenseActive]}
              >
                <Text style={[styles.typeTabText, type === 'expense' && styles.typeTabTextActive]}>
                  Expense (-)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setType('income'); setCategory('Salary'); }}
                style={[styles.typeTab, type === 'income' && styles.typeTabIncomeActive]}
              >
                <Text style={[styles.typeTabText, type === 'income' && styles.typeTabTextActive]}>
                  Income (+)
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
                  autoFocus
                />
              </View>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Payment Method</Text>
              <View style={styles.pillRow}>
                {PAYMENT_METHODS.map(m => {
                  const isSelected = paymentMethod === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setPaymentMethod(m)}
                      style={[
                        styles.methodPill,
                        { borderColor: isSelected ? colors.primary : themeColors.border },
                        isSelected && { backgroundColor: colors.primaryMuted }
                      ]}
                    >
                      <Text style={[
                        styles.methodPillText,
                        { color: isSelected ? colors.primaryDark : themeColors.textSecondary },
                        isSelected && { fontWeight: '900' }
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Category Pills */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {categories.map(cat => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.categoryChip,
                        { borderColor: isSelected ? colors.primary : themeColors.border },
                        isSelected && { backgroundColor: colors.primary }
                      ]}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        { color: isSelected ? '#ffffff' : themeColors.textSecondary },
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
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title={loading ? 'Saving...' : type === 'expense' ? 'Save Expense' : 'Save Income'}
              variant={type === 'expense' ? 'danger' : 'primary'}
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
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
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  typeTabTextActive: {
    color: '#0f172a',
    fontWeight: '900',
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
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  currencyPrefix: {
    fontSize: 26,
    fontWeight: '900',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    padding: 0,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  imageBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  imagePreviewBox: {
    position: 'relative',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    padding: 6,
    borderRadius: 20,
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 12,
  },
});

export default NewTransactionModal;

