# Software Architecture & Design Document (DESIGN.md)

Este documento detalla las decisiones arquitectónicas, de seguridad y de diseño implementadas en el **Sistema IoT de Monitoreo de Flotas Vehiculares**.

---

## 1. Arquitectura General del Sistema

El sistema está estructurado bajo una arquitectura de **capas acopladas de manera suelta (Decoupled Layered Architecture)** y comunicación reactiva en tiempo real:

```
+---------------------------------------+
|            Angular 18 Client          | (Puerto Host: 4220)
|  - Leaflet Map (CartoDB Dark Tile)    |
|  - Chart.js (Real-time Analytics)     |
|  - Dexie.js (Offline Cache & Sync)    |
+-------------------+-------------------+
                    | (SignalR / REST API)
                    v
+-------------------+-------------------+
|          .NET 8.0 Web API             | (Puerto Host: 5100)
|  - TelemetryHub (SignalR Gateway)     |
|  - Core & Infrastructure Layers       |
|  - In-Process Telemetry Simulator     |
+---------------------------------------+
```

### Componentes Principales:
*   **Frontend (Angular 18 Standalone)**: Un cliente moderno desarrollado con la arquitectura modular y limpia de Angular, integrando componentes reactivos que procesan eventos en tiempo real.
*   **Backend (.NET 8 Web API)**: Una solución robusta estructurada en tres capas lógicas (`Core`, `Infrastructure`, `API`) siguiendo principios de diseño limpio y separación de responsabilidades.
*   **Simulador de Telemetría (In-Process Hosted Service)**: Diseñado como un `BackgroundService` en proceso que accede a los repositorios mediante scopes de servicio y emite telemetría directa hacia el Hub de SignalR, previniendo conflictos de sockets y colisiones de puertos en red.

---

## 2. Decisiones Arquitectónicas del Backend

### Estructura de Capas
1.  **Core**: Contiene los modelos de dominio (`Telemetry`, `User`) y las abstracciones del servicio (`IPredictionService`). Libre de dependencias externas para garantizar la portabilidad académica y empresarial.
2.  **Infrastructure**: Implementa la persistencia de datos mediante Entity Framework Core, inyecciones de dependencias, y el servicio de simulador de telemetría IoT (`TelemetrySimulator`).
3.  **API**: Define los controladores de acceso, Hubs de comunicación de SignalR (`TelemetryHub`), y middlewares de seguridad.

### Base de Datos e Inicialización
Se ha optado por el uso de una base de datos **InMemory** provista por Entity Framework Core. Esta decisión estratégica garantiza:
*   **Portabilidad absoluta**: El evaluador de la prueba técnica no requiere configurar motores de bases de datos locales (SQL Server, PostgreSQL, etc.) ni ejecutar migraciones manuales. El sistema es plug-and-play.
*   **Semillero Seguro (Database Seeding)**: Al iniciar, el contexto autoinicializa usuarios de prueba con contraseñas encriptadas mediante hashes seguros de **BCrypt**.

---

## 3. Arquitectura de Seguridad (JWT & BCrypt)

### Protección y Hashing de Contraseñas
Para cumplir con los estándares de seguridad modernos y evitar el riesgo de contraseñas planas en base de datos:
*   Se integró **BCrypt.Net-Next** para el hashing y verificación de credenciales.
*   El semillero genera hashes criptográficos de BCrypt para los usuarios preconfigurados.
*   El método de login compara las credenciales utilizando `BCrypt.Net.BCrypt.Verify(password, passwordHash)`.

### Middleware Manual de JWT (Cero Librerías Automáticas)
Para demostrar un dominio profundo del protocolo JWT y seguridad de bajo nivel, se desarrolló un validador de tokens de firma manual en `JwtMiddleware.cs` con medidas defensivas avanzadas contra exploits conocidos:

1.  **Mitigación de Algoritmo "None" (Algorithm None Attacks)**:
    El middleware decodifica la sección *Header* del token y valida explícitamente que la propiedad `"alg"` sea igual a `"HS256"`. Si un atacante altera el token declarando `"alg": "none"`, el middleware descarta el token inmediatamente.
2.  **Prevención de Ataques de Temporización (Timing Attacks)**:
    En lugar de utilizar una comparación de igualdad directa de strings (`==`) para verificar la firma, el middleware calcula el hash HMAC-SHA256 y utiliza `CryptographicOperations.FixedTimeEquals` para comparar los bytes de la firma entrante. Esto asegura un tiempo de ejecución constante que neutraliza cualquier intento de deducir firmas analizando la latencia de respuesta de la red.
3.  **Validación Temporal Avanzada**:
    Verifica manualmente los claims de expiración (`exp`) y de activación temprana (`nbf` - Not Before), protegiendo al sistema contra tokens expirados o de vigencia futura.
4.  **Validación de Emisor y Audiencia (Issuer & Audience)**:
    Garantiza que el token pertenezca estrictamente al dominio de la aplicación validando que `"iss"` sea `"SimonMovilidad"` y `"aud"` sea `"SimonMovilidadUsers"`.
5.  **Seguridad en Configuración (Zero Hardcoded Fallbacks)**:
    Se elimina por completo el uso de claves "fallback" quemadas en el código. Si la configuración `JWT_SECRET` se encuentra vacía o no es válida, la ejecución arroja excepciones de manera ruidosa y controlada, asegurando que un despliegue en producción nunca corra con configuraciones débiles.
6.  **Integración Enterprise con ClaimsPrincipal**:
    Una vez validado el token, el middleware construye un objeto estándar de .NET `ClaimsIdentity` y lo inyecta directamente al ciclo de vida del request como `context.User = new ClaimsPrincipal(identity)`. Esto habilita el uso nativo de directivas de autorización, como validaciones de roles `context.User.IsInRole("Admin")`.

---

## 4. Diseño y Decisiones del Frontend (Angular 18)

### Estilo Visual (Dark Premium UX/UI)
Diseñado siguiendo las mejores pautas estéticas contemporáneas para centros de control industrial y de monitoreo satelital:
*   **HSL Palette Curada**: Fondo oscuro profundo con elementos contrastantes en neón azul (`#3b82f6` para velocidad y activos) y neón naranja (`#f59e0b` para alertas y combustible).
*   **Glassmorphic Design**: Tarjetas translúcidas con desenfoque de fondo y bordes definidos que brindan una sensación de profundidad de pantalla premium.
*   **Pulsación de Alertas**: Las notificaciones urgentes e incidentes cuentan con un marcador dinámico rojo pulsante en Leaflet y barras deslizantes en CSS con efectos CSS Glow.

### Gestión de Estado y Modo Fuera de Línea (Dexie & IndexedDB)
*   **Offline First**: El sistema integra `Dexie.js` como wrapper eficiente sobre la API IndexedDB del navegador.
*   **Resiliencia de Red**: Ante la desconexión, la aplicación intercepta el cambio de estado a través de listeners nativos (`window.online`/`window.offline`), conmutando a lectura local de caché de manera transparente al usuario.
*   **Sincronización Silenciosa**: Al recuperar la conexión a internet, se refrescan las listas y se restablece la suscripción de SignalR automáticamente.

### Visualización Cartográfica e Interactividad (Leaflet & Chart.js)
*   **Leaflet Integration**: Utiliza capas de mapa oscuras provistas por *CartoDB Dark Matter* para reducir la fatiga visual del operador.
*   **Custom Map Pins**: En lugar de utilizar marcadores predeterminados pesados y estáticos, los pines vehiculares son generados mediante `divIcon` (código SVG ligero embebido), lo que elimina peticiones HTTP adicionales de imágenes y permite la actualización dinámica de rotación y colorización en base al estado del vehículo.
*   **Charts Dinámicos**: Implementa gráficos lineales duales para rastrear los niveles de velocidad y combustible históricos de las últimas 10 telemetrías del vehículo seleccionado.

---

## 5. Decisiones de Portabilidad y Despliegue

*   **Evitación de Conflictos de Puertos**: Los puertos estándar (`5000`, `8080`, `80`, `4200`) a menudo entran en conflicto con herramientas de bases de datos locales, servidores IIS u otros proyectos en desarrollo. Para evitar colisiones en la máquina del evaluador, se reconfiguraron los puertos por defecto a:
    *   **Backend Web API**: Expuesto en el puerto host **`5100`** (mapeado a `8080` internamente en Docker).
    *   **Frontend Angular**: Expuesto en el puerto host **`4220`** (mapeado a `80` internamente en Docker).
