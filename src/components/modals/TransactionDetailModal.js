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
  FileText 
} from 'lucide-react-native';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { colors } from '../../theme/colors';

const TransactionDetailModal = ({ visible, onClose, transaction, onDeleteSuccess }) => {
  const { user } = useAuth();
  const { formatCurrency, themeColors } = useSettings();

  if (!transaction) return null;

  const isIncome = transaction.amount > 0;

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
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Transaction Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Amount Hero Box */}
            <View style={[styles.amountHero, { backgroundColor: isIncome ? '#f0fdf4' : '#fef2f2' }]}>
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
                <Text style={[styles.gridValue, { color: themeColors.textPrimary }]}>
                  {transaction.dateStr || transaction.date}
                </Text>
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

            {/* Cash Bills Details if logged */}
            {transaction.notesSummary && (
              <View style={styles.cashBillsBox}>
                <Text style={styles.cashBillsLabel}>Physical Cash Bills Used</Text>
                <Text style={styles.cashBillsValue}>{transaction.notesSummary}</Text>
              </View>
            )}

            {/* Receipt Preview */}
            {transaction.receiptUrl && (
              <View style={styles.receiptBox}>
                <Text style={styles.gridLabel}>Attached Receipt</Text>
                <Image 
                  source={{ uri: transaction.receiptUrl }} 
                  style={styles.receiptImage} 
                  resizeMode="contain"
                />
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button
              title="Delete"
              variant="danger"
              icon={Trash2}
              onPress={handleDelete}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Close"
              variant="secondary"
              onPress={onClose}
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
    gap: 14,
  },
  amountHero: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  amountHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
  },
  amountHeroValue: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48.5%',
    padding: 12,
    borderRadius: 16,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  memoBox: {
    padding: 14,
    borderRadius: 16,
  },
  memoText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 2,
  },
  cashBillsBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 14,
    borderRadius: 16,
  },
  cashBillsLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  cashBillsValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#064e3b',
    marginTop: 3,
  },
  receiptBox: {
    gap: 6,
  },
  receiptImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 12,
  },
});

export default TransactionDetailModal;

