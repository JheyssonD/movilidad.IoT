# Simon Movilidad — Aplicación Móvil (React Native / Expo)

Réplica del dashboard IoT de monitoreo de flotas vehiculares para dispositivos móviles.

> [!NOTE]
> **Sobre vulnerabilidades de npm audit:** Al instalar se reportan 8 vulnerabilidades (2 moderate, 6 high) en `node-tar ≤ 7.5.10`, una dependencia **transitiva interna de Expo SDK 52** (`expo → @expo/cli → cacache → tar`). Estas afectan únicamente al proceso de instalación de paquetes en la máquina de desarrollo, **no al código de la app ni al dispositivo final**. El fix requeriría saltar a Expo SDK 56, que es incompatible con RN 0.76. Las deprecation warnings de `@babel/plugin-proposal-*` son igualmente transitorias del toolchain de Babel de React Native.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React Native + Expo SDK 52 |
| Navegación | React Navigation v6 (Bottom Tabs) |
| Estado Global | Context API (Auth + Telemetría) |
| Mapas | Google Maps nativo (`react-native-maps`) |
| Tiempo Real | SignalR (`@microsoft/signalr`) |
| Persistencia Offline | AsyncStorage |
| Notificaciones | `expo-notifications` (locales) |

## Pantallas

| Tab | Acceso | Descripción |
|---|---|---|
| 🗺️ Mapa | Todos | Google Maps dark con pines vehiculares en tiempo real |
| 🚌 Flota | Todos | Lista de vehículos con barras de combustible y dot pulsante |
| ⚠️ Alertas | Solo Admin | Feed cronológico de alertas de autonomía crítica |
| 👤 Perfil | Todos | Estado del sistema, credenciales y cierre de sesión |

## Instalación y Ejecución

### 1. Instalar dependencias

```bash
cd Mobile
npm install --legacy-peer-deps
```

### 2. Configurar Google Maps API Key

Edita `app.json` y reemplaza `YOUR_GOOGLE_MAPS_API_KEY` con tu API Key de Google Maps Platform (debe tener habilitada **Maps SDK for Android** y/o **Maps SDK for iOS**).

> **Nota:** Para pruebas con Expo Go, el mapa requiere una API Key válida en `app.json`.

### 3. Configurar la URL del backend

Edita `src/config.ts`:

```ts
export const API_BASE_URL = 'http://TU_IP_LOCAL:5100';
```

> En emuladores Android usa `http://10.0.2.2:5100`. En dispositivo físico, usa la IP local de tu máquina (ej: `http://192.168.1.100:5100`).

### 4. Iniciar Expo

```bash
npm start
```

Escanea el código QR con **Expo Go** (disponible en Play Store y App Store).

## Credenciales de Prueba

| Rol | Email | Contraseña |
|---|---|---|
| Admin | admin@simon.com | Admin123! |
| Usuario | user@simon.com | User123! |

## Funcionalidades

- ✅ Autenticación JWT con sesión persistente (AsyncStorage)
- ✅ Mapa en tiempo real con pines vehiculares (Google Maps dark)
- ✅ Lista de flota con barras de combustible y dot pulsante (alertas críticas)
- ✅ Sincronización offline: fallback automático a datos cacheados
- ✅ Notificaciones push locales al detectar combustible crítico
- ✅ Centro de alertas predictivas (solo Admin)
- ✅ Badge dinámico en tab de alertas
- ✅ Enmascarado de IDs para usuarios no-admin (DEV-\*\*\*\*-XC54)
