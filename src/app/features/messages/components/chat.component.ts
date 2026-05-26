import { Component, OnInit, OnDestroy, inject, signal, effect, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, debounceTime } from 'rxjs';

import { MessagesApiService } from '../services/messages-api.service';
import { SignalRService } from '../../../core/realtime/signalr.service';
import { MessageDto, SendMessageRequest } from '../models/messages.models';
import { SessionService } from '../../../core/auth/session.service';

/**
 * Componente de chat individual con un usuario
 * Incluye mensajería en tiempo real, indicador de "está escribiendo" y más
 */
@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="chat-container">
            <!-- Header del chat -->
            <div class="chat-header">
                <button class="back-button" (click)="goBack()">
                    ← Volver
                </button>
                <div class="user-info">
                    <div class="avatar">
                        @if (otherUserAvatar()) {
                            <img [src]="otherUserAvatar()" [alt]="otherUsername()">
                        } @else {
                            <div class="avatar-placeholder">
                                {{ otherUsername().charAt(0).toUpperCase() }}
                            </div>
                        }
                        @if (isOtherUserOnline()) {
                            <span class="online-indicator"></span>
                        }
                    </div>
                    <div>
                        <div class="username">{{ otherUsername() }}</div>
                        @if (isOtherUserOnline()) {
                            <div class="status">En línea</div>
                        } @else {
                            <div class="status">Desconectado</div>
                        }
                    </div>
                </div>
                <div class="connection-status" [class.connected]="signalRService.isConnected()">
                    {{ signalRService.isConnected() ? '🟢' : '🔴' }}
                </div>
            </div>

            <!-- Área de mensajes -->
            <div class="messages-area" #messagesArea>
                @if (loading()) {
                    <div class="loading">Cargando mensajes...</div>
                } @else if (messages().length === 0) {
                    <div class="empty-state">
                        <p>No hay mensajes aún</p>
                        <p class="hint">Envía el primer mensaje para iniciar la conversación</p>
                    </div>
                } @else {
                    <div class="messages-list">
                        @for (message of messages(); track message.messageId) {
                            <div 
                                class="message"
                                [class.sent]="message.senderId === currentUserId()"
                                [class.received]="message.senderId !== currentUserId()">
                                
                                <div class="message-bubble">
                                    <div class="message-content">{{ message.content }}</div>
                                    <div class="message-time">
                                        {{ formatTime(message.createdAt) }}
                                        @if (message.senderId === currentUserId()) {
                                            <span class="read-status">
                                                {{ message.isRead ? '✓✓' : '✓' }}
                                            </span>
                                        }
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                }

                <!-- Indicador de "está escribiendo" -->
                @if (isTyping()) {
                    <div class="typing-indicator">
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <span class="typing-text">{{ otherUsername() }} está escribiendo...</span>
                    </div>
                }
            </div>

            <!-- Input para escribir mensajes -->
            <div class="message-input-area">
                <form (ngSubmit)="sendMessage()" class="message-form">
                    <input
                        type="text"
                        [(ngModel)]="messageText"
                        name="message"
                        placeholder="Escribe un mensaje..."
                        class="message-input"
                        (input)="onTyping()"
                        [disabled]="sending()"
                        autocomplete="off"
                    />
                    <button 
                        type="submit" 
                        class="send-button"
                        [disabled]="!messageText.trim() || sending()">
                        @if (sending()) {
                            Enviando...
                        } @else {
                            Enviar
                        }
                    </button>
                </form>
            </div>
        </div>
    `,
    styles: [`
        .chat-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #fff;
        }

        .chat-header {
            padding: 1rem;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
            gap: 1rem;
            background: #f5f5f5;
        }

        .back-button {
            padding: 0.5rem 1rem;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 1rem;
            color: #2196f3;
        }

        .back-button:hover {
            background: #e3f2fd;
            border-radius: 4px;
        }

        .user-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .avatar {
            position: relative;
            width: 40px;
            height: 40px;
        }

        .avatar img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }

        .avatar-placeholder {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: #2196f3;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }

        .online-indicator {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 12px;
            height: 12px;
            background: #4caf50;
            border: 2px solid white;
            border-radius: 50%;
        }

        .username {
            font-weight: 600;
            color: #333;
        }

        .status {
            font-size: 0.75rem;
            color: #666;
        }

        .connection-status {
            font-size: 1.25rem;
        }

        .messages-area {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            background: #fafafa;
        }

        .loading, .empty-state {
            text-align: center;
            padding: 2rem;
            color: #666;
        }

        .empty-state .hint {
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }

        .messages-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .message {
            display: flex;
            max-width: 70%;
        }

        .message.sent {
            align-self: flex-end;
            margin-left: auto;
        }

        .message.received {
            align-self: flex-start;
        }

        .message-bubble {
            padding: 0.75rem 1rem;
            border-radius: 1rem;
            word-wrap: break-word;
        }

        .message.sent .message-bubble {
            background: #2196f3;
            color: white;
            border-bottom-right-radius: 0.25rem;
        }

        .message.received .message-bubble {
            background: white;
            color: #333;
            border: 1px solid #e0e0e0;
            border-bottom-left-radius: 0.25rem;
        }

        .message-content {
            margin-bottom: 0.25rem;
        }

        .message-time {
            font-size: 0.75rem;
            opacity: 0.7;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }

        .read-status {
            color: #4caf50;
        }

        .typing-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            margin-top: 0.5rem;
        }

        .typing-dots {
            display: flex;
            gap: 0.25rem;
        }

        .typing-dots span {
            width: 8px;
            height: 8px;
            background: #666;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }

        .typing-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% {
                transform: translateY(0);
                opacity: 0.7;
            }
            30% {
                transform: translateY(-10px);
                opacity: 1;
            }
        }

        .typing-text {
            font-size: 0.875rem;
            color: #666;
            font-style: italic;
        }

        .message-input-area {
            padding: 1rem;
            border-top: 1px solid #e0e0e0;
            background: white;
        }

        .message-form {
            display: flex;
            gap: 0.5rem;
        }

        .message-input {
            flex: 1;
            padding: 0.75rem 1rem;
            border: 1px solid #e0e0e0;
            border-radius: 2rem;
            font-size: 1rem;
            outline: none;
        }

        .message-input:focus {
            border-color: #2196f3;
        }

        .send-button {
            padding: 0.75rem 1.5rem;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 2rem;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }

        .send-button:hover:not(:disabled) {
            background: #1976d2;
        }

        .send-button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
    `]
})
export class ChatComponent implements OnInit, OnDestroy {
    private readonly messagesApi = inject(MessagesApiService);
    readonly signalRService = inject(SignalRService);
    private readonly sessionService = inject(SessionService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroy$ = new Subject<void>();
    private readonly typingSubject$ = new Subject<void>();

    // ViewChild para el área de mensajes (para hacer scroll automático)
    private readonly messagesArea = viewChild<ElementRef>('messagesArea');

    // Signals
    readonly messages = signal<MessageDto[]>([]);
    readonly loading = signal(true);
    readonly sending = signal(false);
    readonly currentUserId = signal<string | null>(null);
    readonly otherUserId = signal<string>('');
    readonly otherUsername = signal<string>('');
    readonly otherUserAvatar = signal<string | undefined>(undefined);
    readonly isOtherUserOnline = signal(false);
    readonly isTyping = signal(false);

    // Variables del formulario
    messageText = '';
    private typingTimeout?: number;

    constructor() {
        // Effect para hacer scroll automático cuando llegan nuevos mensajes
        effect(() => {
            const msgs = this.messages();
            if (msgs.length > 0) {
                setTimeout(() => this.scrollToBottom(), 100);
            }
        });
    }

    async ngOnInit() {
        // Obtener el ID del usuario actual
        this.currentUserId.set(this.sessionService.userId());

        // Obtener el ID del otro usuario de la ruta
        const otherUserId = this.route.snapshot.paramMap.get('userId');
        if (!otherUserId) {
            this.router.navigate(['/messages']);
            return;
        }
        this.otherUserId.set(otherUserId);

        // Conectar a SignalR
        await this.connectToSignalR();

        // Cargar mensajes
        this.loadMessages();

        // Escuchar nuevos mensajes en tiempo real
        this.listenToNewMessages();

        // Escuchar indicador de "está escribiendo"
        this.listenToTypingIndicator();

        // Escuchar estado online/offline
        this.listenToUserStatus();

        // Configurar debounce para el indicador de escritura
        this.setupTypingDebounce();
    }

    ngOnDestroy() {
        // Notificar que dejaste de escribir antes de salir
        if (this.otherUserId()) {
            this.signalRService.notifyStopTyping(this.otherUserId());
        }

        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Conecta al hub de SignalR
     */
    private async connectToSignalR() {
        try {
            await this.signalRService.startConnection();
        } catch (error) {
            console.error('Error al conectar a SignalR:', error);
        }
    }

    /**
     * Carga los mensajes de la conversación
     */
    private loadMessages() {
        this.loading.set(true);
        this.messagesApi.getConversation(this.otherUserId(), { limit: 100, offset: 0 })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (messages) => {
                    this.messages.set(messages);
                    this.loading.set(false);

                    // Obtener información del otro usuario del primer mensaje
                    if (messages.length > 0) {
                        const firstMessage = messages[0];
                        if (firstMessage.senderId === this.currentUserId()) {
                            this.otherUsername.set(firstMessage.receiverUsername);
                            this.otherUserAvatar.set(firstMessage.receiverAvatar);
                        } else {
                            this.otherUsername.set(firstMessage.senderUsername);
                            this.otherUserAvatar.set(firstMessage.senderAvatar);
                        }
                    }

                    // Marcar conversación como leída
                    this.markConversationAsRead();
                },
                error: (error) => {
                    console.error('Error al cargar mensajes:', error);
                    this.loading.set(false);
                }
            });
    }

    /**
     * Escucha nuevos mensajes en tiempo real
     */
    private listenToNewMessages() {
        this.signalRService.onMessageReceived
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                // Solo agregar si es de esta conversación
                if (message.senderId === this.otherUserId() || message.receiverId === this.otherUserId()) {
                    this.messages.update(msgs => [...msgs, message]);

                    // Si es un mensaje recibido, marcarlo como leído
                    if (message.receiverId === this.currentUserId()) {
                        this.markMessageAsRead(message.messageId);
                    }

                    // Reproducir sonido
                    this.playNotificationSound();
                }
            });
    }

    /**
     * Escucha el indicador de "está escribiendo"
     */
    private listenToTypingIndicator() {
        // Usuario está escribiendo
        this.signalRService.onUserTyping
            .pipe(takeUntil(this.destroy$))
            .subscribe((userId) => {
                if (userId === this.otherUserId()) {
                    this.isTyping.set(true);
                    this.scrollToBottom();
                }
            });

        // Usuario dejó de escribir
        this.signalRService.onUserStopTyping
            .pipe(takeUntil(this.destroy$))
            .subscribe((userId) => {
                if (userId === this.otherUserId()) {
                    this.isTyping.set(false);
                }
            });
    }

    /**
     * Escucha el estado online/offline del otro usuario
     */
    private listenToUserStatus() {
        // Usuario en línea
        this.signalRService.onUserOnline
            .pipe(takeUntil(this.destroy$))
            .subscribe((userId) => {
                if (userId === this.otherUserId()) {
                    this.isOtherUserOnline.set(true);
                }
            });

        // Usuario fuera de línea
        this.signalRService.onUserOffline
            .pipe(takeUntil(this.destroy$))
            .subscribe((userId) => {
                if (userId === this.otherUserId()) {
                    this.isOtherUserOnline.set(false);
                }
            });
    }

    /**
     * Configura el debounce para el indicador de escritura
     */
    private setupTypingDebounce() {
        this.typingSubject$
            .pipe(
                debounceTime(2000), // Esperar 2 segundos sin escribir
                takeUntil(this.destroy$)
            )
            .subscribe(() => {
                // Notificar que dejaste de escribir
                this.signalRService.notifyStopTyping(this.otherUserId());
            });
    }

    /**
     * Se llama cuando el usuario está escribiendo
     */
    onTyping() {
        // Notificar que estás escribiendo
        this.signalRService.notifyTyping(this.otherUserId());

        // Reiniciar el timer de "dejó de escribir"
        this.typingSubject$.next();
    }

    /**
     * Envía un mensaje
     */
    sendMessage() {
        const content = this.messageText.trim();
        if (!content || this.sending()) return;

        this.sending.set(true);

        const request: SendMessageRequest = {
            receiverId: this.otherUserId(),
            content: content
        };

        this.messagesApi.sendMessage(request)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (message) => {
                    // Agregar el mensaje a la lista
                    this.messages.update(msgs => [...msgs, message]);

                    // Limpiar el input
                    this.messageText = '';
                    this.sending.set(false);

                    // Notificar que dejaste de escribir
                    this.signalRService.notifyStopTyping(this.otherUserId());
                },
                error: (error) => {
                    console.error('Error al enviar mensaje:', error);
                    this.sending.set(false);
                    alert('Error al enviar el mensaje. Inténtalo de nuevo.');
                }
            });
    }

    /**
     * Marca un mensaje como leído
     */
    private markMessageAsRead(messageId: string) {
        this.messagesApi.markAsRead(messageId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                error: (error) => console.error('Error al marcar como leído:', error)
            });
    }

    /**
     * Marca toda la conversación como leída
     */
    private markConversationAsRead() {
        this.messagesApi.markConversationAsRead(this.otherUserId())
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                error: (error) => console.error('Error al marcar conversación como leída:', error)
            });
    }

    /**
     * Hace scroll hasta el final del área de mensajes
     */
    private scrollToBottom() {
        const element = this.messagesArea()?.nativeElement;
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }

    /**
     * Formatea la hora del mensaje
     */
    formatTime(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Vuelve a la lista de conversaciones
     */
    goBack() {
        this.router.navigate(['/messages']);
    }

    /**
     * Reproduce un sonido de notificación
     */
    private playNotificationSound() {
        try {
            const audio = new Audio('/assets/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => { });
        } catch (error) {
            // Ignorar errores
        }
    }
}
