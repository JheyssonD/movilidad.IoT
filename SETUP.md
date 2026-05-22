# Guía de Instalación y Despliegue (SETUP.md)

Este documento contiene las instrucciones necesarias para compilar, probar y desplegar el **Sistema IoT de Monitoreo de Flotas Vehiculares** tanto en modo de desarrollo local como mediante contenedores Docker.

---

## Prerrequisitos

Para ejecutar este sistema localmente de forma nativa, asegúrese de tener instalados los siguientes componentes:
1.  **Backend**: [.NET 8.0 SDK](https://dotnet.microsoft.com/es-es/download/dotnet/8.0)
2.  **Frontend**: [Node.js (versión 18 o superior)](https://nodejs.org/) y npm
3.  **Despliegue General**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (opcional, para despliegue automatizado en Compose)

> **Nota sobre puertos**: Los servicios están configurados en puertos no estándar para evitar conflictos con otros servicios comunes (IIS, Kestrel por defecto, Angular CLI por defecto):
> - Backend API: `http://localhost:5100`
> - Frontend SPA: `http://localhost:4220`

---

## 1. Credenciales de Acceso (Seeded Users)

Al inicializar la base de datos, se pre-siembran automáticamente dos cuentas de usuario con contraseñas seguras (BCrypt):

| Correo Electrónico | Contraseña | Rol Asignado | Características Visuales |
| :--- | :--- | :--- | :--- |
| **`admin@simon.com`** | `Admin123!` | **Admin** | Visualiza identificadores reales del vehículo y panel de alertas críticas (combustible < 10%). |
| **`user@simon.com`** | `User123!` | **User** | Visualiza identificadores vehiculares enmascarados y no tiene acceso a alertas administrativas. |

---

## 2. Despliegue Manual en Modo de Desarrollo (Verificado)

### Paso A: Levantar el Backend (.NET 8.0 Web API)

1.  Abra una terminal y desplácese a la carpeta del backend API:
    ```bash
    cd Backend/src/SimonMovilidad.IoT.API
    ```
2.  Defina la variable de entorno obligatoria para la seguridad JWT:
    *   **En PowerShell**:
        ```powershell
        $env:JWT_SECRET="SuperSecretSimonMovilidadKey2026SecureStringWithMoreBytes"
        ```
    *   **En CMD**:
        ```cmd
        set JWT_SECRET=SuperSecretSimonMovilidadKey2026SecureStringWithMoreBytes
        ```
    *   **En Bash/Mac/Linux**:
        ```bash
        export JWT_SECRET="SuperSecretSimonMovilidadKey2026SecureStringWithMoreBytes"
        ```
3.  Compile y ejecute el servidor Web API:
    ```bash
    dotnet run
    ```
    *El backend iniciará automáticamente en `http://localhost:5100`. Verá en consola el mensaje `Now listening on: http://localhost:5100` y el simulador IoT iniciará en segundo plano.*

4.  Verifique el health check del backend (opcional):
    ```
    GET http://localhost:5100/health
    → {"status":"Healthy","time":"..."}
    ```

### Paso B: Levantar el Frontend (Angular 18 SPA)

1.  Abra una segunda terminal y navegue a la carpeta del cliente:
    ```bash
    cd Frontend
    ```
2.  Instale las dependencias:
    ```bash
    npm install
    ```
3.  Inicie el servidor de desarrollo:
    ```bash
    npm start
    ```
    *El servidor de Angular CLI compila e inicia la SPA en `http://localhost:4220` (puerto configurado explícitamente para evitar conflictos).*

4.  Abra su navegador e ingrese a:
    - **[http://localhost:4220](http://localhost:4220)**

### Paso C: Iniciar la Aplicación Móvil (React Native / Expo)

1.  Abra una tercera terminal y navegue a la carpeta del proyecto móvil:
    ```bash
    cd Mobile
    ```
2.  Instale las dependencias de node con compatibilidad heredada:
    ```bash
    npm install --legacy-peer-deps
    ```
3.  Configure la IP local del backend para la conexión en red local (Wifi):
    *   Abra el archivo [`src/config.ts`](file:///d:/Repositories/SimonMovilidad.IoT/Mobile/src/config.ts).
    *   Actualice la constante `API_BASE_URL` reemplazando `192.168.20.113` con la IP local actual de su computadora y el puerto `5100` (ejemplo: `http://192.168.1.100:5100`).
    *   *Tip para obtener tu IP local*:
        *   **En Windows**: Ejecuta `ipconfig` en la terminal y busca la `Dirección IPv4` de tu adaptador de red activo (ej: Ethernet o Wi-Fi).
        *   **En macOS / Linux**: Ejecuta `ifconfig` o `ip a` y busca tu dirección IP de red local.
    *   *Nota*: Si ejecutas en un emulador de Android (AVD) local en la misma computadora de desarrollo, puedes configurar `http://10.0.2.2:5100`.
4.  Inicie el servidor de desarrollo de Expo:
    ```bash
    npx expo start --lan
    ```
    *(Este comando fuerza la exposición del QR y los endpoints a la red local LAN para evitar bloqueos).*
5.  Prueba la aplicación usando una de estas **3 alternativas**:
    *   **Opción A (Celular Físico - Recomendado)**: Abre la cámara (en iOS) o la app **Expo Go** (en Android, descargable desde Google Play) y escanea el código QR de la terminal. Ambos dispositivos deben estar conectados a la misma red Wi-Fi.
    *   **Opción B (Emulador Local)**: Presiona `a` en la terminal para abrir la app en un emulador de Android, o `i` para abrirla en el simulador de iOS (requiere Xcode en macOS).
    *   **Opción C (Vista Web en Navegador)**: Presiona `w` en la terminal de Expo. La aplicación móvil se abrirá directamente en tu navegador web local (gracias a la compatibilidad multiplataforma implementada en `MapScreen.web.tsx`).
6.  **Credenciales rápidas para el inicio de sesión**:
    *   **Administrador**: `admin@simon.com` / `Admin123!` (Acceso a IDs reales y alertas críticas).
    *   **Operador**: `user@simon.com` / `User123!` (IDs enmascarados y privacidad operacional).

---

## 3. Despliegue Automatizado mediante Docker Compose

Esta modalidad empaqueta ambas aplicaciones en contenedores aislados y las orquesta con un único comando:

1.  Asegúrese de tener **Docker Desktop** corriendo.
2.  Abra una terminal en el directorio raíz del repositorio (`SimonMovilidad.IoT`).
3.  Ejecute la compilación e inicio:
    ```bash
    docker-compose up --build
    ```
4.  Una vez finalizado, acceda a los servicios:
    *   **Dashboard Frontend**: [http://localhost:4220](http://localhost:4220)
    *   **Backend REST API & SignalR**: [http://localhost:5100](http://localhost:5100)
    *   **Health check**: [http://localhost:5100/health](http://localhost:5100/health)
    *   **Swagger UI**: [http://localhost:5100/swagger](http://localhost:5100/swagger)

Para detener el entorno:
```bash
docker-compose down
```

---

## 4. Ejecución del Conjunto de Pruebas Unitarias (TDD)

El desarrollo se realizó bajo la metodología **Test-Driven Development (TDD)**.

### Pruebas del Backend (xUnit)
```bash
cd Backend
dotnet test
```
**Resultado esperado**: `Passed! - Failed: 0, Passed: 8, Skipped: 0`

Cubre:
- Validación manual del JWT (formato inválido, algoritmo `none`, firma incorrecta, token expirado)
- Verificación de Issuer/Audience
- Construcción de `ClaimsPrincipal` y `User.IsInRole("Admin")`
- Lógica predictiva de autonomía de combustible

### Pruebas del Frontend (Karma/Jasmine)
```bash
cd Frontend
npm test
```

Cubre:
- Estado inicial y validación del formulario de Login
- Persistencia y limpieza del caché IndexedDB (Dexie)
- Lectura de claims de rol desde `localStorage`
- Detección de eventos online/offline

---

## 5. Verificación de Funcionalidades en Tiempo Real

### En el Portal Web (Angular SPA)
Una vez que ambos servicios estén corriendo:

1. **Login Admin** → `admin@simon.com` / `Admin123!`
   - ✅ Mapa interactivo multi-ciudad con marcadores vehiculares activos.
   - ✅ Gráfico dinámico de Velocidad y Combustible.
   - ✅ Panel de alertas de combustible crítico (< 1h de autonomía).
   - ✅ IDs reales de vehículos visibles.

2. **Login User** → `user@simon.com` / `User123!`
   - ✅ Mapa idéntico, ocultación total de la tarjeta y alertas de baja autonomía.
   - ✅ IDs vehiculares enmascarados (ej: `DEV-****-XC54`).

3. **Modo Offline**
   - ✅ Desconecte la red — la SPA continúa mostrando datos del caché IndexedDB.
   - ✅ Al reconectarse, SignalR se restablece automáticamente.

### En la Aplicación Móvil (React Native / Expo)
Una vez que la aplicación esté corriendo en su dispositivo físico o emulador:

1. **Login Admin** → `admin@simon.com` / `Admin123!`
   - ✅ Mapa en Dark Mode con pines vehiculares posicionados en tiempo real.
   - ✅ Al hacer clic a un vehículo en el mapa o listado, el mapa se centra automáticamente y dibuja el gráfico dinámico nativo de telemetría de las últimas 10 mediciones.
   - ✅ Acceso total a la lista de flota con ID reales visibles.
   - ✅ Alertas en vivo y notificaciones nativas en el dispositivo al detectar combustible bajo.

2. **Login User** → `user@simon.com` / `User123!`
   - ✅ Acceso al mapa y listado de flota con IDs enmascarados (ej: `DEV-****-XC54`).
   - ✅ Ocultación automática de la tarjeta de baja autonomía para mantener la privacidad operacional.

3. **Modo Offline**
   - ✅ Al desactivar la red Wifi/datos móviles, la aplicación realiza un fallback transparente leyendo desde `AsyncStorage`, manteniendo visible el último estado de la flota y el histórico completo del gráfico de telemetría sin interrupciones.
