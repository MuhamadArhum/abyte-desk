import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tables" />
      <Stack.Screen name="order/[id]" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
