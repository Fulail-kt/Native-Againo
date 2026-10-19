import './global.css';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { PopupHost } from './src/pop';
import { QueryProvider } from './src/query';
import { useFrameInsets } from './src/safe';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { BarberApp } from './src/screens/barber/BarberApp';
import { AdminApp } from './src/screens/gym/AdminApp';
import { MemberApp } from './src/screens/gym/MemberApp';
import { SuperAdminApp } from './src/screens/platform/SuperAdminApp';
import { colors, ThemeProvider, useTheme } from './src/theme';

function Boot() {
  const { top, bottom } = useFrameInsets();
  return (
    <View className="flex-1 items-center justify-center bg-bg" style={{ paddingTop: top, paddingBottom: bottom }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function Root() {
  const { ready, user } = useAuth();
  const { resolved } = useTheme();
  if (!ready) return <Boot />;
  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {!user ? (
        <AuthScreen />
      ) : user.role === 'SUPER_ADMIN' ? (
        <SuperAdminApp />
      ) : user.role === 'OWNER' && !user.emailVerified ? (
        <VerifyEmailScreen />
      ) : user.role === 'OWNER' || user.needsOnboarding ? (
        <OnboardingScreen />
      ) : user.role === 'GYM_ADMIN' ? (
        <AdminApp />
      ) : user.role === 'SHOP_OWNER' || user.role === 'SHOP_STAFF' ? (
        <BarberApp />
      ) : (
        <MemberApp />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <View
          className={
            Platform.OS === 'web'
              ? 'w-full max-w-[480px] min-h-[100dvh] flex-1 self-center bg-bg'
              : 'flex-1 bg-bg'
          }
        >
          <QueryProvider>
            <PopupHost>
              <AuthProvider>
                <Root />
              </AuthProvider>
            </PopupHost>
            <PortalHost />
          </QueryProvider>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
