import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Search, 
  Filter, 
  Plus, 
  X, 
  Banknote, 
  Smartphone, 
  TrendingUp, 
  CreditCard,
  FileText,
  ChevronRight,
  Camera,
  Sparkles
} from 'lucide-react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import NewTransactionModal from '../../components/modals/NewTransactionModal';
import TransactionDetailModal from '../../components/modals/TransactionDetailModal';
import AutoLogReceiptModal from '../../components/modals/AutoLogReceiptModal';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';
import { formatTransactionDate } from '../../utils/formatDate';

const TransactionsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { formatCurrency, themeColors, isDarkMode } = useSettings();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all'); // 'all', 'sms', 'Cash', 'Online'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'income', 'expense'

  // Modals
  const [newTxModalOpen, setNewTxModalOpen] = useState(false);
  const [autoLogModalOpen, setAutoLogModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return unsubscribe;
  }, [user]);

  // Filtered transactions
  const filteredList = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = searchTerm 
        ? (t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.bank?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.smsReferenceId?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchMethod = methodFilter === 'all' 
        ? true 
        : methodFilter === 'sms'
        ? (t.source === 'sms_auto_detected' || !!t.smsReferenceId || !!t.bank)
        : methodFilter === 'Cash' 
        ? t.paymentMethod === 'Cash' 
        : t.paymentMethod !== 'Cash';

      const matchType = typeFilter === 'all'
        ? true
        : typeFilter === 'income'
        ? t.amount > 0
        : t.amount < 0;

      return matchSearch && matchMethod && matchType;
    });
  }, [transactions, searchTerm, methodFilter, typeFilter]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.searchBox, { flex: 1, backgroundColor: themeColors.surfaceSubtle, borderColor: themeColors.border }]}>
            <Search size={16} color={themeColors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search expenses, coffee, rent, auto..."
              placeholderTextColor={themeColors.textMuted}
              style={[styles.searchInput, { color: themeColors.textPrimary }]}
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <X size={16} color={themeColors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setAutoLogModalOpen(true)}
            style={styles.autoLogHeaderBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Camera size={14} color="#ffffff" />
            <Text style={styles.autoLogHeaderBtnText}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('SmsLog')}
            style={[styles.smsHeaderBtn, { borderColor: colors.primary, backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Smartphone size={15} color={colors.primary} />
            <Text style={[styles.smsHeaderBtnText, { color: colors.primary }]}>SMS Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
          {/* Method Filter Tabs */}
          <TouchableOpacity
            onPress={() => setMethodFilter('all')}
            style={[styles.filterPill, methodFilter === 'all' && styles.filterPillActive]}
          >
            <Text style={[styles.filterPillText, methodFilter === 'all' && styles.filterPillTextActive]}>
              All Methods
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMethodFilter('sms')}
            style={[
              styles.filterPill, 
              methodFilter === 'sms' && [styles.filterPillActive, { backgroundColor: '#2563eb' }]
            ]}
          >
            <Smartphone size={13} color={methodFilter === 'sms' ? '#ffffff' : '#2563eb'} style={{ marginRight: 4 }} />
            <Text style={[styles.filterPillText, methodFilter === 'sms' && styles.filterPillTextActive]}>
              SMS Log ({transactions.filter(t => t.source === 'sms_auto_detected' || t.smsReferenceId || t.bank).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMethodFilter('Cash')}
            style={[styles.filterPill, methodFilter === 'Cash' && styles.filterPillActive]}
          >
            <Banknote size={13} color={methodFilter === 'Cash' ? '#ffffff' : colors.primaryDark} style={{ marginRight: 4 }} />
            <Text style={[styles.filterPillText, methodFilter === 'Cash' && styles.filterPillTextActive]}>
              Cash Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMethodFilter('Online')}
            style={[styles.filterPill, methodFilter === 'Online' && styles.filterPillActive]}
          >
            <Smartphone size={13} color={methodFilter === 'Online' ? '#ffffff' : '#6d28d9'} style={{ marginRight: 4 }} />
            <Text style={[styles.filterPillText, methodFilter === 'Online' && styles.filterPillTextActive]}>
              Online / UPI
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Type Filter Tabs */}
          <TouchableOpacity
            onPress={() => setTypeFilter('all')}
            style={[styles.typePill, typeFilter === 'all' && styles.typePillActive]}
          >
            <Text style={[styles.typePillText, typeFilter === 'all' && styles.typePillTextActive]}>All Types</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTypeFilter('expense')}
            style={[styles.typePill, typeFilter === 'expense' && styles.typePillExpenseActive]}
          >
            <Text style={[styles.typePillText, typeFilter === 'expense' && styles.typePillTextActive]}>Expenses</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTypeFilter('income')}
            style={[styles.typePill, typeFilter === 'income' && styles.typePillIncomeActive]}
          >
            <Text style={[styles.typePillText, typeFilter === 'income' && styles.typePillTextActive]}>Income</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Transactions List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} colors={[colors.primary]} />}
      >
        {methodFilter === 'sms' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SmsLog')}
            style={[styles.smsBanner, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: '#bfdbfe' }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.smsBannerIcon}>
                <Smartphone size={18} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.smsBannerTitle, { color: themeColors.textPrimary }]}>
                  SMS Auto-Detected Transactions
                </Text>
                <Text style={styles.smsBannerSubtitle}>
                  Tap to open full dedicated SMS Log with bank analytics
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color="#2563eb" />
          </TouchableOpacity>
        )}

        <Text style={[styles.countHeader, { color: themeColors.textSecondary }]}>
          Showing {filteredList.length} transactions
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filteredList.length === 0 ? (
          <Card style={styles.emptyBox}>
            <Banknote size={36} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search query or filters.</Text>
          </Card>
        ) : (
          <View style={styles.txList}>
            {filteredList.map(tx => {
              const isIncome = tx.amount > 0;
              const isCash = tx.paymentMethod === 'Cash';

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTx(tx)}
                  style={[styles.txCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
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
                      <Text style={[styles.txTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {tx.description || tx.category}
                      </Text>
                      <View style={styles.txMetaRow}>
                        <Text style={styles.txDate}>{tx.dateStr}</Text>
                        <Badge text={tx.category || 'Other'} variant={isIncome ? 'success' : 'default'} />
                        {isCash ? (
                          <Badge text="Cash" variant="cash" />
                        ) : (
                          <Badge text={tx.paymentMethod || 'Online'} variant="online" />
                        )}
                        {tx.receiptUrl && (
                          <FileText size={12} color={colors.primary} />
                        )}
                      </View>
                      {tx.notesSummary && (
                        <Text style={styles.notesTag} numberOfLines={1}>
                          Paid: {tx.notesSummary}
                        </Text>
                      )}
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

      {/* Floating Action Button */}
      <TouchableOpacity 
        activeOpacity={0.85}
        onPress={() => setNewTxModalOpen(true)}
        style={styles.fab}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Modals */}
      <AutoLogReceiptModal
        visible={autoLogModalOpen}
        onClose={() => setAutoLogModalOpen(false)}
      />

      <NewTransactionModal
        visible={newTxModalOpen}
        onClose={() => {
          setNewTxModalOpen(false);
          setEditingTx(null);
        }}
        initialTransaction={editingTx}
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  autoLogHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  autoLogHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  smsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  smsHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  smsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  smsBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  smsBannerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  filtersBar: {
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  filterPillsScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  typePillActive: {
    backgroundColor: '#0f172a',
  },
  typePillExpenseActive: {
    backgroundColor: colors.danger,
  },
  typePillIncomeActive: {
    backgroundColor: colors.success,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  typePillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.xs,
    paddingBottom: layout.scrollBottomInset + 30,
    gap: spacing.md,
  },
  countHeader: {
    fontSize: typography.fontSizes.sub,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  txList: {
    gap: spacing.sm,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    minHeight: 72,
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
  txTitle: {
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
  notesTag: {
    fontSize: typography.fontSizes.micro,
    fontWeight: '800',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginTop: spacing.xs,
    maxWidth: '90%',
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
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  fab: {
    position: 'absolute',
    bottom: layout.fabBottomOffset,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default TransactionsScreen;

