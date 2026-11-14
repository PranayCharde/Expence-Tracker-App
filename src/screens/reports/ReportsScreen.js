import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  PieChart as PieChartIcon, 
  TrendingUp, 
  TrendingDown, 
  Banknote, 
  Smartphone,
  Calendar 
} from 'lucide-react-native';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { colors } from '../../theme/colors';

const ReportsScreen = () => {
  const { user } = useAuth();
  const { symbol, formatCurrency, themeColors, isDarkMode } = useSettings();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'transactions'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => d.data());
      setTransactions(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  // Analytics Math
  const analytics = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions.filter(t => t.amount < 0);
    const totalExpense = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

    // Spending by Category
    const catMap = {};
    expenses.forEach(t => {
      const cat = t.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
    });

    const categoryList = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Cash vs Online
    const cashTotal = expenses
      .filter(t => t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const onlineTotal = totalExpense - cashTotal;
    const cashPct = totalExpense > 0 ? Math.round((cashTotal / totalExpense) * 100) : 0;
    const onlinePct = totalExpense > 0 ? 100 - cashPct : 0;

    return {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      categoryList,
      cashTotal,
      onlineTotal,
      cashPct,
      onlinePct
    };
  }, [transactions]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Financial Reports</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Breakdown of your spending habits and savings rate
          </Text>
        </View>

        {/* Savings Rate Card */}
        <Card style={styles.savingsCard}>
          <View style={styles.savingsTop}>
            <View>
              <Text style={styles.savingsLabel}>Monthly Savings Rate</Text>
              <Text style={[styles.savingsRateText, { color: colors.primary }]}>{analytics.savingsRate}%</Text>
            </View>
            <View style={styles.savingsIconCircle}>
              <TrendingUp size={24} color={colors.primary} />
            </View>
          </View>

          <View style={styles.savingsProgressTrack}>
            <View style={[styles.savingsProgressBar, { width: `${Math.min(100, analytics.savingsRate)}%` }]} />
          </View>

          <View style={styles.savingsMetaRow}>
            <Text style={styles.savingsMetaText}>
              Net Saved: <Text style={{ fontWeight: '800', color: themeColors.textPrimary }}>{formatCurrency(analytics.netSavings)}</Text>
            </Text>
            <Text style={styles.savingsMetaText}>
              Total In: <Text style={{ fontWeight: '800', color: colors.success }}>{formatCurrency(analytics.totalIncome)}</Text>
            </Text>
          </View>
        </Card>

        {/* Cash vs Online Breakdown */}
        <Card style={styles.methodCard}>
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Cash vs Online Spending</Text>
          
          <View style={styles.dualBarContainer}>
            <View style={[styles.dualBarCash, { flex: Math.max(0.05, analytics.cashPct / 100) }]} />
            <View style={[styles.dualBarOnline, { flex: Math.max(0.05, analytics.onlinePct / 100) }]} />
          </View>

          <View style={styles.methodStatsRow}>
            <View style={styles.methodStatItem}>
              <View style={[styles.methodDot, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={styles.methodName}>Cash in Hand ({analytics.cashPct}%)</Text>
                <Text style={[styles.methodAmount, { color: themeColors.textPrimary }]}>
                  {formatCurrency(analytics.cashTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.methodStatItem}>
              <View style={[styles.methodDot, { backgroundColor: '#7c3aed' }]} />
              <View>
                <Text style={styles.methodName}>Online / UPI ({analytics.onlinePct}%)</Text>
                <Text style={[styles.methodAmount, { color: themeColors.textPrimary }]}>
                  {formatCurrency(analytics.onlineTotal)}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Spending by Category Breakdown */}
        <Card style={styles.categoriesCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.catHeaderLeft}>
              <PieChartIcon size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Spending by Category</Text>
            </View>
            <Text style={styles.catTotalSub}>Total: {formatCurrency(analytics.totalExpense)}</Text>
          </View>

          {analytics.categoryList.length === 0 ? (
            <Text style={styles.noDataText}>No expenses logged yet.</Text>
          ) : (
            <View style={styles.catList}>
              {analytics.categoryList.map(cat => (
                <View key={cat.name} style={styles.catRow}>
                  <View style={styles.catRowTop}>
                    <Text style={[styles.catName, { color: themeColors.textPrimary }]}>{cat.name}</Text>
                    <View style={styles.catAmountRow}>
                      <Text style={[styles.catAmount, { color: themeColors.textPrimary }]}>
                        {formatCurrency(cat.amount)}
                      </Text>
                      <Text style={styles.catPercentage}>({cat.percentage}%)</Text>
                    </View>
                  </View>
                  <View style={styles.catProgressTrack}>
                    <View style={[styles.catProgressBar, { width: `${cat.percentage}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
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
  header: {
    gap: 2,
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
  savingsCard: {
    padding: 20,
    gap: 14,
  },
  savingsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savingsLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  savingsRateText: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  savingsIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingsProgressTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  savingsProgressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  savingsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savingsMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  methodCard: {
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  dualBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  dualBarCash: {
    backgroundColor: colors.primary,
  },
  dualBarOnline: {
    backgroundColor: '#7c3aed',
  },
  methodStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  methodStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methodName: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  methodAmount: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  categoriesCard: {
    padding: 20,
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catTotalSub: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
  },
  catList: {
    gap: 14,
  },
  catRow: {
    gap: 6,
  },
  catRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 13,
    fontWeight: '800',
  },
  catAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '900',
  },
  catPercentage: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  catProgressTrack: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  noDataText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default ReportsScreen;

