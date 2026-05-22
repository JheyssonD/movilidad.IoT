// ─── Pantalla de Login ─────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Ingresa email y contraseña');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Error de autenticación', e.message ?? 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.card}>
        {/* Logo / Marca */}
        <View style={s.logoWrap}>
          <View style={s.logoIcon}>
            <Text style={s.logoText}>◎</Text>
          </View>
          <Text style={s.logoTitle}>SIMON MOVILIDAD</Text>
          <Text style={s.logoSub}>IoT Fleet Monitor</Text>
        </View>

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="Correo electrónico"
          placeholderTextColor={theme.text.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={s.label}>Contraseña</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          placeholderTextColor={theme.text.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Iniciar Sesión</Text>
          }
        </TouchableOpacity>

        <Text style={s.hint}>admin@simon.com / Admin123!</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg.primary, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: theme.bg.secondary,
    borderRadius: theme.radius.lg,
    padding: 28,
    borderWidth: 1,
    borderColor: theme.border,
  },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: theme.color.primaryGlow,
    borderWidth: 1, borderColor: theme.color.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  logoText:  { fontSize: 32, color: theme.color.primary },
  logoTitle: { fontSize: 18, fontWeight: '800', color: theme.text.primary, letterSpacing: 2 },
  logoSub:   { fontSize: 12, color: theme.text.secondary, marginTop: 4 },
  label:     { fontSize: 12, color: theme.text.secondary, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: theme.bg.tertiary,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radius.sm,
    padding: 12, color: theme.text.primary, fontSize: 14,
  },
  btn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.sm,
    padding: 14, alignItems: 'center', marginTop: 28,
  },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint:      { textAlign: 'center', color: theme.text.muted, fontSize: 11, marginTop: 16 },
});
