# **Sistema IoT de Monitoreo de Flotas Vehiculares**
*Simon Movilidad — Prueba Técnica Full Stack*

Este repositorio contiene la solución completa para el monitoreo en tiempo real, análisis predictivo de combustible, alertas y soporte offline de la flota vehicular de Simon Movilidad.

---

## 🚀 **Estructura del Proyecto**

La arquitectura del sistema sigue los principios de **Clean Architecture** y **Separation of Concerns**, organizada de la siguiente manera:

`
SimonMovilidad.IoT/
├── Backend/                    # ASP.NET Core 8 Web API
│   ├── src/
│   │   ├── SimonMovilidad.IoT.API/             # Capa de API y SignalR Realtime Hubs
│   │   ├── SimonMovilidad.IoT.Core/            # Capa de Dominio (Modelos e Interfaces)
│   │   └── SimonMovilidad.IoT.Infrastructure/  # Capa de Datos (SQLite, EF Core, Predicciones)
│   ├── tests/
│   │   └── SimonMovilidad.IoT.Tests/           # Pruebas Unitarias de Lógica Crítica (xUnit)
│   ├── SimonMovilidad.IoT.sln
│   └── Dockerfile
├── Frontend/                   # Angular 18 SPA (Web Dashboard con Soporte Offline)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # Dashboard, Login, Mapa Realtime, Alertas
│   │   │   ├── services/       # SignalR (Realtime), Offline (Dexie/IndexedDB)
│   │   │   └── ...
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml          # Orquestación de toda la plataforma
└── README.md
`

---

## 🛠️ **Tecnologías Principales**

### **Backend/API**
- **ASP.NET Core 8** (API REST robusta con middlewares personalizados)
- **EF Core** y **SQLite** (Base de datos local rápida y portátil)
- **SignalR** (Servicios de tiempo real bidireccionales con WebSockets)
- **JWT** (Autenticación y enrutamiento basado en roles de usuario/administrador)
- **xUnit** (Testing automatizado de encriptado, cálculo predictivo y enmascaramiento)

### **Frontend Web**
- **Angular 18** (Framework SPA con RxJS para flujos reactivos)
- **Leaflet** (Mapas interactivos para visualización GPS en tiempo real)
- **Chart.js** (Visualización interactiva de históricos de telemetría)
- **Dexie.js / IndexedDB** (Estrategia offline y sincronización robusta)
- **Angular Material** (Diseño moderno premium con soporte adaptativo y responsive)

### **Infraestructura**
- **Docker Compose** (Contenedorización lista para producción)
- **IoT Simulator** (Generación automatizada de telemetría de vehículos)

---

## 📋 **Instrucciones de Ejecución**

### **1. Ejecución con Docker Compose (Recomendado)**
Para levantar todo el ecosistema (Backend API + Simulador IoT + Web Dashboard) en un solo comando:
`ash
docker-compose up --build
`
Una vez levantado:
- **Web Dashboard:** Acceso en http://localhost:4200
- **Backend API:** Acceso en http://localhost:5000
- **Swagger Documentation:** Acceso en http://localhost:5000/swagger

### **2. Ejecución Local (Desarrollo)**

#### **Backend (ASP.NET Core 8)**
1. Navega a Backend/
2. Restaura y ejecuta la solución:
   `ash
   dotnet restore
   dotnet run --project src/SimonMovilidad.IoT.API
   `
3. Ejecutar pruebas unitarias:
   `ash
   dotnet test
   `

#### **Frontend (Angular 18)**
1. Navega a Frontend/
2. Instala las dependencias y corre el servidor de desarrollo:
   `ash
   npm install
   npm run start
   `
3. Abre http://localhost:4200 en tu navegador.

---

## 🔒 **Credenciales por Defecto para Pruebas**

El sistema precarga las siguientes cuentas con diferentes privilegios y niveles de visualización de datos:

| Rol | Usuario | Contraseña | Comportamiento en Dashboard |
| :--- | :--- | :--- | :--- |
| **Administrador** | dmin@simon.com | Admin123! | Visualiza alertas predictivas y los IDs reales de vehículos. |
| **Operador Estándar** | user@simon.com | User123! | Dashboard limitado. IDs de vehículos enmascarados (ej: DEV-****-XC54). |

---

## 📊 **Lógica Predictiva y Algoritmos Implementados**
- **Cálculo de Autonomía:**
  \text{remainingHours} = \frac{\text{fuelLevel}}{\text{averageConsumptionPerHour}}
- **Disparador de Alertas:** Si la autonomía es inferior a **1 hora**, el sistema emite automáticamente una alerta predictiva en tiempo real visible por el Administrador.
