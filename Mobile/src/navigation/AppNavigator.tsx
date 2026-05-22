import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MapScreen       from '../screens/MapScreen';
import FleetListScreen from '../screens/FleetListScreen';
import { theme }        from '../theme';
import { useAuth }      from '../context/AuthContext';

const Tab = createBottomTabNavigator();

function TabIcon({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

function HeaderBanner() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <SafeAreaView style={hs.safeArea}>
      <View style={hs.container}>
        {/* Left Side: Brand Logo & Title */}
        <View style={hs.brandContainer}>
          <Text style={hs.brandEmoji}>🚌</Text>
          <Text style={hs.brandName}>Simon Movilidad</Text>
        </View>

        {/* Right Side: Profile Info + Logout */}
        <View style={hs.profileRow}>
          <View style={hs.userInfo}>
            <Text numberOfLines={1} style={hs.userEmail}>{user.email}</Text>
            <View style={[hs.badge, user.role === 'Admin' ? hs.badgeAdmin : hs.badgeUser]}>
              <Text style={hs.badgeText}>
                {user.role === 'Admin' ? 'Administrador' : 'Operador'}
              </Text>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity onPress={logout} style={hs.logoutBtn} activeOpacity={0.7}>
            <Text style={hs.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function AppNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          header: () => <HeaderBanner />,
          tabBarStyle: {
            backgroundColor: theme.bg.secondary,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 6,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
          },
          tabBarActiveTintColor:   theme.color.primary,
          tabBarInactiveTintColor: theme.text.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
          headerStyle: {
            backgroundColor: theme.bg.secondary,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
          },
          headerTintColor: theme.text.primary,
          headerTitleStyle: { fontSize: 15, fontWeight: '700' },
        }}
      >
        <Tab.Screen
          name="Mapa"
          component={MapScreen}
          options={{
            title: 'Mapa en Vivo',
            tabBarLabel: 'Mapa',
            tabBarIcon: ({ focused }) => <TabIcon label="Mapa" emoji="🗺️" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Flota"
          component={FleetListScreen}
          options={{
            title: 'Flota Vehicular',
            tabBarLabel: 'Flota',
            tabBarIcon: ({ focused }) => <TabIcon label="Flota" emoji="🚌" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const hs = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingTop: Platform.OS === 'android' ? 35 : 0, // Ajuste de Safe Area para la barra de estado de Android
  },
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandEmoji: {
    fontSize: 20,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text.primary,
    letterSpacing: 0.5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  userEmail: {
    fontSize: 11,
    color: theme.text.primary,
    fontWeight: '600',
    maxWidth: 120,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  badgeAdmin: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  badgeUser: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.text.primary,
  },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 16,
  },
});

