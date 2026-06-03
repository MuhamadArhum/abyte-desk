import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { C } from '../constants/theme';

export default function LoginScreen() {
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth, token } = useAuthStore();

  useEffect(() => {
    if (token) router.replace('/(main)/(tabs)/home');
  }, [token]);

  const handleLogin = async () => {
    if (!companyCode.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        company_code: companyCode.trim().toLowerCase(),
        email: email.trim(),
        password,
      });
      const { token: tok, user } = res.data;
      await setAuth(user, tok);
      router.replace('/(main)/(tabs)/home');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Hero area */}
        <View style={styles.hero}>
          <View style={styles.logoOuter}>
            <View style={styles.logoRing}>
              <Ionicons name="restaurant" size={44} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.heroTitle}>AByte Waiter</Text>
          <Text style={styles.heroSub}>Restaurant Order Management</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSub}>Sign in to start taking orders</Text>

          <Field label="Company Code" icon="business-outline">
            <TextInput
              style={styles.input}
              placeholder="e.g. abyte"
              placeholderTextColor={C.t3}
              value={companyCode}
              onChangeText={setCompanyCode}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </Field>

          <Field label="Email Address" icon="mail-outline">
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={C.t3}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
          </Field>

          <Field label="Password" icon="lock-closed-outline">
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={C.t3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.t3} />
            </TouchableOpacity>
          </Field>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : (
                <View style={styles.loginBtnInner}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              )
            }
          </TouchableOpacity>

          <Text style={styles.version}>AByte POS  ·  Waiter App v1.0</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Ionicons name={icon} size={17} color={C.t3} style={styles.fieldIcon} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryHd },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },

  hero: { alignItems: 'center', marginBottom: 36 },
  logoOuter: {
    width: 116, height: 116, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  logoRing: {
    width: 92, height: 92, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.7 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 5, letterSpacing: 0.3 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 16,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.t1, letterSpacing: -0.5 },
  cardSub: { fontSize: 13, color: C.t3, marginTop: 4, marginBottom: 24 },

  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.t2, marginBottom: 7, letterSpacing: 0.4, textTransform: 'uppercase' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, backgroundColor: C.surface, height: 50,
  },
  fieldIcon: { paddingLeft: 14, paddingRight: 8 },
  input: { flex: 1, height: 50, fontSize: 14, color: C.t1, paddingRight: 12 },
  eyeBtn: { padding: 13 },

  loginBtn: {
    backgroundColor: C.primary,
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },

  version: { textAlign: 'center', fontSize: 11, color: C.t3, marginTop: 20, letterSpacing: 0.3 },
});
