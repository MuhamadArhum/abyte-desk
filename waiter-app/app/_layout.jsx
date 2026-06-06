import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import RefreshLoader from '../components/RefreshLoader';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loadAuth, isLoading } = useAuthStore();

  useEffect(() => {
    loadAuth().finally(() => SplashScreen.hideAsync());
  }, []);

  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(main)" />
        </Stack>
        <Toast />
        <ConfirmDialog />
        <RefreshLoader />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
