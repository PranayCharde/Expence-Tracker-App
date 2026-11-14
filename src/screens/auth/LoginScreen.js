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
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Logo from '../../components/common/Logo';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const { themeColors, isDarkMode } = useSettings();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error("Login error:", err);
      let msg = 'Failed to sign in. Please verify your email and password.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Logo & Welcome */}
          <View style={styles.brandHeader}>
            <Logo size={48} showText={true} textColor={themeColors.textPrimary} />
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Sign in to manage your budget and physical cash
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Email Address</Text>
              <View style={[styles.inputBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <Mail size={18} color={themeColors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: themeColors.textPrimary }]}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Password</Text>
              <View style={[styles.inputBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <Lock size={18} color={themeColors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { color: themeColors.textPrimary }]}
                />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
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
              title="Sign In"
              variant="primary"
              size="lg"
              onPress={handleLogin}
              loading={loading}
              icon={ArrowRight}
              iconPosition="right"
              style={{ marginTop: 8 }}
            />

            {/* Demo Account Button */}
            <TouchableOpacity onPress={handleDemoFill} style={styles.demoBtn}>
              <Text style={styles.demoBtnText}>Auto-fill Demo Account</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Signup Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  brandHeader: {
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 280,
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 6,
  },
  demoBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary,
  },
});

export default LoginScreen;

