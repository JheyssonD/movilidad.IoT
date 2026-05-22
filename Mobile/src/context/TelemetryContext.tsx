// ─── Context global de telemetría en tiempo real ───────────────────────────────
import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode
} from 'react';
import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL, SIGNALR_HUB_URL } from '../config';
import { useAuth } from './AuthContext';

export interface VehicleTelemetry {
  vehicleId:               string;
  latitude:                number;
  longitude:               number;
  speed:                   number;
  fuelLevel:               number;
  averageConsumptionPerHour: number;
  temperature:             number;
  timestamp:               string;
  city?:                   string;
  pending?:                boolean;
}

export interface ActiveAlert {
  id:        string;
  vehicleId: string;
  message:   string;
  timestamp: Date;
}

interface TelemetryContextType {
  vehicles:     VehicleTelemetry[];
  alerts:       ActiveAlert[];
  isConnected:  boolean;
  isOffline:    boolean;
  selectVehicle: (id: string) => void;
  selectedId:   string | null;
  historyLog:   VehicleTelemetry[];
}

const TelemetryContext = createContext<TelemetryContextType | null>(null);
const CACHE_KEY = 'simon_telemetry_cache';
const MAX_ALERTS = 20;

function maskId(id: string): string {
  const parts = id.split('-');
  if (parts.length >= 3) { parts[1] = '****'; return parts.join('-'); }
  return id.length > 4 ? id.substring(0, 4) + '****' : '****';
}

function normalizePayload(raw: Record<string, unknown>): VehicleTelemetry | null {
  const vehicleId = (raw['vehicleId'] ?? raw['VehicleId']) as string;
  const lat = Number(raw['latitude'] ?? raw['Latitude']);
  const lng = Number(raw['longitude'] ?? raw['Longitude']);
  if (!vehicleId || isNaN(lat) || isNaN(lng)) return null;
  return {
    vehicleId,
    latitude:                  lat,
    longitude:                 lng,
    speed:                     Number(raw['speed'] ?? raw['Speed'] ?? 0),
    fuelLevel:                 Number(raw['fuelLevel'] ?? raw['FuelLevel'] ?? 0),
    averageConsumptionPerHour: Math.max(0.1, Number(raw['averageConsumptionPerHour'] ?? raw['AverageConsumptionPerHour'] ?? 6.5)),
    temperature:               Number(raw['temperature'] ?? raw['Temperature'] ?? 0),
    timestamp:                 String(raw['timestamp'] ?? raw['Timestamp'] ?? new Date().toISOString()),
  };
}

function isCritical(v: VehicleTelemetry): boolean {
  return v.averageConsumptionPerHour > 0 && v.fuelLevel / v.averageConsumptionPerHour < 1.0;
}

async function sendLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.warn("Local notification skipped or unsupported:", e);
  }
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleTelemetry[]>([]);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyLog, setHistoryLog] = useState<VehicleTelemetry[]>([]);
  const criticalSet = useRef<Set<string>>(new Set());
  const hubRef = useRef<signalR.HubConnection | null>(null);

  // ── Cargar datos HTTP + caché offline ──────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/telemetry/history`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error('HTTP error');
      const data: VehicleTelemetry[] = await res.json();
      // Normalizar (API devuelve PascalCase o camelCase)
      const normalized = data
        .map(d => normalizePayload(d as unknown as Record<string, unknown>))
        .filter(Boolean) as VehicleTelemetry[];
      
      const fullHistory = user.role === 'Admin' ? normalized : normalized.map(v => ({ ...v, vehicleId: maskId(v.vehicleId) }));
      setHistoryLog(fullHistory);
      await AsyncStorage.setItem('simon_history_cache', JSON.stringify(fullHistory));

      // Un vehículo por ID (más reciente)
      const map = new Map<string, VehicleTelemetry>();
      normalized.forEach(v => {
        const prev = map.get(v.vehicleId);
        if (!prev || new Date(v.timestamp) >= new Date(prev.timestamp)) map.set(v.vehicleId, v);
      });
      const list = Array.from(map.values());
      // Enmascarar IDs para usuarios no-admin
      const masked = user.role === 'Admin' ? list : list.map(v => ({ ...v, vehicleId: maskId(v.vehicleId) }));
      setVehicles(masked);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(masked));
      setIsOffline(false);
      if (!selectedId && masked.length > 0) setSelectedId(masked[0].vehicleId);
    } catch {
      // Fallback a caché offline
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: VehicleTelemetry[] = JSON.parse(raw);
        setVehicles(cached);
        setIsOffline(true);
      }
      const rawHistory = await AsyncStorage.getItem('simon_history_cache');
      if (rawHistory) {
        const cachedHistory: VehicleTelemetry[] = JSON.parse(rawHistory);
        setHistoryLog(cachedHistory);
      }
    }
  }, [user, selectedId]);

  // ── SignalR ─────────────────────────────────────────────────────────────────
  const startSignalR = useCallback(async () => {
    if (!user || hubRef.current) return;
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${SIGNALR_HUB_URL}?access_token=${user.token}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hub.on('ReceiveTelemetry', (data: Record<string, unknown>) => {
      const t = normalizePayload(data);
      if (!t) return;
      const display = user.role === 'Admin' ? t : { ...t, vehicleId: maskId(t.vehicleId) };

      setVehicles(prev => {
        const idx = prev.findIndex(v => v.vehicleId === display.vehicleId);
        return idx > -1
          ? [...prev.slice(0, idx), display, ...prev.slice(idx + 1)]
          : [display, ...prev];
      });

      setHistoryLog(prev => {
        const exists = prev.some(item => item.vehicleId === display.vehicleId && item.timestamp === display.timestamp);
        if (exists) return prev;
        return [display, ...prev].slice(0, 500); // Límite razonable de 500 registros
      });

      // Alerta de combustible (transición)
      if (isCritical(t)) {
        if (!criticalSet.current.has(t.vehicleId)) {
          criticalSet.current.add(t.vehicleId);
          void sendLocalNotification('⚠️ Combustible crítico', `${t.vehicleId}: autonomía < 1 h`);
          if (user.role === 'Admin') {
            const entry: ActiveAlert = {
              id: `${Date.now()}-${t.vehicleId}`,
              vehicleId: t.vehicleId,
              message: `Combustible crítico (${(t.fuelLevel / t.averageConsumptionPerHour).toFixed(2)} h autonomía) — ${t.vehicleId}`,
              timestamp: new Date(),
            };
            setAlerts(prev => [entry, ...prev].slice(0, MAX_ALERTS));
          }
        }
      } else {
        criticalSet.current.delete(t.vehicleId);
      }
    });

    hub.on('ReceiveAlert', (data: Record<string, unknown>) => {
      if (user.role !== 'Admin') return;
      const vehicleId = (data['vehicleId'] ?? data['VehicleId'] ?? '') as string;
      const message   = (data['message']   ?? data['Message']   ?? 'Alerta crítica') as string;
      const entry: ActiveAlert = {
        id: `${Date.now()}-${Math.random()}`,
        vehicleId,
        message,
        timestamp: new Date(),
      };
      setAlerts(prev => [entry, ...prev].slice(0, MAX_ALERTS));
      void sendLocalNotification('🚨 Alerta predictiva', message);
    });

    hub.onreconnected(() => setIsConnected(true));
    hub.onclose(() => setIsConnected(false));

    try {
      await hub.start();
      setIsConnected(true);
      hubRef.current = hub;
    } catch {
      setIsConnected(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Permisos de notificaciones (resguardado contra limitaciones de Expo Go)
    try {
      void Notifications.requestPermissionsAsync().catch(() => {});
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (e) {
      console.warn("Notifications setup is limited or unsupported in this environment:", e);
    }
    void loadHistory();
    void startSignalR();
    return () => {
      hubRef.current?.stop().catch(() => {});
      hubRef.current = null;
    };
  }, [user]);

  const selectVehicle = useCallback((id: string) => setSelectedId(id), []);

  return (
    <TelemetryContext.Provider value={{ vehicles, alerts, isConnected, isOffline, selectedId, selectVehicle, historyLog }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider');
  return ctx;
}
