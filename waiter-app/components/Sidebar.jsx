import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useAuthStore from '../store/authStore';

export default function Sidebar({ visible, onClose }) {
  const { user, logout } = useAuthStore();
  if (!visible) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/login');
  };

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={[styles.sidebar, { paddingTop: statusBarH }]}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.username || 'W').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Waiter'}</Text>
          <Text style={styles.profileRole}>{user?.role_name || 'Waiter'}</Text>
          <View style={styles.branchBadge}>
            <Ionicons name="location-outline" size={11} color="#6EE7B7" />
            <Text style={styles.branchText}>{user?.branch_name || 'Main Branch'}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <InfoRow icon="person-outline" label="Full Name" value={user?.name} />
          <InfoRow icon="at-outline" label="Username" value={user?.username} />
          <InfoRow icon="mail-outline" label="Email" value={user?.email} />
          <InfoRow icon="shield-outline" label="Role" value={user?.role_name || 'Waiter'} />
          <InfoRow icon="git-branch-outline" label="Branch" value={user?.branch_name || 'Main Branch'} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>AByte Waiter  •  v1.0</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color="#059669" />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 285,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },

  profileHeader: {
    backgroundColor: '#059669',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 22,
    alignItems: 'center',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { fontSize: 30, color: '#FFFFFF', fontWeight: 'bold' },
  profileName: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  profileRole: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  branchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  branchText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  infoSection: {
    paddingVertical: 12, paddingHorizontal: 16, gap: 4,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
  },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500', marginTop: 1 },

  footer: { marginTop: 'auto', padding: 16 },
  version: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginBottom: 12 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, borderRadius: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 14, color: '#DC2626', fontWeight: '700' },
});
