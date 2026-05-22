import React, { useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Animated, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTelemetry, VehicleTelemetry } from '../context/TelemetryContext';
import { theme } from '../theme';

function PulseDot({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  if (!active) return null;
  return (
    <Animated.View style={[s.dot, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
  );
}

function VehicleCard({ v, isSelected, onPress }: {
  v: VehicleTelemetry; isSelected: boolean; onPress: () => void;
}) {
  const autonomy = v.averageConsumptionPerHour > 0 ? v.fuelLevel / v.averageConsumptionPerHour : 99;
  const critical = autonomy < 1.0;
  const fuelPct  = Math.min(100, Math.max(0, (v.fuelLevel / 72) * 100));

  return (
    <TouchableOpacity
      style={[s.card, isSelected && s.cardActive, critical && s.cardCritical]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.cardHeader}>
        <Text style={[s.vehicleId, critical && { color: theme.color.danger }]}>{v.vehicleId}</Text>
        <PulseDot active={critical} />
        {v.city && <Text style={s.city}>{v.city}</Text>}
      </View>

      {v.pending ? (
        <Text style={s.pending}>Esperando telemetría…</Text>
      ) : (
        <>
          <View style={s.metrics}>
            <View style={s.metric}>
              <Text style={s.metricLabel}>Velocidad</Text>
              <Text style={[s.metricVal, { color: theme.color.primary }]}>{v.speed.toFixed(1)} km/h</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLabel}>Combustible</Text>
              <Text style={[s.metricVal, { color: critical ? theme.color.danger : theme.color.warning }]}>
                {v.fuelLevel.toFixed(1)} L
              </Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLabel}>Autonomía</Text>
              <Text style={[s.metricVal, { color: critical ? theme.color.danger : theme.color.success }]}>
                {autonomy > 50 ? '∞' : autonomy.toFixed(1) + ' h'}
              </Text>
            </View>
          </View>

          {/* Barra de combustible */}
          <View style={s.fuelBar}>
            <View style={[s.fuelFill, {
              width: `${fuelPct}%` as any,
              backgroundColor: critical ? theme.color.danger : fuelPct < 30 ? theme.color.warning : theme.color.success,
            }]} />
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function FleetListScreen() {
  const { vehicles, selectedId, selectVehicle, isOffline, isConnected } = useTelemetry();
  const navigation = useNavigation<any>();

  return (
    <View style={s.root}>
      {/* Header de estado */}
      <View style={s.statusBar}>
        <View style={[s.statusDot, { backgroundColor: isConnected ? theme.color.success : theme.color.danger }]} />
        <Text style={s.statusText}>
          {isOffline ? 'Modo Offline' : isConnected ? 'En línea — SignalR activo' : 'Conectando…'}
        </Text>
        <View style={s.count}>
          <Text style={s.countText}>{vehicles.length} unidades</Text>
        </View>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={v => v.vehicleId}
        renderItem={({ item }) => (
          <VehicleCard
            v={item}
            isSelected={item.vehicleId === selectedId}
            onPress={() => {
              selectVehicle(item.vehicleId);
              navigation.navigate('Mapa');
            }}
          />
        )}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📡</Text>
            <Text style={s.emptyText}>Cargando flota…</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: theme.bg.primary },
  list:   { padding: 14 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.bg.secondary, padding: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { flex: 1, fontSize: 11, color: theme.text.secondary },
  count: {
    backgroundColor: theme.bg.tertiary, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: theme.border,
  },
  countText: { fontSize: 11, color: theme.color.primary, fontWeight: '700' },

  card: {
    backgroundColor: theme.bg.card,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radius.sm,
    padding: 14,
  },
  cardActive:   { borderColor: theme.color.primary, backgroundColor: theme.color.primaryGlow },
  cardCritical: { borderColor: theme.color.danger + '66' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  vehicleId:  { fontSize: 13, fontWeight: '700', color: theme.text.primary, flex: 1 },
  city:       { fontSize: 10, color: theme.text.secondary },

  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: theme.color.danger,
  },

  pending: { fontSize: 12, color: theme.text.muted, fontStyle: 'italic' },

  metrics:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metric:     { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 10, color: theme.text.muted, marginBottom: 2 },
  metricVal:  { fontSize: 13, fontWeight: '700' },

  fuelBar: { height: 4, backgroundColor: theme.bg.tertiary, borderRadius: 2, overflow: 'hidden' },
  fuelFill: { height: '100%', borderRadius: 2 },

  empty:     { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: theme.text.secondary, fontSize: 14 },
});
