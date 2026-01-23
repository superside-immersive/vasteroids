# Cvent QR Scanner - Demo

Aplicación web para escanear códigos QR de badges de eventos Cvent y mostrar información del asistente.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                               │
│  - Layout con 4 tabs: Escáner, QR Prueba, Historial, Config     │
│  - CDN: html5-qrcode (scanner) + qrcodejs (generator)           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                           app.js                                 │
│  - Controlador principal                                         │
│  - Maneja cámara, UI, tabs, eventos                             │
│  - Orquesta parser → service → storage                          │
└─────────────────────────────────────────────────────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  qr-parser.js │    │  mock-service.js │    │   storage.js    │
│               │    │                  │    │                 │
│ Detecta y     │    │ Simula API       │    │ localStorage    │
│ parsea 4      │    │ BadgeKit con     │    │ para historial  │
│ formatos QR   │    │ datos latinos    │    │ y settings      │
│ de Cvent      │    │ aleatorios       │    │                 │
└───────────────┘    └──────────────────┘    └─────────────────┘
```

## 📁 Estructura de Archivos

```
cvent demo/
├── index.html       # UI principal con 4 secciones
├── styles.css       # Estilos responsive mobile-first
├── app.js           # Lógica principal y controlador
├── qr-parser.js     # Parser de los 4 formatos QR de Cvent
├── mock-service.js  # Simulador de API con datos ficticios
├── storage.js       # Persistencia en localStorage
└── README.md        # Este archivo
```

## 🔍 Formatos QR Soportados (qr-parser.js)

Cvent usa 4 formatos de QR en sus badges:

### 1. MeCard
```
MECARD:CONF:2WBCTIXLFURQT;N:García,María;TEL:+54111234;EMAIL:maria@email.com;TITLE:Director;ORG:TechCorp;;
```
- `CONF:` = Reference ID
- `N:` = Apellido,Nombre
- `ORG:` = Empresa

### 2. Delimitado (separadores: ^ * % |)
```
J3NHHSZN2VK^Juan^Pérez^juan@email.com^Director^TechCorp^BuenosAires^^1425^+5411234
```
Orden: RefID^Nombre^Apellido^Email^Título^Empresa^Ciudad^Estado^ZIP^Teléfono

### 3. Solo Email
```
maria.garcia@empresa.com
```
Se usa el email como referenceId para lookup en API.

### 4. Solo Reference ID
```
2WBCTIXLFURQT
```
Código alfanumérico de 5-20 caracteres.

## 🔄 Flujo de Escaneo

```
1. Usuario presiona "Iniciar Escaneo"
   └── app.js → Html5Qrcode.start()

2. Cámara detecta QR
   └── onScanSuccess(decodedText)

3. Parser analiza el texto
   └── QRParser.parse(decodedText)
   └── Retorna: { format, referenceId, firstName, lastName, email, company, title }

4. Lookup de asistente
   ├── Modo Demo: MockService.lookupAttendee()
   │   └── Genera datos ficticios basados en referenceId como seed
   └── Modo Real: callBadgeKitAPI()
       └── GET https://io.cvent.com/onsite/v1/events/{eventId}/exhibitors/{exhibitorId}/attendees/{refId}

5. Mostrar resultado
   └── showResult(attendee, parsedData)
   └── StorageService.addToHistory()
```

## ⚙️ Configuración (storage.js)

```javascript
// Estructura de settings en localStorage
{
  demoMode: true,          // true = usa MockService, false = usa API real
  eventId: "",             // ID del evento en Cvent
  exhibitorId: "",         // ID del expositor
  bearerToken: "",         // Token de autenticación
  region: "na"             // "na" = io.cvent.com, "eu" = io-eur.cvent.com
}
```

## 🌐 API Real de Cvent (BadgeKit)

Cuando `demoMode: false`, la app llama:

```
GET https://io.cvent.com/onsite/v1/events/{eventId}/exhibitors/{exhibitorId}/attendees/{referenceId}
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
```

Respuesta:
```json
{
  "firstName": "María",
  "lastName": "García",
  "email": "maria@empresa.com",
  "company": "TechCorp",
  "title": "Director",
  "workPhone": "+5411...",
  "customFields": [...]
}
```

**Requisitos para API real:**
- Credenciales de Account Manager de Cvent
- Evento con BadgeKit habilitado
- Asistentes con consentimiento de escaneo

## 🧪 QR de Prueba (mock-service.js)

La pestaña "QR de Prueba" genera códigos QR escaneables en los 4 formatos.
- Usa `MockService.generateTestQRData()` 
- Los datos son aleatorios pero consistentes (seeded random basado en referenceId)
- Nombres latinoamericanos realistas

## 📱 Ejecución

```bash
# Servidor local (Python)
cd "cvent demo"
python3 -m http.server 8080

# Abrir en navegador
http://localhost:8080

# Desde celular (misma red WiFi)
http://192.168.x.x:8080
```

## 🔧 Para Modificar

### Agregar nuevos campos al resultado
1. Editar `showResult()` en [app.js](app.js#L298)
2. Agregar elementos HTML en [index.html](index.html#L45-L60)

### Cambiar datos mock
1. Editar arrays en [mock-service.js](mock-service.js#L10-L45)
2. Modificar `generateAttendee()` para nuevos campos

### Soportar nuevo formato QR
1. Agregar método `isXxxFormat()` en [qr-parser.js](qr-parser.js)
2. Agregar método `parseXxx()` 
3. Actualizar `parse()` para detectar el nuevo formato

### Cambiar endpoint de API
1. Modificar `getAPIConfig()` en [storage.js](storage.js#L130)
2. Modificar `callBadgeKitAPI()` en [app.js](app.js#L265)

## 📋 Dependencias (CDN)

- **html5-qrcode v2.3.8**: Escaneo de QR via cámara WebRTC
- **qrcodejs v1.0.0**: Generación de QR para pruebas

## ⚠️ Notas Técnicas

- El acceso a cámara requiere HTTPS o localhost
- localStorage tiene límite ~5MB (suficiente para ~10k escaneos)
- El parser prioriza formatos específicos (MeCard > Delimitado > Email > RefID)
- Token de Cvent expira en 1 hora, implementar refresh si es necesario
