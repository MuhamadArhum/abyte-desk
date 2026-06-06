import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TouchableWithoutFeedback, StatusBar, Platform, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useAuthStore from '../store/authStore';
import useRefreshStore from '../store/refreshStore';
import { C, shadow } from '../constants/theme';

const logo = require('../assets/logo.png');

export default function Sidebar({ visible, onClose }) {
  const { user, logout } = useAuthStore();
  const { startRefresh, endRefresh } = useRefreshStore();

  const slideX   = useRef(new Animated.Value(-300)).current;
  const overlay  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX,  { toValue: 0,   tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 1,   duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,  { toValue: -300, duration: 260, useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 0,    duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/login');
  };

  const handleRefresh = () => {
    onClose();
    startRefresh();
    router.replace('/(main)/(tabs)/home');
    setTimeout(endRefresh, 1800);
  };

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const initial = (user?.name || user?.username || 'W').charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dimmed overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlay }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View style={[styles.sidebar, { paddingTop: statusBarH, transform: [{ translateX: slideX }] }]}>

        {/* Profile header */}
        <View style={styles.profileHead}>
          {/* AByte logo — top right watermark */}
          <Image source={logo} style={styles.headerLogo} resizeMode="contain" />

          {/* Avatar */}
          <View style={styles.avatarRing}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.profileName}>{user?.name || 'Waiter'}</Text>
          <Text style={styles.profileRole}>{user?.role_name || 'Waiter'}</Text>

          <View style={styles.branchChip}>
            <Ionicons name="location-outline" size={12} color={C.primaryBd} />
            <Text style={styles.branchText}>{user?.branch_name || 'Main Branch'}</Text>
          </View>
        </View>

        {/* Account details */}
        <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionLabel}>
            <Ionicons name="person-circle-outline" size={13} color={C.t3} />
            <Text style={styles.sectionLabelText}>Account Details</Text>
          </View>
          <View style={styles.infoSection}>
            <InfoRow icon="person-outline"      label="Full Name" value={user?.name} />
            <InfoRow icon="at-outline"          label="Username"  value={user?.username} />
            <InfoRow icon="mail-outline"        label="Email"     value={user?.email} />
            <InfoRow icon="shield-outline"      label="Role"      value={user?.role_name || 'Waiter'} />
            <InfoRow icon="git-branch-outline"  label="Branch"    value={user?.branch_name || 'Main Branch'} last />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>

          {/* Brand strip */}
          <View style={styles.brandStrip}>
            <Image source={logo} style={styles.footerLogo} resizeMode="contain" />
            <View style={styles.brandTexts}>
              <Text style={styles.brandName}>AByte Waiter</Text>
              <Text style={styles.brandSub}>POS System  ·  v1.0</Text>
            </View>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <View style={styles.footerDivider} />

          {/* Refresh button */}
          <TouchableOpacity style={styles.actionBtn} onPress={handleRefresh} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: C.blueBg }]}>
              <Ionicons name="refresh-outline" size={18} color={C.blue} />
            </View>
            <View style={styles.actionTexts}>
              <Text style={[styles.actionTitle, { color: C.blue }]}>Refresh App</Text>
              <Text style={styles.actionSub}>Reload menus & data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.blue} />
          </TouchableOpacity>

          {/* Sign out button */}
          <TouchableOpacity style={[styles.actionBtn, styles.logoutRow]} onPress={handleLogout} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: C.redBg }]}>
              <Ionicons name="log-out-outline" size={18} color={C.red} />
            </View>
            <View style={styles.actionTexts}>
              <Text style={[styles.actionTitle, { color: C.red }]}>Sign Out</Text>
              <Text style={styles.actionSub}>End your session</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.red} />
          </TouchableOpacity>

        </View>
      </Animated.View>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={15} color={C.primary} />
      </View>
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,10,22,0.6)',
  },
  sidebar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 298,
    backgroundColor: C.card,
    ...shadow.lg,
  },

  // Profile header
  profileHead: {
    backgroundColor: C.primaryHd,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 28,
    alignItems: 'center',
  },
  headerLogo: {
    position: 'absolute', top: 16, right: 16,
    width: 30, height: 30, opacity: 0.45,
  },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarOuter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 30, color: '#FFFFFF', fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  profileRole: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  branchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  branchText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  // Info section
  infoScroll: { flex: 1 },
  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
  },
  sectionLabelText: {
    fontSize: 10, fontWeight: '700', color: C.t3,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  infoSection: { paddingHorizontal: 14 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  infoIconBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
  },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  infoValue: { fontSize: 13.5, color: C.t1, fontWeight: '600', marginTop: 2 },

  // Footer
  footer: {
    paddingTop: 14, paddingHorizontal: 16, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  brandStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6, paddingHorizontal: 2, marginBottom: 4,
  },
  footerLogo: { width: 34, height: 34 },
  brandTexts: { flex: 1 },
  brandName: { fontSize: 14, fontWeight: '800', color: C.t1, letterSpacing: -0.2 },
  brandSub:  { fontSize: 10, color: C.t3, marginTop: 1, letterSpacing: 0.3 },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  liveText: { fontSize: 10, fontWeight: '700', color: C.primary },

  footerDivider: { height: 1, backgroundColor: C.borderLt, marginBottom: 12 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 16, marginBottom: 8,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  logoutRow: {
    backgroundColor: C.redBg, borderColor: '#FECACA', marginBottom: 0,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTexts: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  actionSub:   { fontSize: 11, color: C.t3, marginTop: 1 },
});
