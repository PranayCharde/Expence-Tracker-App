import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Building2, 
  Calendar, 
  Tag, 
  FileText, 
  ShieldCheck,
  Check
} from 'lucide-react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../config/constants';
import { formatTransactionDate } from '../../utils/formatDate';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';

const LoggedTransactionScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { formatCurrency, themeColors, isDarkMode } = useSettings();

  // Transaction data passed via navigation params
  const initialTx = route.params?.transaction || {};
  const [currentTx, setCurrentTx] = useState(initialTx);
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isIncome = Number(currentTx.amount) > 0;
  const isSms = currentTx.source === 'sms_auto_detected' || !!currentTx.smsReferenceId;
  const isCcBill = /credit\s*card\s*bill/i.test(currentTx.description || '') || /credit\s*card\s*bill/i.test(currentTx.merchant || '');
  const formattedDate = formatTransactionDate(currentTx.date || currentTx.createdAt || new Date().toISOString());

  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Handle changing category in real time
  const handleSelectCategory = async (newCategory) => {
    if (!currentTx.id || !user) {
      setCurrentTx(prev => ({ ...prev, category: newCategory }));
      setIsChangingCategory(false);
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'transactions', currentTx.id), {
        category: newCategory
      });
      setCurrentTx(prev => ({ ...prev, category: newCategory }));
      setIsChangingCategory(false);
    } catch (err) {
      console.warn('Failed to update category:', err);
      Alert.alert('Update Failed', 'Could not update category in database.');
    } finally {
      setUpdating(false);
    }
  };

  const getPaymentIcon = () => {
    const m = currentTx.paymentMethod || 'Online / UPI';
    if (m === 'Cash') return <Banknote size={16} color={colors.primary} />;
    if (m.includes('Card')) return <CreditCard size={16} color="#a855f7" />;
    if (m.includes('Transfer')) return <Building2 size={16} color="#f59e0b" />;
    return <Smartphone size={16} color="#3b82f6" />;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.backBtn, { backgroundColor: themeColors.surfaceSubtle }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={20} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Transaction Logged</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* Success Banner Hero */}
        <View style={[
          styles.heroCard, 
          { 
            backgroundColor: isIncome 
              ? (isDarkMode ? 'rgba(5, 150, 105, 0.15)' : '#f0fdf4') 
              : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'),
            borderColor: isIncome 
              ? (isDarkMode ? 'rgba(5, 150, 105, 0.3)' : '#bbf7d0') 
              : (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#fecaca')
          }
        ]}>
          {/* Badge indicator */}
          <View style={[
            styles.statusPill, 
            { 
              backgroundColor: isCcBill 
                ? '#fef3c7' 
                : isSms 
                  ? '#ecfdf5' 
                  : (isIncome ? '#f0fdf4' : '#fee2e2'),
              borderColor: isCcBill 
                ? '#fde68a' 
                : isSms 
                  ? '#a7f3d0' 
                  : (isIncome ? '#bbf7d0' : '#fecaca')
            }
          ]}>
            {isCcBill ? (
              <CreditCard size={13} color="#b45309" />
            ) : isSms ? (
              <Sparkles size={13} color={colors.primary} />
            ) : (
              <CheckCircle2 size={13} color={isIncome ? colors.success : colors.danger} />
            )}
            <Text style={[
              styles.statusPillText, 
              { 
                color: isCcBill 
                  ? '#b45309' 
                  : isSms 
                    ? colors.primaryDark 
                    : (isIncome ? colors.success : colors.danger) 
              }
            ]}>
              {isCcBill 
                ? 'CREDIT CARD BILL PAYMENT RECORDED' 
                : isSms 
                  ? 'AUTO-LOGGED FROM BANK SMS' 
                  : 'TRANSACTION RECORDED'}
            </Text>
          </View>

          {/* Large Amount */}
          <Text style={[
            styles.heroAmount, 
            { color: isIncome ? colors.success : colors.danger }
          ]}>
            {formatCurrency(currentTx.amount, { showSign: true })}
          </Text>

          <Text style={[styles.heroSubtitle, { color: themeColors.textSecondary }]}>
            {isCcBill 
              ? 'Recorded as an expense outflow in your ledger' 
              : isIncome 
                ? 'Added to your total income balance' 
                : 'Deducted from your balance'}
          </Text>
        </View>

        {/* Structured Transaction Receipt Card */}
        <Card style={styles.detailsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color={colors.primary} />
              <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>Verified Details</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsChangingCategory(!isChangingCategory)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.changeCategoryLink}>
                {isChangingCategory ? 'Close Categories' : 'Change Category'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Category Selector if expanded */}
          {isChangingCategory && (
            <View style={[styles.categoryPickerBox, { backgroundColor: themeColors.surfaceSubtle, borderColor: themeColors.border }]}>
              <Text style={[styles.pickerTitle, { color: themeColors.textSecondary }]}>Select Matching Category</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.categoryScroll}
              >
                {categories.map((cat) => {
                  const isSelected = currentTx.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => handleSelectCategory(cat)}
                      disabled={updating}
                      style={[
                        styles.catOptionPill,
                        { 
                          borderColor: isSelected ? colors.primary : themeColors.border,
                          backgroundColor: isSelected ? colors.primary : (isDarkMode ? themeColors.surface : '#ffffff')
                        }
                      ]}
                    >
                      {isSelected && <Check size={12} color="#ffffff" style={{ marginRight: 4 }} />}
                      <Text style={[
                        styles.catOptionText,
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
          )}

          {/* Detail Rows */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Tag size={15} color="#94a3b8" />
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Category</Text>
            </View>
            <Badge 
              text={currentTx.category || 'Other'} 
              variant={isIncome ? 'success' : 'info'} 
            />
          </View>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <FileText size={15} color="#94a3b8" />
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Description</Text>
            </View>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {currentTx.description || currentTx.merchant || currentTx.category}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              {getPaymentIcon()}
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Payment Method</Text>
            </View>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
              {currentTx.paymentMethod || 'Online'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Calendar size={15} color="#94a3b8" />
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Date</Text>
            </View>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
              {formattedDate}
            </Text>
          </View>

          {/* Bank / Account Info if present */}
          {currentTx.bank ? (
            <>
              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Building2 size={15} color="#94a3b8" />
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Bank / Account</Text>
                </View>
                <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                  {currentTx.bank} {currentTx.accountMask ? `(${currentTx.accountMask})` : ''}
                </Text>
              </View>
            </>
          ) : null}

          {/* SMS Reference ID if present */}
          {currentTx.smsReferenceId ? (
            <>
              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <ShieldCheck size={15} color="#94a3b8" />
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Ref ID</Text>
                </View>
                <Text style={[styles.refValue, { color: colors.primary }]}>
                  {currentTx.smsReferenceId}
                </Text>
              </View>
            </>
          ) : null}

          {/* Physical Cash Notes Summary if present */}
          {currentTx.notesSummary ? (
            <>
              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Banknote size={15} color="#94a3b8" />
                  <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Notes Used</Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.primaryDark }]}>
                  {currentTx.notesSummary}
                </Text>
              </View>
            </>
          ) : null}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            title="View in Activity"
            variant="primary"
            onPress={() => {
              navigation.navigate('MainTabs', { screen: 'Transactions' });
            }}
            style={{ width: '100%' }}
          />

          <Button
            title="Back to Dashboard"
            variant="secondary"
            onPress={() => {
              navigation.navigate('MainTabs', { screen: 'Dashboard' });
            }}
            style={{ width: '100%' }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  heroCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  detailsCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  changeCategoryLink: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  categoryPickerBox: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pickerTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  catOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  catOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 180,
    textAlign: 'right',
  },
  refValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
  },
  actionContainer: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
});

export default LoggedTransactionScreen;

