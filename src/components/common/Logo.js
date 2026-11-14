import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '../../theme/colors';

const Logo = ({ size = 36, showText = true, textColor = '#0f172a' }) => {
  return (
    <View style={styles.container}>
      {/* SpendWise 3D S Arrow Brand Icon */}
      <Image 
        source={require('../../../assets/logo.png')} 
        style={{ width: size, height: size, borderRadius: size * 0.24 }} 
        resizeMode="contain"
      />

      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.brandText, { color: textColor }]}>
            Spend<Text style={styles.brandAccent}>Wise</Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textContainer: {
    flexDirection: 'column',
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: colors.primary,
  },
});

export default Logo;

