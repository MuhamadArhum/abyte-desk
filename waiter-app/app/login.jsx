import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Image, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { C } from '../constants/theme';

const logo = require('../assets/logo.png');

export default function LoginScreen() {
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const { setAuth, token } = useAuthStore();
  const { showToast }      = useToastStore();

  // Mount animation
  const mountAnim  = useRef(new Animated.Value(0)).current;
  const logoPulse  = useRef(new Animated.Value(1)).current;
  const blob1Anim  = useRef(new Animated.Value(0)).current;
  const blob2Anim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (token) router.replace('/(main)/(tabs)/home');
  }, [token]);

  useEffect(() => {
    Animated.timing(mountAnim, { toValue: 1, duration: 550, useNativeDriver: true }).start();

    // Blob drifting
    Animated.loop(
      Animated.sequence([
        Animated.timing(blob1Anim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(blob1Anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blob2Anim, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(blob2Anim, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ])
    ).start();

    // Logo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    if (!companyCode.trim() || !email.trim() || !password.trim()) {
      showToast('Please fill in all fields.', 'warning');
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
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const blob1Y = blob1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  const blob2Y = blob2Anim.interpolate({ inputRange: [0, 1], outputRange: [0,  20] });

  const cardOpacity   = mountAnim;
  const cardTranslate = mountAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const heroOpacity   = mountAnim;
  const heroTranslate = mountAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      {/* Decorative background blobs */}
      <Animated.View style={[styles.blob, styles.blobTR, { transform: [{ translateY: blob1Y }] }]} />
      <Animated.View style={[styles.blob, styles.blobBL, { transform: [{ translateY: blob2Y }] }]} />
      <View style={styles.blobCenter} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }]}>
          <View style={styles.logoOuter}>
            <View style={styles.logoGlow} />
            <Animated.Image
              source={logo}
              style={[styles.logoImg, { transform: [{ scale: logoPulse }] }]}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroTitle}>AByte Waiter</Text>
          <Text style={styles.heroSub}>Restaurant Order Management</Text>

          {/* Decorative badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="restaurant-outline" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.badgeText}>POS System</Text>
            </View>
            <View style={styles.badgeDot} />
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.badgeText}>Secure Login</Text>
            </View>
          </View>
        </Animated.View>

        {/* Form card */}
        <Animated.View style={[
          styles.card,
          { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] },
        ]}>
          {/* Card header accent */}
          <View style={styles.cardAccent} />

          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSub}>Sign in to start taking orders</Text>

            <Field
              label="Company Code"
              icon="business-outline"
              focused={focusedField === 'company'}
            >
              <TextInput
                style={styles.input}
                placeholder="e.g. abyte"
                placeholderTextColor={C.t3}
                value={companyCode}
                onChangeText={setCompanyCode}
                onFocus={() => setFocusedField('company')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </Field>

            <Field
              label="Email Address"
              icon="mail-outline"
              focused={focusedField === 'email'}
            >
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={C.t3}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />
            </Field>

            <Field
              label="Password"
              icon="lock-closed-outline"
              focused={focusedField === 'password'}
            >
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor={C.t3}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPw ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={C.t3}
                />
              </TouchableOpacity>
            </Field>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.loginBtnInner}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.loginBtnText}>Signing In...</Text>
                </View>
              ) : (
                <View style={styles.loginBtnInner}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <View style={styles.loginBtnArrow}>
                    <Ionicons name="arrow-forward" size={16} color={C.primary} />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <View style={styles.footerDivider} />
              <Text style={styles.version}>AByte POS  ·  v1.0</Text>
              <View style={styles.footerDivider} />
            </View>
          </View>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, focused, children }) {
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.primary],
  });

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>{label}</Text>
      <Animated.View style={[styles.fieldRow, { borderColor }]}>
        <Ionicons
          name={icon}
          size={17}
          color={focused ? C.primary : C.t3}
          style={styles.fieldIcon}
        />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryHd },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },

  // Background blobs
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  blobTR:     { width: 300, height: 300, top: -120, right: -100 },
  blobBL:     { width: 240, height: 240, bottom: -80, left: -80 },
  blobCenter: {
    position: 'absolute',
    width: 180, height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.025)',
    top: '30%', left: '20%',
  },

  // Hero
  hero: { alignItems: 'center', marginBottom: 32 },
  logoOuter: {
    width: 114, height: 114, borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 14,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 114, height: 114, borderRadius: 36,
    backgroundColor: C.primary,
    opacity: 0.12,
    transform: [{ scale: 1.12 }],
  },
  logoImg: { width: 82, height: 82 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.7, marginBottom: 6 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3, marginBottom: 14 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  badgeText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  badgeDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 18,
  },
  cardAccent: {
    height: 5,
    backgroundColor: C.primary,
  },
  cardBody: { padding: 26 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.t1, letterSpacing: -0.5 },
  cardSub:   { fontSize: 13, color: C.t3, marginTop: 4, marginBottom: 24 },

  // Fields
  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.t3,
    marginBottom: 7, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  fieldLabelFocused: { color: C.primary },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14, backgroundColor: C.surface, height: 52,
  },
  fieldIcon: { paddingLeft: 14, paddingRight: 8 },
  input: { flex: 1, height: 52, fontSize: 14, color: C.t1, paddingRight: 12 },
  eyeBtn: { padding: 14 },

  // Login button
  loginBtn: {
    backgroundColor: C.primaryHd,
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
    shadowColor: C.primaryHd,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loginBtnText:  { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  loginBtnArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },

  footerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22,
  },
  footerDivider: { flex: 1, height: 1, backgroundColor: C.border },
  version: { fontSize: 11, color: C.t3, letterSpacing: 0.4 },
});
