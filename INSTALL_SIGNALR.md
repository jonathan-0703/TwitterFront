# 🚀 GUÍA DE INSTALACIÓN FINAL - SignalR

## ⚠️ PASO PENDIENTE: Instalar la librería de SignalR

Debido a un problema con PowerShell, no pude instalar automáticamente la librería de SignalR. Necesitas hacerlo manualmente:

---

## 📦 INSTALACIÓN

### **Opción 1: Usando npm (Recomendado)**

Abre una terminal **CMD** o **Git Bash** (NO PowerShell) en la carpeta del frontend:

```bash
cd TwitterFront
npm install @microsoft/signalr
```

### **Opción 2: Usando PowerShell (si tienes permisos)**

Si quieres usar PowerShell, primero habilita la ejecución de scripts:

```powershell
# Ejecutar como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Luego instalar
cd TwitterFront
npm install @microsoft/signalr
```

### **Opción 3: Agregar manualmente al package.json**

1. Abre `TwitterFront/package.json`
2. Agrega en la sección `dependencies`:
   ```json
   "@microsoft/signalr": "^8.0.0"
   ```
3. Ejecuta:
   ```bash
   npm install
   ```

---

## ✅ VERIFICAR INSTALACIÓN

Después de instalar, verifica que se instaló correctamente:

```bash
npm list @microsoft/signalr
```

Deberías ver algo como:
```
twitter@0.0.0
└── @microsoft/signalr@8.0.0
```

---

## 🧪 PROBAR LA IMPLEMENTACIÓN

### **1. Iniciar el Backend**

```bash
cd Twitter/WebApi
dotnet run
```

Deberías ver:
```
✅ Iniciando Twitter Web API
✅ Now listening on: http://localhost:5063
```

### **2. Iniciar el Frontend**

```bash
cd TwitterFront
npm run start:dev
```

Deberías ver:
```
✅ Application bundle generation complete.
✅ Local: http://localhost:4200/
```

### **3. Abrir el Navegador**

1. Abre **dos ventanas** del navegador (o una normal y una de incógnito)
2. Ve a `http://localhost:4200`
3. Inicia sesión con **dos usuarios diferentes**

### **4. Probar Mensajería en Tiempo Real**

#### **Prueba 1: Enviar Mensaje**
1. En la ventana del **Usuario A**, ve a Mensajes
2. Selecciona al **Usuario B**
3. Escribe un mensaje y envíalo
4. En la ventana del **Usuario B**, deberías ver el mensaje **instantáneamente** sin refrescar

#### **Prueba 2: Indicador de "Está Escribiendo"**
1. En la ventana del **Usuario A**, empieza a escribir (sin enviar)
2. En la ventana del **Usuario B**, deberías ver "Usuario A está escribiendo..."
3. Si dejas de escribir por 2 segundos, el indicador desaparece

#### **Prueba 3: Estado Online/Offline**
1. Cierra la ventana del **Usuario A**
2. En la ventana del **Usuario B**, deberías ver que Usuario A aparece como "Desconectado"
3. Vuelve a abrir la ventana del **Usuario A**
4. Deberías ver que aparece como "En línea" nuevamente

---

## 🔍 VERIFICAR CONEXIÓN DE SIGNALR

### **En el Frontend (Consola del Navegador)**

Abre las **DevTools** (F12) y ve a la pestaña **Console**. Deberías ver:

```
🚀 Inicializando SignalR...
🔄 SignalR: Iniciando conexión...
✅ SignalR: Conectado exitosamente al hub de mensajes
✅ SignalR inicializado correctamente
```

Si ves errores, revisa la sección de **Troubleshooting** abajo.

### **En el Backend (Terminal)**

Deberías ver logs como:

```
[Information] Usuario {UserId} conectado a SignalR
[Information] Mensaje {MessageId} enviado exitosamente
[Debug] Notificación SignalR enviada al usuario {ReceiverId}
```

---

## 🐛 TROUBLESHOOTING

### **Error: "Cannot find module '@microsoft/signalr'"**

**Causa:** La librería no está instalada.

**Solución:**
```bash
cd TwitterFront
npm install @microsoft/signalr
```

---

### **Error: "Access to XMLHttpRequest has been blocked by CORS policy"**

**Causa:** El frontend no está en la lista de orígenes permitidos.

**Solución:** Verifica en `Twitter/WebApi/Program.cs`:

```csharp
options.AddPolicy("SignalRPolicy", policy =>
{
    policy.WithOrigins("http://localhost:4200") // ← Verificar esta URL
          .AllowAnyMethod()
          .AllowAnyHeader()
          .AllowCredentials();
});
```

---

### **Error: "SignalR: No hay token de autenticación"**

**Causa:** El usuario no está autenticado.

**Solución:**
1. Cierra sesión
2. Vuelve a iniciar sesión
3. Verifica que el token se guarde en localStorage

---

### **Error: "Failed to start the connection: Error: WebSocket failed to connect"**

**Causa:** El backend no está corriendo o la URL es incorrecta.

**Solución:**
1. Verifica que el backend esté corriendo en `http://localhost:5063`
2. Verifica la URL en `TwitterFront/src/environments/environment.ts`:
   ```typescript
   apiBaseUrl: 'http://localhost:5063',
   ```

---

### **Los mensajes se guardan pero no llegan en tiempo real**

**Causa:** SignalR no está conectado o el usuario no está suscrito.

**Solución:**
1. Verifica en la consola que diga "Conectado exitosamente"
2. Verifica que el componente esté suscrito a `onMessageReceived`
3. Revisa los logs del backend para ver si se envía la notificación

---

## 📊 VERIFICAR QUE TODO FUNCIONA

Usa esta checklist:

- [ ] La librería `@microsoft/signalr` está instalada
- [ ] El backend corre sin errores
- [ ] El frontend corre sin errores
- [ ] En la consola del navegador aparece "Conectado exitosamente"
- [ ] Puedes enviar mensajes HTTP (sin SignalR)
- [ ] Los mensajes llegan en tiempo real (con SignalR)
- [ ] El indicador de "está escribiendo" funciona
- [ ] El estado online/offline se actualiza
- [ ] No hay errores de CORS

---

## 🎯 PRÓXIMOS PASOS

Una vez que todo funcione:

1. **Agregar rutas** para los componentes de mensajes en `app.routes.ts`
2. **Personalizar el diseño** según tu marca
3. **Agregar notificaciones** del navegador
4. **Implementar grupos** de chat (opcional)
5. **Agregar cifrado** end-to-end (opcional)

---

## 📚 ARCHIVOS DE REFERENCIA

- **Documentación completa:** `SIGNALR_IMPLEMENTATION.md`
- **Resumen ejecutivo:** `SIGNALR_SUMMARY.md`
- **Servicio de SignalR:** `src/app/core/realtime/signalr.service.ts`
- **Componente de chat:** `src/app/features/messages/chat.component.ts`
- **Hub del backend:** `Twitter/WebApi/Hubs/MessageHub.cs`

---

## 🆘 ¿NECESITAS AYUDA?

Si algo no funciona:

1. **Revisa los logs** en la consola del navegador y la terminal del backend
2. **Verifica la configuración** de CORS y URLs
3. **Consulta** `SIGNALR_IMPLEMENTATION.md` para más detalles
4. **Busca el error** en la sección de Troubleshooting

---

## ✅ CONFIRMACIÓN FINAL

Cuando todo funcione, deberías poder:

✅ Enviar mensajes que llegan **instantáneamente**  
✅ Ver cuando el otro usuario **está escribiendo**  
✅ Ver el estado **online/offline** en tiempo real  
✅ Recibir mensajes **sin refrescar la página**  
✅ Reconectar **automáticamente** si se pierde la conexión  

---

**¡Disfruta de tu sistema de mensajería en tiempo real! 🎉**
