import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert 
} from 'react-native';
import { 
  X, 
  Calendar, 
  Tag, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  Trash2, 
  FileText,
  Pencil 
} from 'lucide-react-native';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { formatTransactionDate } from '../../utils/formatDate';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { colors } from '../../theme/colors';

const TransactionDetailModal = ({ 
  visible, 
  onClose, 
  transaction, 
  onEdit, 
  onDeleteSuccess 
}) => {
  const { user } = useAuth();
  const { formatCurrency, themeColors, isDarkMode } = useSettings();

  if (!transaction) return null;

  const isIncome = transaction.amount > 0;
  const formattedDate = formatTransactionDate(transaction.date || transaction.createdAt);
  const heroBg = isIncome 
    ? (isDarkMode ? 'rgba(5, 150, 105, 0.15)' : '#f0fdf4') 
    : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2');

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'transactions', transaction.id));
              if (onDeleteSuccess) onDeleteSuccess();
              onClose();
            } catch (err) {
              console.error("Error deleting transaction:", err);
              Alert.alert('Error', 'Failed to delete transaction.');
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Transaction Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Amount Hero Box */}
            <View style={[styles.amountHero, { backgroundColor: heroBg }]}>
              <Text style={styles.amountHeroLabel}>
                {isIncome ? 'Income / Inflow' : 'Expense / Outflow'}
              </Text>
              <Text style={[styles.amountHeroValue, { color: isIncome ? colors.success : colors.danger }]}>
                {formatCurrency(transaction.amount, { showSign: true })}
              </Text>
            </View>

            {/* Details Grid */}
            <View style={styles.grid}>
              <View style={[styles.gridItem, { backgroundColor: themeColors.surfaceSubtle }]}>
                <Text style={styles.gridLabel}>Category</Text>
                <Badge 
                  text={transaction.category || 'Other'} 
                  variant={isIncome ? 'success' : 'info'} 
                  style={{ marginTop: 4 }}
                />
              </View>

              <View style={[styles.gridItem, { backgroundColor: themeColors.surfaceSubtle }]}>
                <Text style={styles.gridLabel}>Payment Method</Text>
                <Text style={[styles.gridValue, { color: themeColors.textPrimary }]}>
                  {transaction.paymentMethod || 'Online'}
                </Text>
              </View>

              <View style={[styles.gridItem, { backgroundColor: themeColors.surfaceSubtle }]}>
                <Text style={styles.gridLabel}>Date</Text>
                <View style={styles.dateValueRow}>
                  <Calendar size={13} color={colors.primary} />
                  <Text style={[styles.gridValue, { color: themeColors.textPrimary }]}>
                    {formattedDate}
                  </Text>
                </View>
              </View>

              <View style={[styles.gridItem, { backgroundColor: themeColors.surfaceSubtle }]}>
                <Text style={styles.gridLabel}>Status</Text>
                <View style={styles.statusRow}>
                  <CheckCircle2 size={13} color={colors.success} />
                  <Text style={[styles.statusText, { color: colors.success }]}>Completed</Text>
                </View>
              </View>
            </View>

            {/* Description / Memo */}
            <View style={[styles.memoBox, { backgroundColor: themeColors.surfaceSubtle }]}>
              <Text style={styles.gridLabel}>Description / Notes</Text>
              <Text style={[styles.memoText, { color: themeColors.textPrimary }]}>
                {transaction.description || transaction.category || 'No description entered.'}
              </Text>
            </View>

            {/* SMS Detection Details if available */}
            {transaction.source === 'sms_auto_detected' && (
              <View style={[
                styles.smsInfoBox, 
                { 
                  backgroundColor: isDarkMode ? 'rgba(5, 150, 105, 0.15)' : '#ecfdf5', 
                  borderColor: isDarkMode ? 'rgba(5, 150, 105, 0.3)' : '#a7f3d0' 
                }
              ]}>
                <Text style={styles.smsInfoTitle}>AUTO-DETECTED FROM BANK SMS</Text>
                <Text style={[styles.smsInfoDetail, { color: isDarkMode ? colors.primaryLight : '#065f46' }]}>
                  Bank: {transaction.bank || 'Bank Account'} {transaction.accountMask ? `(${transaction.accountMask})` : ''}
                </Text>
                {transaction.smsReferenceId && (
                  <Text style={[styles.smsInfoDetail, { color: isDarkMode ? colors.primaryLight : '#065f46' }]}>Ref ID: {transaction.smsReferenceId}</Text>
                )}
              </View>
            )}

            {/* Cash Bills Details if logged */}
            {transaction.notesSummary && (
              <View style={[
                styles.cashBillsBox,
                {
                  backgroundColor: isDarkMode ? 'rgba(5, 150, 105, 0.15)' : '#ecfdf5',
                  borderColor: isDarkMode ? 'rgba(5, 150, 105, 0.3)' : '#a7f3d0'
                }
              ]}>
                <Text style={[styles.cashBillsLabel, { color: isDarkMode ? colors.primaryLight : '#065f46' }]}>Physical Cash Bills Used</Text>
                <Text style={[styles.cashBillsValue, { color: isDarkMode ? colors.primary : colors.primaryDark }]}>{transaction.notesSummary}</Text>
              </View>
            )}

            {/* Receipt Preview */}
            {transaction.receiptUrl && (
              <View style={styles.receiptBox}>
                <Text style={styles.gridLabel}>Attached Receipt</Text>
                <Image 
                  source={{ uri: transaction.receiptUrl }} 
                  style={[styles.receiptImage, { backgroundColor: themeColors.surfaceSubtle }]} 
                  resizeMode="contain"
                />
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
            <Button
              title="Delete"
              variant="danger"
              icon={Trash2}
              onPress={handleDelete}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Edit"
              variant="primary"
              icon={Pencil}
              onPress={() => {
                onClose();
                if (onEdit) onEdit(transaction);
              }}
              style={{ flex: 1.2, marginRight: 8 }}
            />
            <Button
              title="Close"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1 }}
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
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  amountHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 24,
    gap: 4,
  },
  amountHeroLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountHeroValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48%',
    padding: 14,
    borderRadius: 18,
    gap: 4,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  memoBox: {
    padding: 16,
    borderRadius: 20,
    gap: 6,
  },
  memoText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  smsInfoBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  smsInfoTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  smsInfoDetail: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  cashBillsBox: {
    backgroundColor: '#ecfdf5',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 4,
  },
  cashBillsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
    textTransform: 'uppercase',
  },
  cashBillsValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  receiptBox: {
    gap: 8,
  },
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});

export default TransactionDetailModal;
