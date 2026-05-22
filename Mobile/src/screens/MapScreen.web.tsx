import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Chart from 'chart.js/auto';
import { useTelemetry } from '../context/TelemetryContext';
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

export default function MapScreen() {
  const { vehicles, selectedId, selectVehicle, alerts, historyLog } = useTelemetry();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // 1. Leaflet Map HTML Content
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0b0f1a; overflow: hidden; }
        .leaflet-container { background: #0b0f1a !important; }
        .leaflet-bar a { background-color: #111827 !important; color: #f9fafb !important; border: 1px solid #374151 !important; }
        .leaflet-bar a:hover { background-color: #1f2937 !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false }).setView([4.57, -74.3], 6); // Colombia
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 20
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const markers = {};

        window.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'UPDATE') {
              const { vehicles, selectedId } = data;

              vehicles.forEach(v => {
                if (!v.latitude || !v.longitude) return;

                const isSelected = v.vehicleId === selectedId;
                const isCritical = v.averageConsumptionPerHour > 0 && (v.fuelLevel / v.averageConsumptionPerHour) < 1.0;
                
                const color = isCritical ? '#ef4444' : '#3b82f6';
                const radius = isSelected ? 12 : 8;

                if (markers[v.vehicleId]) {
                  markers[v.vehicleId].setLatLng([v.latitude, v.longitude]);
                  markers[v.vehicleId].setStyle({
                    color: color,
                    fillColor: color,
                    radius: radius,
                    weight: isSelected ? 3 : 1
                  });
                } else {
                  markers[v.vehicleId] = L.circleMarker([v.latitude, v.longitude], {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.8,
                    radius: radius,
                    weight: isSelected ? 3 : 1
                  }).addTo(map);

                  markers[v.vehicleId].bindTooltip(v.vehicleId, {
                    permanent: false,
                    direction: 'top'
                  });

                  markers[v.vehicleId].on('click', () => {
                    window.parent.postMessage(JSON.stringify({ type: 'SELECT_VEHICLE', vehicleId: v.vehicleId }), '*');
                  });
                }
              });

              if (selectedId) {
                const selectedVehicle = vehicles.find(v => v.vehicleId === selectedId);
                if (selectedVehicle && selectedVehicle.latitude && selectedVehicle.longitude) {
                  map.flyTo([selectedVehicle.latitude, selectedVehicle.longitude], 12);
                }
              }
            }
          } catch (e) {
            console.error("Error procesando mensaje en mapa:", e);
          }
        });
      </script>
    </body>
    </html>
  `;

  const activeId = selectedId || (vehicles.length > 0 ? vehicles[0].vehicleId : null);

  // Derivar reactivamente el historial del vehículo activo (de más viejo a más nuevo para ChartJS)
  const history = historyLog
    .filter(item => item.vehicleId === activeId)
    .slice(0, 10) // Mostrar últimas 10 en layout web
    .reverse(); // Historial cronológico de izquierda a derecha

  // 4. Render Chart.js
  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = history.map(item => new Date(item.timestamp).toLocaleTimeString());
    const speeds = history.map(item => item.speed);
    const fuels = history.map(item => item.fuelLevel);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Velocidad (km/h)',
            data: speeds,
            borderColor: theme.color.primary,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'ySpeed',
          },
          {
            label: 'Combustible (L)',
            data: fuels,
            borderColor: theme.color.warning,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'yFuel',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: theme.text.primary, font: { family: 'system-ui' } }
          }
        },
        scales: {
          x: {
            ticks: { color: theme.text.muted },
            grid: { color: theme.border }
          },
          ySpeed: {
            type: 'linear',
            position: 'left',
            ticks: { color: theme.color.primary },
            grid: { color: theme.border },
            title: { display: true, text: 'Velocidad (km/h)', color: theme.color.primary }
          },
          yFuel: {
            type: 'linear',
            position: 'right',
            ticks: { color: theme.color.warning },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Combustible (L)', color: theme.color.warning }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [history]);

  // 5. Bi-directional map communications
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SELECT_VEHICLE') {
          selectVehicle(data.vehicleId);
        }
      } catch (e) {
        // Ignorar otros mensajes
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [selectVehicle]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'UPDATE', vehicles, selectedId }),
        '*'
      );
    }
  }, [vehicles, selectedId]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.contentContainer}>
      {/* 1. Header / Stats Row */}
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

      {/* 2. Interactive Map Container */}
      <View style={s.mapWrapper}>
        <Text style={s.sectionTitle}>🗺️ Mapa de Operación Realtime</Text>
        <View style={s.mapContainer}>
          <iframe
            ref={iframeRef}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
            srcDoc={mapHtml}
            onLoad={() => {
              if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  JSON.stringify({ type: 'UPDATE', vehicles, selectedId }),
                  '*'
                );
              }
            }}
          />
        </View>
      </View>

      {/* 3. Recent History Chart Container */}
      <View style={s.chartWrapper}>
        <Text style={s.sectionTitle}>📈 Histórico Reciente: {activeId || 'Ninguno'}</Text>
        <View style={s.chartCard}>
          {history.length === 0 ? (
            <View style={s.center}>
              <Text style={s.noData}>No hay datos históricos disponibles.</Text>
            </View>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '240px' }}>
              <canvas ref={canvasRef} />
            </div>
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
  contentContainer: { padding: 14, gap: 16 },
  
  // Stats row
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

  // Sections
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.text.primary, marginBottom: 8 },
  
  // Map card
  mapWrapper: {},
  mapContainer: {
    height: 300,
    backgroundColor: theme.bg.secondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden',
  },

  // Chart card
  chartWrapper: {},
  chartCard: {
    height: 272,
    backgroundColor: theme.bg.secondary,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.border,
    padding: 14,
  },

  // Alerts card
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
  noData: { color: theme.text.muted, fontSize: 12 },
});
