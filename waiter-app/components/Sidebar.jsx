import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, StatusBar, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useAuthStore from '../store/authStore';
import { C, shadow } from '../constants/theme';

export default function Sidebar({ visible, onClose }) {
  const { user, logout } = useAuthStore();
  if (!visible) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/login');
  };

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const initial = (user?.name || user?.username || 'W').charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={[styles.sidebar, { paddingTop: statusBarH }]}>

        {/* Profile header */}
        <View style={styles.profileHead}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Waiter'}</Text>
          <Text style={styles.profileRole}>{user?.role_name || 'Waiter'}</Text>
          <View style={styles.branchChip}>
            <Ionicons name="location-outline" size={12} color={C.primaryBd} />
            <Text style={styles.branchText}>{user?.branch_name || 'Main Branch'}</Text>
          </View>
        </View>

        {/* Info rows */}
        <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>Account Details</Text>
          </View>
          <View style={styles.infoSection}>
            <InfoRow icon="person-outline"   label="Full Name" value={user?.name} />
            <InfoRow icon="at-outline"       label="Username"  value={user?.username} />
            <InfoRow icon="mail-outline"     label="Email"     value={user?.email} />
            <InfoRow icon="shield-outline"   label="Role"      value={user?.role_name || 'Waiter'} />
            <InfoRow icon="git-branch-outline" label="Branch"  value={user?.branch_name || 'Main Branch'} />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.version}>AByte Waiter  ·  v1.0</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={18} color={C.red} />
            </View>
            <Text style={styles.logoutText}>Sign Out</Text>
            <Ionicons name="arrow-forward" size={14} color={C.red} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sidebar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 290,
    backgroundColor: C.card,
    ...shadow.lg,
  },

  profileHead: {
    backgroundColor: C.primaryHd,
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26,
    alignItems: 'center',
  },
  avatarOuter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, color: '#FFFFFF', fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  profileRole: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  branchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  branchText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  infoScroll: { flex: 1 },
  sectionLabel: {
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8,
  },
  sectionLabelText: {
    fontSize: 10, fontWeight: '700', color: C.t3,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  infoSection: { paddingHorizontal: 14, gap: 2 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  infoIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
  },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  infoValue: { fontSize: 14, color: C.t1, fontWeight: '600', marginTop: 1 },

  footer: { padding: 18, borderTopWidth: 1, borderTopColor: C.border },
  version: { textAlign: 'center', fontSize: 11, color: C.t3, marginBottom: 14, letterSpacing: 0.3 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14,
    backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBd,
  },
  logoutIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { fontSize: 14, color: C.red, fontWeight: '700' },
});
