import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const Badge = ({ text, variant = 'default', style, textStyle }) => {
  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successLight, text: colors.success };
      case 'danger':
        return { bg: colors.dangerLight, text: colors.danger };
      case 'warning':
        return { bg: colors.warningLight, text: colors.warning };
      case 'info':
        return { bg: colors.infoLight, text: colors.info };
      case 'cash':
        return { bg: colors.primaryMuted, text: colors.primaryDark };
      case 'online':
        return { bg: '#ede9fe', text: '#6d28d9' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const currentColors = getBadgeColors();

  return (
    <View style={[styles.badge, { backgroundColor: currentColors.bg }, style]}>
      <Text style={[styles.text, { color: currentColors.text }, textStyle]}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
});

export default Badge;

