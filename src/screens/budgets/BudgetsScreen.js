import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Modal,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Target, AlertTriangle, CheckCircle, Trash2, X } from 'lucide-react-native';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { EXPENSE_CATEGORIES } from '../../config/constants';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { colors } from '../../theme/colors';

const BudgetsScreen = () => {
  const { user } = useAuth();
  const { symbol, formatCurrency, themeColors, isDarkMode } = useSettings();

  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Budget Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen to budgets
    const bQuery = query(collection(db, 'users', user.uid, 'budgets'));
    const unsubBudgets = onSnapshot(bQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBudgets(list);
      setLoading(false);
    });

    // Listen to transactions to compute spent amounts
    const tQuery = query(collection(db, 'users', user.uid, 'transactions'));
    const unsubTx = onSnapshot(tQuery, (snap) => {
      const list = snap.docs.map(d => d.data());
      setTransactions(list);
    });

    return () => {
      unsubBudgets();
      unsubTx();
    };
  }, [user]);

  // Compute spent per category
  const categorySpentMap = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const cat = t.category || 'Other';
        map[cat] = (map[cat] || 0) + Math.abs(t.amount);
      });
    return map;
  }, [transactions]);

  // Overall budget stats
  const totalBudget = budgets.reduce((sum, b) => sum + (Number(b.limit) || 0), 0);
  const totalSpentInBudgets = budgets.reduce((sum, b) => {
    return sum + (categorySpentMap[b.category] || 0);
  }, 0);
  const totalPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpentInBudgets / totalBudget) * 100)) : 0;

  const handleAddBudget = async () => {
    if (!user) return;
    const numLimit = parseFloat(budgetLimit);
    if (isNaN(numLimit) || numLimit <= 0) {
      Alert.alert('Invalid Limit', 'Please enter a valid monthly limit.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'budgets'), {
        category: selectedCategory,
        limit: numLimit,
        createdAt: serverTimestamp()
      });
      setAddModalOpen(false);
      setBudgetLimit('');
    } catch (err) {
      console.error("Error creating budget:", err);
      Alert.alert('Error', 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = (id) => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this category budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteDoc(doc(db, 'users', user.uid, 'budgets', id));
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Category Budgets</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Set limits to control your monthly spending
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setAddModalOpen(true)}
            style={styles.addBtn}
          >
            <Plus size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Overall Budget Hero Card */}
        <Card style={styles.overallCard}>
          <View style={styles.overallTop}>
            <View>
              <Text style={styles.overallLabel}>Total Monthly Budget</Text>
              <Text style={[styles.overallAmount, { color: themeColors.textPrimary }]}>
                {formatCurrency(totalBudget)}
              </Text>
            </View>
            <View style={styles.overallPercentBox}>
              <Text style={styles.overallPercentText}>{totalPercentage}%</Text>
              <Text style={styles.overallPercentSub}>Spent</Text>
            </View>
          </View>

          {/* Master Progress Bar */}
          <View style={styles.progressTrack}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${totalPercentage}%`,
                  backgroundColor: totalPercentage >= 100 ? colors.danger : totalPercentage >= 80 ? colors.warning : colors.primary
                }
              ]} 
            />
          </View>

          <View style={styles.overallBottomRow}>
            <Text style={styles.overallBottomText}>
              Spent: <Text style={{ fontWeight: '800', color: themeColors.textPrimary }}>{formatCurrency(totalSpentInBudgets)}</Text>
            </Text>
            <Text style={styles.overallBottomText}>
              Remaining: <Text style={{ fontWeight: '800', color: colors.primary }}>{formatCurrency(Math.max(0, totalBudget - totalSpentInBudgets))}</Text>
            </Text>
          </View>
        </Card>

        {/* Category Budget Items */}
        <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
          Budgets by Category ({budgets.length})
        </Text>

        {budgets.length === 0 ? (
          <Card style={styles.emptyBox}>
            <Target size={36} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No budgets created yet</Text>
            <Text style={styles.emptySubtitle}>Tap the '+' button above to set a spending limit for a category.</Text>
          </Card>
        ) : (
          <View style={styles.budgetList}>
            {budgets.map(b => {
              const spent = categorySpentMap[b.category] || 0;
              const limit = Number(b.limit) || 1;
              const pct = Math.min(100, Math.round((spent / limit) * 100));
              const isExceeded = spent > limit;

              return (
                <Card key={b.id} style={styles.budgetItemCard}>
                  <View style={styles.budgetItemHeader}>
                    <View style={styles.budgetItemLeft}>
                      <Text style={[styles.budgetCategoryTitle, { color: themeColors.textPrimary }]}>
                        {b.category}
                      </Text>
                      <Text style={styles.budgetLimitSub}>Limit: {formatCurrency(limit)}</Text>
                    </View>

                    <View style={styles.budgetItemRight}>
                      {isExceeded ? (
                        <Badge text="Exceeded" variant="danger" />
                      ) : pct >= 80 ? (
                        <Badge text={`${pct}% warning`} variant="warning" />
                      ) : (
                        <Badge text={`${pct}% on track`} variant="success" />
                      )}
                      <TouchableOpacity onPress={() => handleDeleteBudget(b.id)} style={{ padding: 4 }}>
                        <Trash2 size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressTrack}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          width: `${pct}%`,
                          backgroundColor: isExceeded ? colors.danger : pct >= 80 ? colors.warning : colors.primary
                        }
                      ]} 
                    />
                  </View>

                  <View style={styles.itemBottomRow}>
                    <Text style={styles.itemSpentText}>
                      Spent: <Text style={{ fontWeight: '800', color: isExceeded ? colors.danger : themeColors.textPrimary }}>{formatCurrency(spent)}</Text>
                    </Text>
                    <Text style={styles.itemRemainingText}>
                      {isExceeded ? `Over by ${formatCurrency(spent - limit)}` : `Left: ${formatCurrency(limit - spent)}`}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Budget Modal */}
      <Modal visible={addModalOpen} animationType="slide" transparent={true} onRequestClose={() => setAddModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Create Category Budget</Text>
              <TouchableOpacity onPress={() => setAddModalOpen(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Select Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsRow}>
                {EXPENSE_CATEGORIES.map(cat => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.catPill,
                        { borderColor: isSelected ? colors.primary : themeColors.border },
                        isSelected && { backgroundColor: colors.primary }
                      ]}
                    >
                      <Text style={[styles.catPillText, { color: isSelected ? '#ffffff' : themeColors.textSecondary }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.modalLabel, { color: themeColors.textSecondary, marginTop: 14 }]}>Monthly Limit ({symbol})</Text>
              <TextInput
                value={budgetLimit}
                onChangeText={setBudgetLimit}
                placeholder="e.g. 5000"
                placeholderTextColor={themeColors.textMuted}
                keyboardType="decimal-pad"
                style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
                autoFocus
              />
            </View>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setAddModalOpen(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={saving ? 'Saving...' : 'Set Budget'}
                variant="primary"
                onPress={handleAddBudget}
                loading={saving}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallCard: {
    padding: 20,
    gap: 14,
  },
  overallTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  overallAmount: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  overallPercentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  overallPercentText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  overallPercentSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  overallBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallBottomText: {
    fontSize: 12,
    color: '#64748b',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
  },
  budgetList: {
    gap: 10,
  },
  budgetItemCard: {
    gap: 10,
  },
  budgetItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetItemLeft: {
    gap: 2,
  },
  budgetCategoryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  budgetLimitSub: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  budgetItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemSpentText: {
    fontSize: 12,
    color: '#64748b',
  },
  itemRemainingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  modalBody: {
    paddingVertical: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoryPillsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: 8,
  },
});

export default BudgetsScreen;

