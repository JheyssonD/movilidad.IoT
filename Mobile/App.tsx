// ─── Entry point de la aplicación ─────────────────────────────────────────────
import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { AuthProvider, useAuth }         from './src/context/AuthContext';
import { TelemetryProvider }              from './src/context/TelemetryContext';
import AppNavigator                       from './src/navigation/AppNavigator';
import LoginScreen                        from './src/screens/LoginScreen';
import { theme }                          from './src/theme';

import { SafeAreaProvider } from 'react-native-safe-area-context';

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <TelemetryProvider>
      <AppNavigator />
    </TelemetryProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg.secondary} />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
