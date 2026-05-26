# 🚀 GUÍA RÁPIDA: Cómo Probar el Chat

## ✅ **PASO 1: Instalar la Librería de SignalR**

Abre una terminal **CMD** o **Git Bash** (NO PowerShell) y ejecuta:

```bash
cd TwitterFront
npm install @microsoft/signalr
```

---

## ✅ **PASO 2: Iniciar el Backend**

Abre una terminal y ejecuta:

```bash
cd Twitter/WebApi
dotnet run
```

Deberías ver:
```
✅ Now listening on: http://localhost:5063
```

---

## ✅ **PASO 3: Iniciar el Frontend**

Abre **OTRA** terminal y ejecuta:

```bash
cd TwitterFront
npm run start:dev
```

Deberías ver:
```
✅ Local: http://localhost:4200/
```

---

## 🎯 **FLUJO PARA INICIAR UNA CONVERSACIÓN**

### **Opción 1: Desde la Página de "Personas"** (Más Fácil)

```
1. Abre el navegador en http://localhost:4200
   ↓
2. Inicia sesión con el Usuario A
   ↓
3. Ve a la página "Personas" (en el menú)
   ↓
4. Verás una lista de usuarios
   ↓
5. Cada usuario tiene un botón "💬 Enviar mensaje"
   ↓
6. Haz clic en el botón de cualquier usuario
   ↓
7. ¡Se abre el chat! 🎉
```

### **Opción 2: Desde el Perfil de un Usuario**

```
1. Abre el navegador en http://localhost:4200
   ↓
2. Inicia sesión con el Usuario A
   ↓
3. Ve al perfil de otro usuario
   (Puedes hacer clic en su nombre desde el feed)
   ↓
4. En el perfil verás el botón "💬 Enviar mensaje"
   (Junto al botón de "Seguir")
   ↓
5. Haz clic en el botón
   ↓
6. ¡Se abre el chat! 🎉
```

---

## 💬 **PROBAR MENSAJERÍA EN TIEMPO REAL**

### **Paso 1: Abrir Dos Navegadores**

1. **Navegador 1:** Chrome normal
2. **Navegador 2:** Chrome en modo incógnito (Ctrl + Shift + N)

### **Paso 2: Iniciar Sesión con Usuarios Diferentes**

**Navegador 1:**
- Ve a `http://localhost:4200`
- Inicia sesión con **Usuario A** (ejemplo: `admin@admin.com`)

**Navegador 2:**
- Ve a `http://localhost:4200`
- Inicia sesión con **Usuario B** (ejemplo: `user@user.com`)

### **Paso 3: Iniciar Conversación**

**En el Navegador 1 (Usuario A):**
1. Ve a "Personas"
2. Busca al Usuario B
3. Haz clic en "💬 Enviar mensaje"
4. Se abre el chat

### **Paso 4: Enviar Mensaje**

**En el Navegador 1 (Usuario A):**
1. Escribe "Hola, ¿cómo estás?" en el input
2. Haz clic en "Enviar"

### **Paso 5: Ver el Mensaje en Tiempo Real**

**En el Navegador 2 (Usuario B):**
1. Ve a "Mensajes" (en el menú)
2. **¡Deberías ver el mensaje instantáneamente!** 🎉
3. Haz clic en la conversación
4. Responde "¡Muy bien, gracias!"

**En el Navegador 1 (Usuario A):**
- **¡Deberías ver la respuesta instantáneamente!** 🎉

---

## 🎨 **CÓMO SE VE**

### **Página de Personas:**

```
┌─────────────────────────────────────────────────┐
│  Personas                                       │
├─────────────────────────────────────────────────┤
│  👤 Juan Pérez                                  │
│     juan@example.com                            │
│     [Ver perfil] [💬 Enviar mensaje] [Detalles]│
├─────────────────────────────────────────────────┤
│  👤 María García                                │
│     maria@example.com                           │
│     [Ver perfil] [💬 Enviar mensaje] [Detalles]│
└─────────────────────────────────────────────────┘
```

### **Perfil de Usuario:**

```
┌─────────────────────────────────────────────────┐
│  👤 Juan Pérez                                  │
│     @juanperez · juan@example.com               │
│                                                 │
│  [Seguir] [💬 Enviar mensaje]                  │
└─────────────────────────────────────────────────┘
```

### **Chat:**

```
┌─────────────────────────────────────────────────┐
│  ← Volver   👤 Juan Pérez 🟢  En línea         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────┐                           │
│  │ Hola, ¿cómo     │                           │
│  │ estás?          │                           │
│  │         10:30 ✓ │                           │
│  └─────────────────┘                           │
│                                                 │
│                   ┌─────────────────┐          │
│                   │ Muy bien,       │          │
│                   │ gracias         │          │
│                   │ 10:31 ✓✓        │          │
│                   └─────────────────┘          │
│                                                 │
│  ✍️ Juan está escribiendo...                   │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Escribe un mensaje...]     [Enviar]          │
└─────────────────────────────────────────────────┘
```

---

## 🔍 **VERIFICAR QUE SIGNALR ESTÁ FUNCIONANDO**

### **En la Consola del Navegador (F12):**

Deberías ver estos logs:

```
🚀 Inicializando SignalR...
🔄 SignalR: Iniciando conexión...
✅ SignalR: Conectado exitosamente al hub de mensajes
✅ SignalR inicializado correctamente
```

Si ves estos mensajes, **¡SignalR está funcionando!** ✅

### **Al Enviar un Mensaje:**

```
📩 SignalR: Mensaje recibido {messageId: "...", content: "Hola"}
```

---

## 🎯 **FUNCIONALIDADES QUE PUEDES PROBAR**

### ✅ **1. Mensajes en Tiempo Real**
- Envía un mensaje desde Usuario A
- Debería aparecer instantáneamente en Usuario B

### ✅ **2. Indicador "Está Escribiendo"**
- Empieza a escribir en Usuario A (sin enviar)
- En Usuario B debería aparecer "Usuario A está escribiendo..."

### ✅ **3. Estado Online/Offline**
- Cierra el navegador de Usuario A
- En Usuario B debería aparecer como "Desconectado"

### ✅ **4. Indicador de Leído**
- Usuario A envía un mensaje (verás ✓)
- Usuario B abre la conversación
- En Usuario A el mensaje cambia a ✓✓ (leído)

### ✅ **5. Sonido de Notificación**
- Cuando recibes un mensaje, debería sonar una notificación
- (Si no suena, es porque el navegador bloquea el audio automático)

---

## 🐛 **PROBLEMAS COMUNES**

### **❌ "Cannot find module '@microsoft/signalr'"**

**Solución:**
```bash
cd TwitterFront
npm install @microsoft/signalr
```

---

### **❌ "SignalR: No hay token de autenticación"**

**Solución:**
1. Cierra sesión
2. Vuelve a iniciar sesión
3. Recarga la página

---

### **❌ "Error al conectar a SignalR"**

**Solución:**
1. Verifica que el backend esté corriendo en `http://localhost:5063`
2. Verifica que no haya errores en la terminal del backend
3. Revisa la consola del navegador (F12) para ver el error exacto

---

### **❌ Los mensajes se guardan pero no llegan en tiempo real**

**Solución:**
1. Abre la consola del navegador (F12)
2. Verifica que diga "Conectado exitosamente"
3. Si no está conectado, recarga la página
4. Verifica que el backend esté corriendo

---

### **❌ El botón "Enviar mensaje" no aparece**

**Solución:**
1. Verifica que estés viendo el perfil de **otro usuario** (no el tuyo)
2. Recarga la página
3. Verifica que el componente esté importado correctamente

---

## 📊 **RESUMEN DEL FLUJO**

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                        │
└─────────────────────────────────────────────────────────┘

1. Usuario A va a "Personas"
   ↓
2. Hace clic en "💬 Enviar mensaje" de Usuario B
   ↓
3. Se abre el chat (vacío si no hay mensajes)
   ↓
4. Usuario A escribe "Hola"
   ↓
5. Usuario B ve "Usuario A está escribiendo..."
   ↓
6. Usuario A envía el mensaje
   ↓
7. El mensaje se guarda en la BD
   ↓
8. SignalR envía el mensaje a Usuario B
   ↓
9. Usuario B ve el mensaje instantáneamente
   ↓
10. Usuario B responde
   ↓
11. Usuario A ve la respuesta instantáneamente
   ↓
12. ¡Conversación en tiempo real! 🎉
```

---

## 🎉 **¡LISTO PARA PROBAR!**

Ahora tienes todo configurado para probar el chat en tiempo real. Sigue los pasos y disfruta de la mensajería instantánea.

**¿Tienes problemas?** Revisa la sección de "Problemas Comunes" o consulta los archivos de documentación:
- `SIGNALR_IMPLEMENTATION.md` - Documentación completa
- `SIGNALR_SUMMARY.md` - Resumen ejecutivo
- `INSTALL_SIGNALR.md` - Guía de instalación
- `SIGNALR_ARCHITECTURE.md` - Diagramas de arquitectura

---

**¡Disfruta del chat en tiempo real! 💬🚀**
