import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { MessagesApiService } from '../services/messages-api.service';
import { SignalRService } from '../../../core/realtime/signalr.service';
import { MessageDto } from '../models/messages.models';
import { SessionService } from '../../../core/auth/session.service';

/**
 * Componente que muestra la lista de conversaciones del usuario
 * Se actualiza en tiempo real cuando llegan nuevos mensajes
 */
@Component({
    selector: 'app-messages-list',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="messages-list-container">
            <div class="header">
                <h2>Mensajes</h2>
                <div class="connection-status" [class.connected]="signalRService.isConnected()">
                    {{ signalRService.isConnected() ? '🟢 Conectado' : '🔴 Desconectado' }}
                </div>
            </div>

            @if (loading()) {
                <div class="loading">Cargando conversaciones...</div>
            } @else if (conversations().length === 0) {
                <div class="empty-state">
                    <p>No tienes conversaciones aún</p>
                    <p class="hint">Busca usuarios y envíales un mensaje</p>
                </div>
            } @else {
                <div class="conversations-list">
                    @for (conversation of conversations(); track conversation.messageId) {
                        <div 
                            class="conversation-item"
                            [class.unread]="!conversation.isRead && conversation.receiverId === currentUserId()"
                            (click)="openConversation(conversation)">
                            
                            <div class="avatar">
                                @if (getOtherUserAvatar(conversation)) {
                                    <img [src]="getOtherUserAvatar(conversation)" [alt]="getOtherUsername(conversation)">
                                } @else {
                                    <div class="avatar-placeholder">
                                        {{ getOtherUsername(conversation).charAt(0).toUpperCase() }}
                                    </div>
                                }
                                
                                @if (isUserOnline(getOtherUserId(conversation))) {
                                    <span class="online-indicator"></span>
                                }
                            </div>

                            <div class="conversation-info">
                                <div class="conversation-header">
                                    <span class="username">{{ getOtherUsername(conversation) }}</span>
                                    <span class="time">{{ formatTime(conversation.createdAt) }}</span>
                                </div>
                                <div class="last-message">
                                    <span class="message-preview">{{ conversation.content }}</span>
                                    @if (!conversation.isRead && conversation.receiverId === currentUserId()) {
                                        <span class="unread-badge">●</span>
                                    }
                                </div>
                            </div>
                        </div>
                    }
                </div>
            }
        </div>
    `,
    styles: [`
        .messages-list-container {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .header {
            padding: 1rem;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .connection-status {
            font-size: 0.875rem;
            color: #666;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            background: #f5f5f5;
        }

        .connection-status.connected {
            color: #4caf50;
            background: #e8f5e9;
        }

        .loading, .empty-state {
            padding: 2rem;
            text-align: center;
            color: #666;
        }

        .empty-state .hint {
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }

        .conversations-list {
            flex: 1;
            overflow-y: auto;
        }

        .conversation-item {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            border-bottom: 1px solid #e0e0e0;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .conversation-item:hover {
            background-color: #f5f5f5;
        }

        .conversation-item.unread {
            background-color: #e3f2fd;
        }

        .avatar {
            position: relative;
            width: 48px;
            height: 48px;
            flex-shrink: 0;
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
            font-size: 1.25rem;
        }

        .online-indicator {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 12px;
            height: 12px;
            background: #4caf50;
            border: 2px solid white;
            border-radius: 50%;
        }

        .conversation-info {
            flex: 1;
            min-width: 0;
        }

        .conversation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.25rem;
        }

        .username {
            font-weight: 600;
            color: #333;
        }

        .time {
            font-size: 0.75rem;
            color: #999;
        }

        .last-message {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .message-preview {
            flex: 1;
            font-size: 0.875rem;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .unread-badge {
            color: #2196f3;
            font-size: 1.5rem;
            line-height: 1;
        }
    `]
})
export class MessagesListComponent implements OnInit, OnDestroy {
    private readonly messagesApi = inject(MessagesApiService);
    readonly signalRService = inject(SignalRService);
    private readonly sessionService = inject(SessionService);
    private readonly router = inject(Router);
    private readonly destroy$ = new Subject<void>();

    readonly conversations = signal<MessageDto[]>([]);
    readonly loading = signal(true);
    readonly currentUserId = signal<string | null>(null);
    private readonly onlineUsers = signal<Set<string>>(new Set());

    async ngOnInit() {
        // Obtener el ID del usuario actual
        this.currentUserId.set(this.sessionService.userId());

        // Conectar a SignalR
        await this.connectToSignalR();

        // Cargar conversaciones
        this.loadConversations();

        // Escuchar nuevos mensajes en tiempo real
        this.listenToNewMessages();

        // Escuchar estado online/offline de usuarios
        this.listenToUserStatus();
    }

    ngOnDestroy() {
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
     * Carga la lista de conversaciones
     */
    private loadConversations() {
        this.loading.set(true);
        this.messagesApi.getConversationsList({ limit: 50, offset: 0 })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (conversations) => {
                    this.conversations.set(conversations);
                    this.loading.set(false);
                },
                error: (error) => {
                    console.error('Error al cargar conversaciones:', error);
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
                console.log('Nuevo mensaje recibido:', message);

                // Actualizar o agregar la conversación
                const currentConversations = this.conversations();
                const existingIndex = currentConversations.findIndex(
                    c => (c.senderId === message.senderId && c.receiverId === message.receiverId) ||
                        (c.senderId === message.receiverId && c.receiverId === message.senderId)
                );

                if (existingIndex >= 0) {
                    // Actualizar conversación existente
                    const updated = [...currentConversations];
                    updated[existingIndex] = message;
                    // Mover al inicio
                    updated.unshift(updated.splice(existingIndex, 1)[0]);
                    this.conversations.set(updated);
                } else {
                    // Agregar nueva conversación al inicio
                    this.conversations.set([message, ...currentConversations]);
                }

                // Reproducir sonido de notificación (opcional)
                this.playNotificationSound();
            });
    }

    /**
     * Escucha el estado online/offline de usuarios
     */
    private listenToUserStatus() {
        // Usuario en línea
        this.signalRService.onUserOnline
            .pipe(takeUntil(this.destroy$))
            .subscribe((userId) => {
                const online = new Set(this.onlineUsers());
                online.add(userId);
                this.onlineUsers.set(online);
            });

        // Usuario fuera de línea
        this.signalRService.onUserOffline
            .pipe(takeUntil(this.destroy$))
            .subscribe((userId) => {
                const online = new Set(this.onlineUsers());
                online.delete(userId);
                this.onlineUsers.set(online);
            });
    }

    /**
     * Abre una conversación
     */
    openConversation(conversation: MessageDto) {
        const otherUserId = this.getOtherUserId(conversation);
        this.router.navigate(['/messages', otherUserId]);
    }

    /**
     * Obtiene el ID del otro usuario en la conversación
     */
    getOtherUserId(conversation: MessageDto): string {
        return conversation.senderId === this.currentUserId()
            ? conversation.receiverId
            : conversation.senderId;
    }

    /**
     * Obtiene el nombre del otro usuario
     */
    getOtherUsername(conversation: MessageDto): string {
        return conversation.senderId === this.currentUserId()
            ? conversation.receiverUsername
            : conversation.senderUsername;
    }

    /**
     * Obtiene el avatar del otro usuario
     */
    getOtherUserAvatar(conversation: MessageDto): string | undefined {
        return conversation.senderId === this.currentUserId()
            ? conversation.receiverAvatar
            : conversation.senderAvatar;
    }

    /**
     * Verifica si un usuario está en línea
     */
    isUserOnline(userId: string): boolean {
        return this.onlineUsers().has(userId);
    }

    /**
     * Formatea la fecha/hora del mensaje
     */
    formatTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;

        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    /**
     * Reproduce un sonido de notificación
     */
    private playNotificationSound() {
        try {
            const audio = new Audio('/assets/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Ignorar errores de reproducción (puede fallar si el usuario no ha interactuado)
            });
        } catch (error) {
            // Ignorar errores
        }
    }
}
