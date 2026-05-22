import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTelemetry, VehicleTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { theme } from '../theme';

interface TelemetryPoint {
  vehicleId?: string;
  timestamp: string;
  speed: number;
  fuelLevel: number;
  temperature: number;
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

function VehicleMarker({ v, isSelected, onPress }: {
  v: VehicleTelemetry; isSelected: boolean; onPress: () => void;
}) {
  const autonomy = v.averageConsumptionPerHour > 0 ? v.fuelLevel / v.averageConsumptionPerHour : 99;
  const critical = autonomy < 1.0;
  const color = critical ? theme.color.danger : isSelected ? theme.color.primary : theme.color.success;

  return (
    <Marker
      coordinate={{ latitude: v.latitude, longitude: v.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[s.markerOuter, { borderColor: color, backgroundColor: color + '22' }]}>
        <View style={[s.markerInner, { backgroundColor: color }]}>
          <Text style={s.markerIcon}>🚌</Text>
        </View>
      </View>
    </Marker>
  );
}

function NativeTelemetryChart({ history }: { history: TelemetryPoint[] }) {
  const [chartWidth, setChartWidth] = useState(300);
  const plotHeight = 110;
  const plotWidth = chartWidth - 80;

  const sorted = [...history].reverse();
  const n = sorted.length;

  if (n === 0) return null;

  // Calculate dynamic max values to auto-scale, matching Chart.js on Web/Angular
  const speedVals = sorted.map(pt => pt.speed);
  const fuelVals = sorted.map(pt => pt.fuelLevel);
  const maxSpeed = Math.max(...speedVals, 20); // Fallback min to 20
  const maxFuel = Math.max(...fuelVals, 10);   // Fallback min to 10

  const safeParseTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const speedPoints = sorted.map((pt, i) => {
    const x = 40 + (i / (n - 1 || 1)) * plotWidth;
    const y = 135 - (Math.min(pt.speed, maxSpeed) / maxSpeed) * plotHeight;
    return { x, y, val: pt.speed, time: safeParseTime(pt.timestamp) };
  });

  const fuelPoints = sorted.map((pt, i) => {
    const x = 40 + (i / (n - 1 || 1)) * plotWidth;
    const y = 135 - (Math.min(pt.fuelLevel, maxFuel) / maxFuel) * plotHeight;
    return { x, y, val: pt.fuelLevel, time: safeParseTime(pt.timestamp) };
  });

  const renderLines = (points: typeof speedPoints, color: string) => {
    const segments: React.ReactNode[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;

      segments.push(
        <View
          key={`seg-${i}`}
          style={{
            position: 'absolute',
            left: cx - dist / 2,
            top: cy - 1.25,
            width: dist,
            height: 2.5,
            backgroundColor: color,
            transform: [{ rotate: `${angle}rad` }],
          }}
        />
      );
    }
    return segments;
  };

  return (
    <View
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      style={{ height: 185, width: '100%', position: 'relative', marginTop: 10 }}
    >
      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
        const y = 135 - val * plotHeight;
        return (
          <View
            key={`grid-${idx}`}
            style={{
              position: 'absolute',
              left: 40,
              right: 40,
              top: y,
              height: 1,
              backgroundColor: theme.border,
              opacity: 0.2,
            }}
          />
        );
      })}

      {/* Left Axis Labels (Speed - Blue, dynamic steps) */}
      {[maxSpeed, maxSpeed * 0.66, maxSpeed * 0.33, 0].map((val, idx) => {
        const y = 135 - (val / maxSpeed) * plotHeight - 6;
        return (
          <Text
            key={`lbl-speed-${idx}`}
            style={{
              position: 'absolute',
              left: 2,
              top: y,
              fontSize: 9,
              color: theme.color.primary,
              fontWeight: '700',
              width: 32,
              textAlign: 'right',
            }}
          >
            {Math.round(val)}
          </Text>
        );
      })}

      {/* Right Axis Labels (Fuel - Orange, dynamic steps) */}
      {[maxFuel, maxFuel * 0.66, maxFuel * 0.33, 0].map((val, idx) => {
        const y = 135 - (val / maxFuel) * plotHeight - 6;
        return (
          <Text
            key={`lbl-fuel-${idx}`}
            style={{
              position: 'absolute',
              right: 2,
              top: y,
              fontSize: 9,
              color: theme.color.warning,
              fontWeight: '700',
              width: 32,
              textAlign: 'left',
            }}
          >
            {Math.round(val)}L
          </Text>
        );
      })}

      {/* Line Segments */}
      {renderLines(speedPoints, theme.color.primary)}
      {renderLines(fuelPoints, theme.color.warning)}

      {/* Speed Data Nodes */}
      {speedPoints.map((pt, idx) => (
        <View
          key={`dot-speed-${idx}`}
          style={{
            position: 'absolute',
            left: pt.x - 4,
            top: pt.y - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.color.primary,
            borderWidth: 1.5,
            borderColor: theme.bg.secondary,
          }}
        />
      ))}

      {/* Fuel Data Nodes */}
      {fuelPoints.map((pt, idx) => (
        <View
          key={`dot-fuel-${idx}`}
          style={{
            position: 'absolute',
            left: pt.x - 4,
            top: pt.y - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.color.warning,
            borderWidth: 1.5,
            borderColor: theme.bg.secondary,
          }}
        />
      ))}

      {/* Bottom Axis Labels (Time - showing first, middle, last to avoid mobile overlap) */}
      {speedPoints.map((pt, idx) => {
        const shouldShowLabel = idx === 0 || idx === Math.floor((n - 1) / 2) || idx === n - 1;
        if (!shouldShowLabel || !pt.time) return null;
        return (
          <Text
            key={`lbl-time-${idx}`}
            style={{
              position: 'absolute',
              left: pt.x - 25,
              top: 148,
              fontSize: 8,
              color: theme.text.muted,
              width: 50,
              textAlign: 'center',
            }}
          >
            {pt.time}
          </Text>
        );
      })}

      {/* Legend Row */}
      <View
        style={{
          position: 'absolute',
          bottom: 2,
          left: 40,
          right: 40,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.primary }} />
          <Text style={{ fontSize: 9, color: theme.text.primary, fontWeight: '600' }}>Velocidad (km/h)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.warning }} />
          <Text style={{ fontSize: 9, color: theme.text.primary, fontWeight: '600' }}>Combustible (L)</Text>
        </View>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const { vehicles, selectedId, selectVehicle, alerts, historyLog } = useTelemetry();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const activeId = selectedId || (vehicles.length > 0 ? vehicles[0].vehicleId : null);
  const selectedVehicle = vehicles.find(v => v.vehicleId === activeId);

  // Derivar reactivamente el historial del vehículo activo del log global
  const history = historyLog
    .filter(item => item.vehicleId === activeId)
    .slice(0, 10) // Mostrar últimas 10 en layout nativo para paridad total con Angular
    .map(item => ({
      timestamp: item.timestamp,
      speed: item.speed,
      fuelLevel: item.fuelLevel,
      temperature: item.temperature,
    }));

  // Animar mapa al vehículo seleccionado
  useEffect(() => {
    if (!selectedVehicle || selectedVehicle.latitude === 0) return;
    mapRef.current?.animateToRegion({
      latitude: selectedVehicle.latitude,
      longitude: selectedVehicle.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 600);
  }, [selectedId]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.contentContainer}>
      {/* 1. Stats Row */}
      <View style={s.statsGrid}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Vehículos Monitoreados</Text>
          <Text style={[s.statVal, { color: theme.color.primary }]}>{vehicles.length}</Text>
        </View>
        {user?.role === 'Admin' && (
          <View style={s.statCard}>
            <Text style={s.statLabel}>Baja Autonomía (&lt; 1h)</Text>
            <Text style={[s.statVal, { color: theme.color.danger }]}>
              {vehicles.filter(v => v.averageConsumptionPerHour > 0 && (v.fuelLevel / v.averageConsumptionPerHour) < 1.0).length}
            </Text>
          </View>
        )}
        <View style={s.statCard}>
          <Text style={s.statLabel}>Velocidad Promedio</Text>
          <Text style={[s.statVal, { color: theme.color.success }]}>62.4 km/h</Text>
        </View>
      </View>

      {/* 2. Google Maps Container */}
      <View style={s.mapWrapper}>
        <Text style={s.sectionTitle}>🗺️ Mapa de Operación Realtime</Text>
        <View style={s.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            customMapStyle={DARK_MAP_STYLE}
            initialRegion={{ latitude: 4.57, longitude: -74.3, latitudeDelta: 8, longitudeDelta: 8 }}
            showsUserLocation={false}
            showsTraffic={false}
          >
            {vehicles
              .filter(v => v.latitude !== 0 && v.longitude !== 0)
              .map(v => (
                <VehicleMarker
                  key={v.vehicleId}
                  v={v}
                  isSelected={v.vehicleId === selectedId}
                  onPress={() => selectVehicle(v.vehicleId)}
                />
              ))}
          </MapView>
        </View>
      </View>

      {/* 3. History Timeline Container */}
      <View style={s.chartWrapper}>
        <Text style={s.sectionTitle}>📈 Histórico Reciente: {activeId || 'Ninguno'}</Text>
        <View style={s.chartCard}>
          {history.length === 0 ? (
            <Text style={s.noData}>No hay lecturas históricas disponibles.</Text>
          ) : (
            <NativeTelemetryChart history={history} />
          )}
        </View>
      </View>

      {/* 4. Predictive Alerts Feed Container */}
      {user?.role === 'Admin' && (
        <View style={s.alertsWrapper}>
          <Text style={s.sectionTitle}>⚠️ Centro de Alertas Predictivas</Text>
          <View style={s.alertsCard}>
            {alerts.length === 0 ? (
              <View style={s.emptyAlerts}>
                <Text style={s.emptyAlertIcon}>✔️</Text>
                <Text style={s.emptyAlertText}>Sin alertas activas en la flota</Text>
              </View>
            ) : (
              <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 185 }} contentContainerStyle={{ paddingRight: 4 }}>
                {alerts.map((alert, i) => (
                  <View key={i} style={s.alertItem}>
                    <View style={s.alertDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertMsg}>{alert.message}</Text>
                      <Text style={s.alertTime}>{new Date(alert.timestamp).toLocaleTimeString()}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg.primary },
  contentContainer: { padding: 14, paddingBottom: 30 },
  
  statsGrid: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    backgroundColor: theme.bg.secondary,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radius.sm,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: { fontSize: 9, fontWeight: '600', color: theme.text.muted, textAlign: 'center', marginBottom: 4 },
  statVal: { fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.text.primary, marginBottom: 8 },
  
  mapWrapper: {},
  mapContainer: {
    height: 300,
    backgroundColor: theme.bg.secondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden',
  },

  markerOuter: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  markerInner: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  markerIcon: { fontSize: 14 },

  chartWrapper: {},
  chartCard: {
    backgroundColor: theme.bg.secondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.border,
    padding: 14,
  },
  tickCard: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  tickTime: { fontSize: 10, color: theme.text.muted, marginBottom: 4 },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  metricLabel: { width: 80, fontSize: 11, color: theme.text.secondary },
  barContainer: { flex: 1, height: 6, backgroundColor: theme.bg.primary, borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  metricVal: { width: 70, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  alertsWrapper: {},
  alertsCard: {
    backgroundColor: theme.bg.secondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.border,
    padding: 12,
  },
  emptyAlerts: { alignItems: 'center', paddingVertical: 16 },
  emptyAlertIcon: { fontSize: 24, color: theme.color.success, marginBottom: 8 },
  emptyAlertText: { fontSize: 12, color: theme.text.muted },
  
  alertItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    paddingVertical: 10,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.danger },
  alertMsg: { fontSize: 12, color: theme.text.primary, fontWeight: '600' },
  alertTime: { fontSize: 10, color: theme.text.muted, marginTop: 4 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noData: { color: theme.text.muted, fontSize: 12, textAlign: 'center' },
});
