import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSettings } from '../../context/SettingsContext';
import { radius, layout } from '../../theme/spacing';

const Card = ({ children, style, variant = 'default' }) => {
  const { themeColors, isDarkMode } = useSettings();

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      },
      isDarkMode && styles.cardDark,
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: layout.cardPadding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDark: {
    shadowOpacity: 0.2,
    elevation: 3,
  }
});

export default Card;

