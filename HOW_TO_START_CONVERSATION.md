# 💬 Cómo Iniciar una Conversación

## 🎯 Opciones Disponibles

Hay **3 formas** de iniciar una conversación con un usuario:

---

## 1️⃣ **Desde el Perfil del Usuario** (Recomendado)

### **Paso 1: Agregar el Botón en el Componente de Perfil**

Abre el archivo del componente de perfil (probablemente `profile.page.ts`) y agrega el botón:

```typescript
// profile.page.ts
import { SendMessageButtonComponent } from '../../messages/components/send-message-button.component';

@Component({
    // ...
    imports: [
        // ... otros imports
        SendMessageButtonComponent
    ],
})
export class ProfilePage {
    // ...
}
```

### **Paso 2: Agregar el Botón en el Template**

En el HTML del perfil (`profile.page.html`), agrega el botón donde quieras:

```html
<!-- Ejemplo: Junto a los botones de seguir/dejar de seguir -->
<div class="profile-actions">
    <!-- Botón de seguir (si ya existe) -->
    <button>Seguir</button>
    
    <!-- NUEVO: Botón de enviar mensaje -->
    <app-send-message-button [userId]="user().userId" />
</div>
```

### **Resultado:**

Cuando un usuario visite el perfil de otro usuario, verá un botón **"Enviar mensaje"** que lo llevará directamente al chat.

---

## 2️⃣ **Desde la Lista de Personas**

### **Paso 1: Agregar el Botón en la Página de People**

Abre `people.page.ts` y agrega el componente:

```typescript
// people.page.ts
import { SendMessageButtonComponent } from '../../messages/components/send-message-button.component';

@Component({
    // ...
    imports: [
        // ... otros imports
        SendMessageButtonComponent
    ],
})
export class PeoplePage {
    // ...
}
```

### **Paso 2: Agregar el Botón en el Template**

En `people.page.html`, agrega el botón en cada tarjeta de usuario:

```html
<!-- Ejemplo: En la lista de usuarios -->
@for (user of users(); track user.userId) {
    <div class="user-card">
        <div class="user-info">
            <img [src]="user.profilePhotoUrl" [alt]="user.fullName">
            <div>
                <h3>{{ user.fullName }}</h3>
                <p>{{ user.email }}</p>
            </div>
        </div>
        
        <div class="user-actions">
            <!-- NUEVO: Botón de enviar mensaje -->
            <app-send-message-button [userId]="user.userId" />
        </div>
    </div>
}
```

### **Resultado:**

En la lista de personas, cada usuario tendrá un botón para iniciar una conversación directamente.

---

## 3️⃣ **Navegación Directa por URL**

También puedes navegar directamente usando la URL:

```
http://localhost:4200/messages?userId=abc-123-def-456
```

Esto es útil para:
- **Links en notificaciones**
- **Compartir conversaciones**
- **Navegación programática**

### **Ejemplo en Código:**

```typescript
// Desde cualquier componente
constructor(private router: Router) {}

startChat(userId: string) {
    this.router.navigate(['/messages'], { 
        queryParams: { userId: userId } 
    });
}
```

---

## 🎨 **Personalizar el Botón**

Si quieres personalizar el botón, puedes crear variantes:

### **Variante 1: Solo Icono (Compacto)**

```typescript
@Component({
    selector: 'app-send-message-icon-button',
    standalone: true,
    template: `
        <button 
            type="button"
            class="icon-btn"
            (click)="startConversation()"
            title="Enviar mensaje">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        </button>
    `,
    styles: [`
        .icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
        }

        .icon-btn:hover {
            background: #1976d2;
            transform: scale(1.1);
        }
    `]
})
export class SendMessageIconButtonComponent {
    userId = input.required<string>();
    
    constructor(private router: Router) {}
    
    startConversation(): void {
        const id = this.userId();
        if (id) {
            void this.router.navigate(['/messages'], { 
                queryParams: { userId: id } 
            });
        }
    }
}
```

### **Variante 2: Botón Secundario (Outline)**

```typescript
@Component({
    selector: 'app-send-message-outline-button',
    standalone: true,
    template: `
        <button 
            type="button"
            class="outline-btn"
            (click)="startConversation()">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Mensaje</span>
        </button>
    `,
    styles: [`
        .outline-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: transparent;
            color: #2196f3;
            border: 2px solid #2196f3;
            border-radius: 9999px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .outline-btn:hover {
            background: #2196f3;
            color: white;
        }
    `]
})
export class SendMessageOutlineButtonComponent {
    userId = input.required<string>();
    
    constructor(private router: Router) {}
    
    startConversation(): void {
        const id = this.userId();
        if (id) {
            void this.router.navigate(['/messages'], { 
                queryParams: { userId: id } 
            });
        }
    }
}
```

---

## 🔄 **Flujo Completo**

```
Usuario hace clic en "Enviar mensaje"
    ↓
Navega a /messages?userId=abc-123
    ↓
MessagesPage detecta el query param
    ↓
Llama a startNewConversation(userId)
    ↓
Intenta cargar mensajes existentes
    ↓
Si hay mensajes → Los muestra
Si no hay mensajes → Muestra chat vacío
    ↓
Usuario puede escribir el primer mensaje
    ↓
Al enviar, se crea la conversación
```

---

## 📱 **Ejemplo Completo: Perfil de Usuario**

Aquí está un ejemplo completo de cómo se vería en el perfil:

```html
<!-- profile.page.html -->
<div class="profile-container">
    <div class="profile-header">
        <img [src]="user().profilePhotoUrl" [alt]="user().fullName" class="profile-avatar">
        
        <div class="profile-info">
            <h1>{{ user().fullName }}</h1>
            <p>{{ user().email }}</p>
        </div>
    </div>

    <!-- Acciones del perfil -->
    <div class="profile-actions">
        @if (user().userId !== currentUserId()) {
            <!-- Solo mostrar si NO es tu propio perfil -->
            
            <!-- Botón de seguir/dejar de seguir -->
            @if (isFollowing()) {
                <button class="btn-secondary" (click)="unfollow()">
                    Dejar de seguir
                </button>
            } @else {
                <button class="btn-primary" (click)="follow()">
                    Seguir
                </button>
            }
            
            <!-- NUEVO: Botón de enviar mensaje -->
            <app-send-message-button [userId]="user().userId" />
        }
    </div>

    <!-- Resto del perfil... -->
</div>
```

---

## 🎯 **Recomendaciones**

1. **Usa el botón completo** en perfiles y páginas con espacio
2. **Usa el botón de icono** en listas compactas o tarjetas pequeñas
3. **Usa el botón outline** cuando quieras un estilo más sutil
4. **Oculta el botón** si el usuario está viendo su propio perfil

---

## ✅ **Checklist de Implementación**

- [ ] Instalar `@microsoft/signalr` (si no lo has hecho)
- [ ] Agregar `SendMessageButtonComponent` en el perfil
- [ ] Agregar el botón en la lista de personas (opcional)
- [ ] Probar navegando a `/messages?userId=xxx`
- [ ] Verificar que se abra el chat correctamente
- [ ] Enviar el primer mensaje y verificar que se cree la conversación

---

## 🐛 **Troubleshooting**

### **El botón no hace nada**

**Solución:** Verifica que el `userId` no sea nulo:
```html
<app-send-message-button [userId]="user().userId" />
```

### **Navega pero no abre el chat**

**Solución:** Verifica que el query param se esté leyendo correctamente en `messages.page.ts`:
```typescript
this.route.queryParams.subscribe(params => {
    const userId = params['userId'];
    console.log('userId from query:', userId); // Debug
    if (userId) {
        void this.startNewConversation(userId);
    }
});
```

### **Abre el chat pero está vacío**

**Solución:** Esto es normal si no hay mensajes previos. Simplemente escribe el primer mensaje y se creará la conversación.

---

**¡Listo! Ahora puedes iniciar conversaciones desde cualquier parte de tu aplicación! 🎉**
