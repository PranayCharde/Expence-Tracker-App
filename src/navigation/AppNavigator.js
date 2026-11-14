import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Home, 
  CreditCard, 
  Wallet, 
  Target, 
  PieChart, 
  Settings as SettingsIcon 
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import TransactionsScreen from '../screens/transactions/TransactionsScreen';
import CashWalletScreen from '../screens/cash/CashWalletScreen';
import BudgetsScreen from '../screens/budgets/BudgetsScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { themeColors, isDarkMode } = useSettings();
  const insets = useSafeAreaInsets();

  // Responsive bottom padding based on device insets (iPhone home indicator, Android gesture bar)
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  const tabHeight = 56 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#64748b' : '#94a3b8',
        tabBarStyle: {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDarkMode ? 0.3 : 0.06,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: -0.2,
        },
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Home size={focused ? 21 : 19} color={color} strokeWidth={focused ? 2.5 : 2} />
          )
        }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsScreen} 
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <CreditCard size={focused ? 21 : 19} color={color} strokeWidth={focused ? 2.5 : 2} />
          )
        }}
      />
      <Tab.Screen 
        name="Cash" 
        component={CashWalletScreen} 
        options={{
          tabBarLabel: 'Cash',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.cashTabPill, 
              focused && { backgroundColor: isDarkMode ? 'rgba(5, 150, 105, 0.25)' : '#d1fae5' }
            ]}>
              <Wallet size={focused ? 21 : 19} color={focused ? colors.primaryDark : color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          )
        }}
      />
      <Tab.Screen 
        name="Budgets" 
        component={BudgetsScreen} 
        options={{
          tabBarLabel: 'Budgets',
          tabBarIcon: ({ color, focused }) => (
            <Target size={focused ? 21 : 19} color={color} strokeWidth={focused ? 2.5 : 2} />
          )
        }}
      />
      <Tab.Screen 
        name="Reports" 
        component={ReportsScreen} 
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <PieChart size={focused ? 21 : 19} color={color} strokeWidth={focused ? 2.5 : 2} />
          )
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <SettingsIcon size={focused ? 21 : 19} color={color} strokeWidth={focused ? 2.5 : 2} />
          )
        }}
      />
    </Tab.Navigator>
  );
};

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { isDarkMode, themeColors } = useSettings();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navigationTheme = isDarkMode ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: themeColors.background,
      card: themeColors.surface,
      text: themeColors.textPrimary,
      border: themeColors.border,
    }
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themeColors.background,
      card: themeColors.surface,
      text: themeColors.textPrimary,
      border: themeColors.border,
    }
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashTabPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppNavigator;

