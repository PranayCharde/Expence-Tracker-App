import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { setAdminSessionActive, isAuthorizedAdminEmail } from '../../services/adminService';
import Logo from '../../components/common/Logo';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing, radius, layout, typography } from '../../theme/spacing';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const { themeColors, isDarkMode } = useSettings();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    setLoading(true);
    try {
      // Check if credentials are for administrator
      const isSuperAdminEmail = isAuthorizedAdminEmail(cleanEmail);
      const isMasterPass = cleanPass === 'pranay13' || cleanPass.toLowerCase() === 'pranay13';

      if (isSuperAdminEmail && isMasterPass) {
        setAdminSessionActive(true, cleanEmail);
      }

      await login(cleanEmail, cleanPass);
    } catch (err) {
      console.error("Login error:", err);
      let msg = 'Failed to sign in. Please verify your email and password.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = isAdminMode 
          ? 'Invalid administrator credentials. Access restricted.' 
          : 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address above to receive a password reset link.');
      return;
    }

    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Reset Link Sent', `A password reset link has been sent to ${email.trim()}.`);
    } catch (err) {
      console.error("Reset password error:", err);
      let msg = 'Could not send reset email. Please verify your email address.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No user account found with this email.';
      }
      Alert.alert('Reset Failed', msg);
    } finally {
      setResetting(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('demo@spendwise.com');
    setPassword('Demo@1234');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Welcome */}
          <View style={styles.brandHeader}>
            <Logo size={46} showText={true} textColor={themeColors.textPrimary} />
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {isAdminMode ? 'Administrator Portal' : 'Welcome back'}
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              {isAdminMode 
                ? 'Sign in to access platform controls & broadcast push notifications' 
                : 'Sign in to manage your budget and physical cash'}
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={[styles.modeTabs, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
            <TouchableOpacity
              style={[styles.modeTab, !isAdminMode && [styles.modeTabActive, { backgroundColor: themeColors.surface }]]}
              onPress={() => setIsAdminMode(false)}
            >
              <Text style={[styles.modeTabText, !isAdminMode && { color: colors.primary, fontWeight: '800' }]}>
                Standard User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, isAdminMode && [styles.modeTabActive, { backgroundColor: '#7c3aed' }]]}
              onPress={() => setIsAdminMode(true)}
            >
              <ShieldCheck size={14} color={isAdminMode ? '#ffffff' : '#64748b'} />
              <Text style={[styles.modeTabText, isAdminMode && { color: '#ffffff', fontWeight: '800' }]}>
                Admin Login
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>
                {isAdminMode ? 'Admin Email Address' : 'Email Address'}
              </Text>
              <View style={[styles.inputBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <Mail size={18} color={themeColors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={isAdminMode ? "Enter administrator email" : "name@example.com"}
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: themeColors.textPrimary }]}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>
                  {isAdminMode ? 'Admin Password' : 'Password'}
                </Text>
                {!isAdminMode && (
                  <TouchableOpacity 
                    onPress={handleForgotPassword}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.inputBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <Lock size={18} color={themeColors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={[styles.input, { color: themeColors.textPrimary }]}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(p => !p)} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.eyeBtn}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={themeColors.textMuted} />
                  ) : (
                    <Eye size={18} color={themeColors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <Button
              title={isAdminMode ? "Sign In as Administrator" : "Sign In"}
              variant="primary"
              size="lg"
              onPress={handleLogin}
              loading={loading}
              icon={ArrowRight}
              iconPosition="right"
              style={[
                { marginTop: spacing.xs },
                isAdminMode && { backgroundColor: '#7c3aed' }
              ]}
            />

            {/* Demo Account Button (Only for Standard User) */}
            {!isAdminMode && (
              <TouchableOpacity 
                onPress={handleDemoFill} 
                style={styles.demoBtn}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              >
                <Text style={styles.demoBtnText}>Auto-fill Demo Account</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer Signup Link */}
          {!isAdminMode && (
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  brandHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: spacing.xl,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  modeTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  title: {
    fontSize: typography.fontSizes.heading,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.body,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 20,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs + 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: typography.fontSizes.sub,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forgotText: {
    fontSize: typography.fontSizes.sub,
    fontWeight: '700',
    color: colors.primary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    height: layout.inputHeight,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSizes.bodyLg,
    fontWeight: '600',
    padding: 0,
  },
  eyeBtn: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  demoBtnText: {
    fontSize: typography.fontSizes.bodySm,
    fontWeight: '800',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  footerText: {
    fontSize: typography.fontSizes.body,
    fontWeight: '500',
  },
  signupLink: {
    fontSize: typography.fontSizes.body,
    fontWeight: '900',
    color: colors.primary,
  },
});

export default LoginScreen;

