# 🚀 Guía de Implementación de WebSockets/SignalR para Mensajes en Tiempo Real

## 📋 Índice
1. [Resumen de Complejidad](#resumen-de-complejidad)
2. [Opción 1: SignalR (Recomendado para .NET)](#opción-1-signalr)
3. [Opción 2: WebSockets Nativos](#opción-2-websockets-nativos)
4. [Instalación](#instalación)
5. [Configuración del Backend](#configuración-del-backend)
6. [Implementación Frontend](#implementación-frontend)
7. [Testing](#testing)

---

## 📊 Resumen de Complejidad

### Dificultad: **Media** ⭐⭐⭐☆☆

| Aspecto | Dificultad | Tiempo Estimado |
|---------|-----------|-----------------|
| Instalación de dependencias | ⭐☆☆☆☆ | 5 min |
| Configuración básica | ⭐⭐☆☆☆ | 30 min |
| Integración con componentes | ⭐⭐⭐☆☆ | 1-2 horas |
| Manejo de reconexiones | ⭐⭐⭐☆☆ | 1 hora |
| Testing y debugging | ⭐⭐⭐⭐☆ | 2-3 horas |
| **TOTAL** | **⭐⭐⭐☆☆** | **5-7 horas** |

---

## 🎯 Opción 1: SignalR (Recomendado para .NET)

### ✅ Ventajas
- ✅ Integración nativa con .NET
- ✅ Reconexión automática
- ✅ Fallback a Long Polling si WebSockets no está disponible
- ✅ Tipado fuerte
- ✅ Manejo de grupos y salas
- ✅ Escalabilidad con Azure SignalR Service

### ❌ Desventajas
- ❌ Dependencia específica de Microsoft
- ❌ Tamaño del bundle (~100KB)
- ❌ Curva de aprendizaje moderada

---

## 📦 Instalación

### 1. Instalar SignalR Client

\`\`\`bash
npm install @microsoft/signalr
\`\`\`

### 2. Verificar instalación

\`\`\`bash
npm list @microsoft/signalr
\`\`\`

---

## 🔧 Configuración del Backend (.NET)

### 1. Instalar paquete NuGet

\`\`\`bash
dotnet add package Microsoft.AspNetCore.SignalR
\`\`\`

### 2. Crear el Hub de Chat

\`\`\`csharp
// Hubs/ChatHub.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace YourApp.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IMessageService _messageService;
        
        public ChatHub(IMessageService messageService)
        {
            _messageService = messageService;
        }

        // Método para enviar mensaje
        public async Task SendMessage(string receiverId, string content)
        {
            var senderId = Context.UserIdentifier; // ID del usuario autenticado
            
            // Guardar mensaje en la base de datos
            var message = await _messageService.CreateMessageAsync(senderId, receiverId, content);
            
            // Enviar al receptor
            await Clients.User(receiverId).SendAsync("ReceiveMessage", message);
            
            // Confirmar al emisor
            await Clients.Caller.SendAsync("ReceiveMessage", message);
        }

        // Método para indicador de escritura
        public async Task SendTypingIndicator(string receiverId, bool isTyping)
        {
            var senderId = Context.UserIdentifier;
            var senderName = Context.User?.Identity?.Name ?? "Usuario";
            
            await Clients.User(receiverId).SendAsync("TypingIndicator", senderId, senderName, isTyping);
        }

        // Método para marcar mensaje como leído
        public async Task MarkMessageAsRead(string messageId)
        {
            var userId = Context.UserIdentifier;
            await _messageService.MarkAsReadAsync(messageId, userId);
            
            // Notificar al emisor que el mensaje fue leído
            var message = await _messageService.GetMessageByIdAsync(messageId);
            await Clients.User(message.SenderId).SendAsync("MessageRead", messageId, userId);
        }

        // Unirse a una conversación (opcional, para salas)
        public async Task JoinConversation(string otherUserId)
        {
            var conversationId = GetConversationId(Context.UserIdentifier, otherUserId);
            await Groups.AddToGroupAsync(Context.ConnectionId, conversationId);
        }

        // Salir de una conversación
        public async Task LeaveConversation(string otherUserId)
        {
            var conversationId = GetConversationId(Context.UserIdentifier, otherUserId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationId);
        }

        // Eventos de conexión
        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;
            await Clients.Others.SendAsync("UserOnlineStatus", userId, true);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.UserIdentifier;
            await Clients.Others.SendAsync("UserOnlineStatus", userId, false);
            await base.OnDisconnectedAsync(exception);
        }

        private string GetConversationId(string userId1, string userId2)
        {
            // Crear un ID único para la conversación (ordenado alfabéticamente)
            var ids = new[] { userId1, userId2 }.OrderBy(x => x).ToArray();
            return $"conversation_{ids[0]}_{ids[1]}";
        }
    }
}
\`\`\`

### 3. Configurar en Program.cs

\`\`\`csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

// Agregar SignalR
builder.Services.AddSignalR();

// Configurar CORS para SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200") // URL de tu frontend
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // IMPORTANTE para SignalR
    });
});

var app = builder.Build();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Mapear el hub
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
\`\`\`

### 4. Configurar autenticación con JWT

\`\`\`csharp
// En Program.cs, después de AddSignalR()
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
        };

        // IMPORTANTE: Configurar para SignalR
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                
                return Task.CompletedTask;
            }
        };
    });
\`\`\`

---

## 💻 Implementación Frontend

### 1. Servicio SignalR (Ya creado)

El archivo `src/app/core/realtime/signalr.service.ts` ya está creado con todas las funcionalidades.

### 2. Actualizar MessagesPage

\`\`\`typescript
// src/app/features/private/messages/messages.page.ts
import { SignalRService } from '../../../core/realtime/signalr.service';

export class MessagesPage {
  private readonly signalR = inject(SignalRService);
  readonly typingUsers = signal<Set<string>>(new Set());
  readonly isConnected = this.signalR.isConnected;

  constructor() {
    void this.loadConversations();
    void this.initializeSignalR();
  }

  private async initializeSignalR(): Promise<void> {
    try {
      await this.signalR.startConnection();

      // Suscribirse a mensajes
      this.signalR.onMessageReceived.subscribe((message) => {
        this.handleIncomingMessage(message);
      });

      // Suscribirse a indicadores de escritura
      this.signalR.onTypingIndicator.subscribe((indicator) => {
        this.handleTypingIndicator(indicator);
      });
    } catch (error) {
      console.error('Error SignalR:', error);
    }
  }

  private handleIncomingMessage(message: MessageDto): void {
    // Agregar mensaje a la conversación actual
    const selectedUserId = this.selectedUserId();
    if (message.senderId === selectedUserId || message.receiverId === selectedUserId) {
      this.selectedConversation.update((messages) => [...messages, message]);
    }
    
    // Actualizar lista de conversaciones
    void this.loadConversations();
  }

  async sendMessage(): Promise<void> {
    const userId = this.selectedUserId();
    const content = this.messageForm.value.content;
    
    if (!userId || !content) return;

    try {
      // Enviar a través de SignalR (más rápido)
      await this.signalR.sendMessage(userId, content);
      this.messageForm.reset();
    } catch (error) {
      // Fallback a HTTP si SignalR falla
      await this.sendMessageViaHttp();
    }
  }

  onInputChange(): void {
    const userId = this.selectedUserId();
    if (userId) {
      void this.signalR.sendTypingIndicator(userId, true);
    }
  }
}
\`\`\`

### 3. Actualizar el template HTML

\`\`\`html
<!-- Indicador de conexión -->
<div class="connection-status">
  @if (isConnected()) {
    <span class="status-online">● En línea</span>
  } @else {
    <span class="status-offline">● Desconectado</span>
  }
</div>

<!-- Indicador de escritura -->
@if (isTyping()) {
  <div class="typing-indicator">
    <span>{{ selectedUserName() }} está escribiendo...</span>
  </div>
}

<!-- Input con evento de escritura -->
<input
  type="text"
  formControlName="content"
  (input)="onInputChange()"
  placeholder="Escribe un mensaje..."
/>
\`\`\`

### 4. Estilos para indicadores

\`\`\`scss
.connection-status {
  padding: 0.5rem;
  text-align: center;
  font-size: 0.75rem;
}

.status-online {
  color: #10b981;
}

.status-offline {
  color: #ef4444;
}

.typing-indicator {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
}
\`\`\`

---

## 🧪 Testing

### 1. Probar conexión

\`\`\`typescript
// En la consola del navegador
console.log('SignalR conectado:', signalRService.isConnected());
\`\`\`

### 2. Probar envío de mensajes

1. Abre dos navegadores con usuarios diferentes
2. Inicia una conversación
3. Envía un mensaje desde el navegador 1
4. Verifica que aparezca instantáneamente en el navegador 2

### 3. Probar indicador de escritura

1. Escribe en el input del navegador 1
2. Verifica que aparezca "Usuario está escribiendo..." en el navegador 2

### 4. Probar reconexión

1. Detén el backend
2. Verifica que el estado cambie a "Desconectado"
3. Reinicia el backend
4. Verifica que se reconecte automáticamente

---

## 🎯 Opción 2: WebSockets Nativos

Si prefieres no usar SignalR, puedes usar WebSockets nativos:

### Ventajas
- ✅ Sin dependencias externas
- ✅ Más ligero
- ✅ Control total

### Desventajas
- ❌ Sin reconexión automática
- ❌ Sin fallback a Long Polling
- ❌ Más código manual

### Implementación básica

\`\`\`typescript
// src/app/core/realtime/websocket.service.ts
export class WebSocketService {
  private ws: WebSocket | null = null;
  private readonly url = 'ws://localhost:5063/ws';

  connect(token: string): void {
    this.ws = new WebSocket(\`\${this.url}?token=\${token}\`);

    this.ws.onopen = () => {
      console.log('WebSocket conectado');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket cerrado');
      // Reconectar después de 5 segundos
      setTimeout(() => this.connect(token), 5000);
    };
  }

  sendMessage(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.ws?.close();
  }
}
\`\`\`

---

## 📊 Comparación Final

| Característica | SignalR | WebSockets Nativos |
|----------------|---------|-------------------|
| Facilidad de uso | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| Reconexión automática | ✅ | ❌ (manual) |
| Fallback | ✅ Long Polling | ❌ |
| Tamaño bundle | ~100KB | ~0KB |
| Tipado | ✅ | ⚠️ Parcial |
| Escalabilidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ |
| **Recomendación** | **✅ Para .NET** | Para casos simples |

---

## 🚀 Próximos Pasos

1. ✅ Instalar `@microsoft/signalr`
2. ✅ Configurar el Hub en el backend
3. ✅ Integrar el servicio SignalR en el frontend
4. ✅ Probar la funcionalidad
5. ⚠️ Implementar manejo de errores robusto
6. ⚠️ Agregar logs y monitoreo
7. ⚠️ Optimizar para producción

---

## 💡 Consejos Finales

1. **Empieza simple**: Implementa solo envío/recepción de mensajes primero
2. **Prueba localmente**: Usa dos navegadores para simular usuarios
3. **Maneja errores**: Siempre ten un fallback a HTTP
4. **Monitorea**: Agrega logs para debugging
5. **Optimiza**: Considera usar Azure SignalR Service en producción

---

## 📚 Recursos Adicionales

- [Documentación oficial de SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction)
- [SignalR JavaScript Client](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client)
- [Azure SignalR Service](https://azure.microsoft.com/en-us/services/signalr-service/)

---

**¿Necesitas ayuda?** Revisa los logs en la consola del navegador y en el backend para identificar problemas de conexión.
