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
import { User, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Logo from '../../components/common/Logo';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';

const SignupScreen = ({ navigation }) => {
  const { signup } = useAuth();
  const { themeColors } = useSettings();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Required Fields', 'Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signup(name.trim(), email, password);
    } catch (err) {
      console.error("Signup error:", err);
      let msg = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      Alert.alert('Sign Up Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <Logo size={44} showText={true} textColor={themeColors.textPrimary} />
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Start tracking your physical wallet and expenses
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Full Name</Text>
              <View style={[styles.inputBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <User size={18} color={themeColors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={themeColors.textMuted}
                  style={[styles.input, { color: themeColors.textPrimary }]}
                />
              </View>
            </View>

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
                  placeholder="At least 6 characters"
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

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>Confirm Password</Text>
              <View style={[styles.inputBox, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <Lock size={18} color={themeColors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat password"
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { color: themeColors.textPrimary }]}
                />
              </View>
            </View>

            {/* Submit Button */}
            <Button
              title="Create Account"
              variant="primary"
              size="lg"
              onPress={handleSignup}
              loading={loading}
              icon={ArrowRight}
              iconPosition="right"
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Footer Login Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signupLink}>Sign In</Text>
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
    paddingTop: 30,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  brandHeader: {
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 280,
  },
  form: {
    gap: 16,
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
    height: 52,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 8,
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

export default SignupScreen;

