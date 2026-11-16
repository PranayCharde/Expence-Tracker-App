import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, layout, spacing } from '../../theme/spacing';

const Button = ({
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'danger', 'outline', 'ghost'
  size = 'md', // 'sm', 'md', 'lg'
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return '#94a3b8';
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return '#f1f5f9';
      case 'danger': return colors.danger;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#ffffff';
    switch (variant) {
      case 'primary': return '#ffffff';
      case 'secondary': return '#0f172a';
      case 'danger': return '#ffffff';
      case 'outline': return colors.primary;
      case 'ghost': return colors.primary;
      default: return '#ffffff';
    }
  };

  const getPaddingAndHeight = () => {
    switch (size) {
      case 'sm': 
        return { 
          minHeight: layout.buttonHeightSm, 
          paddingVertical: spacing.xs + 2, 
          paddingHorizontal: spacing.md 
        };
      case 'lg': 
        return { 
          minHeight: layout.buttonHeightLg, 
          paddingVertical: spacing.md + 2, 
          paddingHorizontal: spacing.xxl 
        };
      default: 
        return { 
          minHeight: layout.buttonHeight, 
          paddingVertical: spacing.sm + 2, 
          paddingHorizontal: spacing.lg 
        };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm': return 12;
      case 'lg': return 15;
      default: return 14;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        getPaddingAndHeight(),
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.primary },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {Icon && iconPosition === 'left' && (
            <Icon size={getFontSize() + 3} color={getTextColor()} style={styles.iconLeft} />
          )}
          <Text 
            numberOfLines={1}
            style={[
              styles.text,
              { color: getTextColor(), fontSize: getFontSize() },
              textStyle
            ]}
          >
            {title}
          </Text>
          {Icon && iconPosition === 'right' && (
            <Icon size={getFontSize() + 3} color={getTextColor()} style={styles.iconRight} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

export default Button;

