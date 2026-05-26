# 📡 Implementación de SignalR para Mensajería en Tiempo Real

## 🎯 ¿Qué es SignalR?

SignalR es una librería de Microsoft que permite comunicación en tiempo real entre el servidor y los clientes usando WebSockets. En este proyecto, lo usamos para:

- ✉️ **Mensajes instantáneos** sin necesidad de refrescar la página
- ✍️ **Indicador de "está escribiendo"** en tiempo real
- 🟢 **Estado online/offline** de usuarios
- 🔄 **Reconexión automática** si se pierde la conexión

---

## 📦 Instalación

La librería de SignalR ya está instalada en el proyecto:

```bash
npm install @microsoft/signalr
```

---

## 🏗️ Arquitectura

### **Backend (.NET)**

```
Twitter/WebApi/Hubs/MessageHub.cs
├── OnConnectedAsync()      → Usuario se conecta
├── OnDisconnectedAsync()   → Usuario se desconecta
├── NotifyTyping()          → Usuario está escribiendo
└── NotifyStopTyping()      → Usuario dejó de escribir
```

### **Frontend (Angular)**

```
TwitterFront/src/app/core/realtime/
├── signalr.service.ts       → Servicio principal de SignalR
└── signalr.initializer.ts   → Inicializador automático

TwitterFront/src/app/features/messages/
├── messages-list.component.ts  → Lista de conversaciones
├── chat.component.ts           → Chat individual
└── messages-api.service.ts     → API HTTP de mensajes
```

---

## 🚀 Uso del Servicio de SignalR

### **1. Conectar al Hub**

```typescript
import { SignalRService } from '@core/realtime/signalr.service';

export class MyComponent {
    private readonly signalR = inject(SignalRService);

    async ngOnInit() {
        // Conectar al hub
        await this.signalR.startConnection();
    }

    async ngOnDestroy() {
        // Desconectar al salir
        await this.signalR.stopConnection();
    }
}
```

### **2. Escuchar Mensajes Nuevos**

```typescript
this.signalR.onMessageReceived
    .pipe(takeUntil(this.destroy$))
    .subscribe((message: MessageDto) => {
        console.log('Nuevo mensaje:', message);
        // Agregar a la lista de mensajes
        this.messages.push(message);
    });
```

### **3. Escuchar Estado Online/Offline**

```typescript
// Usuario en línea
this.signalR.onUserOnline
    .pipe(takeUntil(this.destroy$))
    .subscribe((userId: string) => {
        console.log('Usuario en línea:', userId);
        this.onlineUsers.add(userId);
    });

// Usuario fuera de línea
this.signalR.onUserOffline
    .pipe(takeUntil(this.destroy$))
    .subscribe((userId: string) => {
        console.log('Usuario fuera de línea:', userId);
        this.onlineUsers.delete(userId);
    });
```

### **4. Indicador de "Está Escribiendo"**

```typescript
// Escuchar cuando el otro usuario está escribiendo
this.signalR.onUserTyping
    .pipe(takeUntil(this.destroy$))
    .subscribe((userId: string) => {
        if (userId === this.otherUserId) {
            this.isTyping = true;
        }
    });

// Escuchar cuando dejó de escribir
this.signalR.onUserStopTyping
    .pipe(takeUntil(this.destroy$))
    .subscribe((userId: string) => {
        if (userId === this.otherUserId) {
            this.isTyping = false;
        }
    });

// Notificar que estás escribiendo
onInputChange() {
    this.signalR.notifyTyping(this.otherUserId);
    
    // Después de 2 segundos sin escribir, notificar que paraste
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
        this.signalR.notifyStopTyping(this.otherUserId);
    }, 2000);
}
```

### **5. Verificar Estado de Conexión**

```typescript
// Signal reactivo
const isConnected = this.signalR.isConnected();

// Método
if (this.signalR.isConnectionActive()) {
    console.log('Conectado a SignalR');
}

// Estado de la conexión
const state = this.signalR.getConnectionState();
// Posibles valores: Disconnected, Connecting, Connected, Reconnecting
```

---

## 🔄 Flujo de un Mensaje

```
1. Usuario A escribe un mensaje
   ↓
2. Frontend llama a messagesApi.sendMessage()
   ↓
3. Backend guarda el mensaje en la BD
   ↓
4. Backend busca si Usuario B está conectado
   ↓
5. Si está conectado, envía el mensaje vía SignalR
   ↓
6. Frontend de Usuario B recibe el evento "ReceiveMessage"
   ↓
7. Se muestra el mensaje instantáneamente
```

---

## 🎨 Componentes Creados

### **MessagesListComponent**

Muestra la lista de conversaciones con:
- ✅ Actualización en tiempo real de nuevos mensajes
- 🟢 Indicador de usuarios online
- 🔵 Badge de mensajes no leídos
- 🔔 Sonido de notificación

**Uso:**
```typescript
<app-messages-list></app-messages-list>
```

### **ChatComponent**

Chat individual con:
- ✅ Mensajes en tiempo real
- ✍️ Indicador de "está escribiendo"
- 🟢 Estado online del otro usuario
- ✓✓ Indicador de mensaje leído
- 📜 Scroll automático

**Uso:**
```typescript
// En las rutas
{
    path: 'messages/:userId',
    component: ChatComponent
}
```

---

## ⚙️ Configuración

### **Backend (appsettings.json)**

```json
{
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:4200",
      "http://localhost:5173"
    ]
  }
}
```

### **Frontend (environment.ts)**

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5063',
};
```

---

## 🔐 Autenticación

SignalR usa el mismo token JWT que las peticiones HTTP:

```typescript
.withUrl(`${environment.apiBaseUrl}/hubs/message`, {
    accessTokenFactory: () => token, // Token JWT
    withCredentials: true,
})
```

El backend valida el token con `[Authorize]` en el Hub.

---

## 🐛 Debugging

### **Ver logs de SignalR**

```typescript
.configureLogging(LogLevel.Debug) // Cambiar a Debug para más detalles
```

### **Verificar conexión**

```typescript
console.log('Estado:', this.signalR.getConnectionState());
console.log('Conectado:', this.signalR.isConnected());
```

### **Eventos de conexión**

El servicio ya registra automáticamente:
- ✅ Conexión exitosa
- 🔄 Reconectando
- ❌ Error de conexión
- 🔌 Desconectado

---

## 🚨 Problemas Comunes

### **1. Error de CORS**

**Síntoma:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Solución:** Verificar que el origen esté en la política de CORS del backend:

```csharp
// Program.cs
options.AddPolicy("SignalRPolicy", policy =>
{
    policy.WithOrigins("http://localhost:4200")
          .AllowAnyMethod()
          .AllowAnyHeader()
          .AllowCredentials(); // ⚠️ IMPORTANTE
});
```

### **2. No se conecta**

**Síntoma:** `SignalR: Error al conectar`

**Verificar:**
- ✅ El backend está corriendo
- ✅ La URL es correcta (`/hubs/message`)
- ✅ El token JWT es válido
- ✅ El usuario está autenticado

### **3. No recibe mensajes**

**Síntoma:** Los mensajes se guardan pero no llegan en tiempo real

**Verificar:**
- ✅ El usuario está conectado (`isConnected()`)
- ✅ Está suscrito al observable (`onMessageReceived`)
- ✅ El `userId` del receptor es correcto

### **4. Reconexión infinita**

**Síntoma:** Se desconecta y reconecta constantemente

**Solución:** Verificar que el token no haya expirado:

```typescript
// Renovar token antes de conectar
if (tokenExpired) {
    await this.authService.refreshToken();
}
await this.signalR.startConnection();
```

---

## 📊 Escalabilidad

### **Producción con múltiples servidores**

El diccionario estático de conexiones solo funciona en un servidor. Para múltiples servidores, usa **Redis**:

```csharp
// Program.cs
builder.Services.AddSignalR()
    .AddStackExchangeRedis(configuration.GetConnectionString("Redis"));
```

Esto permite que los mensajes se distribuyan entre todos los servidores.

---

## 🎯 Próximos Pasos

- [ ] Agregar notificaciones push cuando la app está en segundo plano
- [ ] Implementar grupos de chat (no solo 1 a 1)
- [ ] Agregar indicador de "visto por última vez"
- [ ] Implementar llamadas de voz/video con WebRTC
- [ ] Agregar cifrado end-to-end

---

## 📚 Recursos

- [Documentación oficial de SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction)
- [SignalR JavaScript Client](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client)
- [Angular + SignalR Tutorial](https://learn.microsoft.com/en-us/aspnet/core/tutorials/signalr-typescript-webpack)

---

## 🤝 Contribuir

Si encuentras bugs o tienes sugerencias, por favor:
1. Abre un issue
2. Describe el problema
3. Incluye logs y pasos para reproducir

---

**¡Disfruta de la mensajería en tiempo real! 🚀**
