import React, { createContext, useContext, useState, useEffect } from 'react';
import safeStorage from '../utils/safeStorage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { CURRENCIES } from '../config/constants';
import { colors } from '../theme/colors';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('INR');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load from local storage initially
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedCurrency = await safeStorage.getItem('spendwise_currency');
        if (storedCurrency) setCurrency(storedCurrency);

        const storedTheme = await safeStorage.getItem('spendwise_theme');
        if (storedTheme) setIsDarkMode(storedTheme === 'dark');
      } catch (e) {
        console.error("Error loading local settings:", e);
      }
    };
    loadSettings();
  }, []);

  // Sync with Firestore user profile if logged in
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.currency) {
          setCurrency(data.currency);
          safeStorage.setItem('spendwise_currency', data.currency);
        }
        if (data.theme) {
          const dark = data.theme === 'dark';
          setIsDarkMode(dark);
          safeStorage.setItem('spendwise_theme', data.theme);
        }
      }
    });

    return unsubscribe;
  }, [user]);

  const currencyObj = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const symbol = currencyObj.symbol;

  const toggleDarkMode = async () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    await safeStorage.setItem('spendwise_theme', nextDark ? 'dark' : 'light');

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          theme: nextDark ? 'dark' : 'light'
        }, { merge: true });
      } catch (e) {}
    }
  };

  const updateCurrency = async (newCode) => {
    setCurrency(newCode);
    await safeStorage.setItem('spendwise_currency', newCode);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          currency: newCode
        }, { merge: true });
      } catch (e) {}
    }
  };

  const formatCurrency = (amount, options = {}) => {
    const num = Number(amount) || 0;
    const { showSign = false } = options;

    const formatted = Math.abs(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (showSign) {
      if (num > 0) return `+${symbol}${formatted}`;
      if (num < 0) return `-${symbol}${formatted}`;
    }

    if (num < 0) return `-${symbol}${formatted}`;
    return `${symbol}${formatted}`;
  };

  const themeColors = isDarkMode ? colors.dark : colors.light;

  return (
    <SettingsContext.Provider value={{
      currency,
      symbol,
      isDarkMode,
      toggleDarkMode,
      updateCurrency,
      formatCurrency,
      themeColors,
      colors
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

