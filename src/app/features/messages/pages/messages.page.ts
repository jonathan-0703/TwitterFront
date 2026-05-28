import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild, ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, interval, switchMap } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { SignalRService } from '../../../core/realtime/signalr.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { MessagesApiService } from '../services/messages-api.service';
import { MessageDto } from '../models/messages.models';
import { UserAvatarComponent } from '../../users/components/user-avatar.component';
import { UserDto, getUserDisplayName } from '../../users/models/users.models';


@Component({
    selector: 'app-messages-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [DatePipe, ReactiveFormsModule, StateCardComponent, UserAvatarComponent],
    templateUrl: './messages.page.html',
    styleUrl: './messages.page.scss',
})
export class MessagesPage {
    private readonly messagesApi = inject(MessagesApiService);
    private readonly feedback = inject(FeedbackService);
    private readonly sessionService = inject(SessionService);
    private readonly formBuilder = inject(NonNullableFormBuilder);
    private readonly route = inject(ActivatedRoute);
    private readonly signalRService = inject(SignalRService);

    readonly conversations = signal<MessageDto[]>([]);
    readonly selectedConversation = signal<MessageDto[]>([]);
    readonly selectedUserId = signal<string | null>(null);
    readonly selectedUserInfo = signal<{ name: string; avatar?: string } | null>(null);
    readonly loading = signal(false);
    readonly sending = signal(false);
    readonly error = signal<string | null>(null);

    readonly onlineUsers = signal<Set<string>>(new Set());
    readonly typingUsers = signal<Set<string>>(new Set());
    private typingTimeout: any = null;

    // Referencia al contenedor de mensajes para scroll automático
    readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

    readonly unreadCount = toSignal(
        interval(10000).pipe(
            switchMap(() => this.messagesApi.getUnreadCount())
        ),
        { initialValue: 0 }
    );

    readonly messageForm = this.formBuilder.group({
        content: ['', [Validators.required, Validators.maxLength(1000)]],
    });

    readonly currentUserId = computed(() => this.sessionService.userId());
    readonly hasSelectedConversation = computed(() => this.selectedUserId() !== null);

    readonly selectedUserName = computed(() => {
        const userInfo = this.selectedUserInfo();
        if (userInfo) return userInfo.name;

        const userId = this.selectedUserId();
        if (!userId) return '';

        const conv = this.conversations().find(
            (m) => m.senderId === userId || m.receiverId === userId
        );

        if (!conv) return 'Usuario';

        const isSender = conv.senderId === userId;
        return isSender ? conv.senderUsername : conv.receiverUsername;
    });

    readonly selectedUserAvatar = computed(() => {
        const userInfo = this.selectedUserInfo();
        if (userInfo) return userInfo.avatar;

        const userId = this.selectedUserId();
        if (!userId) return undefined;

        const conv = this.conversations().find(
            (m) => m.senderId === userId || m.receiverId === userId
        );

        if (!conv) return undefined;

        const isSender = conv.senderId === userId;
        return isSender ? conv.senderAvatar : conv.receiverAvatar;
    });

    readonly isSelectedUserOnline = computed(() => {
        const userId = this.selectedUserId();
        return userId ? this.onlineUsers().has(userId) : false;
    });

    readonly isSelectedUserTyping = computed(() => {
        const userId = this.selectedUserId();
        return userId ? this.typingUsers().has(userId) : false;
    });

    constructor() {
        void this.loadConversations();

        // Conectar a SignalR
        this.connectToSignalR();

        // Escuchar mensajes en tiempo real
        this.listenToNewMessages();

        // Escuchar eventos de estado de usuarios
        this.listenToUserStatus();

        // Verificar si hay un userId en los query params para iniciar conversación
        this.checkForNewConversation();

        // Hacer scroll automático cuando cambian los mensajes
        effect(() => {
            const messages = this.selectedConversation();
            if (messages.length > 0) {
                // Usar setTimeout para asegurar que el DOM se haya actualizado
                setTimeout(() => this.scrollToBottom(), 100);
            }
        });
    }

    /**
     * Conecta a SignalR para recibir mensajes en tiempo real
     */
    private async connectToSignalR(): Promise<void> {
        try {
            await this.signalRService.startConnection();
        } catch (error) {
            console.error('Error al conectar a SignalR:', error);
        }
    }

    /**
     * Escucha nuevos mensajes en tiempo real
     */
    private listenToNewMessages(): void {
        this.signalRService.onMessageReceived.subscribe((message) => {
            console.log('Nuevo mensaje recibido:', message);

            // Si es de la conversación actual, agregarlo
            const selectedUserId = this.selectedUserId();
            if (selectedUserId &&
                (message.senderId === selectedUserId || message.receiverId === selectedUserId)) {
                this.selectedConversation.update(messages => [...messages, message]);

                // Actualizar info del usuario si no existe
                if (!this.selectedUserInfo()) {
                    const currentUserId = this.currentUserId();
                    const isOtherUserSender = message.senderId !== currentUserId;
                    this.selectedUserInfo.set({
                        name: isOtherUserSender ? message.senderUsername : message.receiverUsername,
                        avatar: isOtherUserSender ? message.senderAvatar : message.receiverAvatar
                    });
                }
            }

            // Recargar la lista de conversaciones
            void this.loadConversations();
        });
    }

    /**
     * Escucha eventos de estado de usuarios (online/offline, typing)
     */
    private listenToUserStatus(): void {
        // Usuario se conectó
        this.signalRService.onUserOnline.subscribe((userId) => {
            this.onlineUsers.update(users => {
                const newSet = new Set(users);
                newSet.add(userId);
                return newSet;
            });
        });

        // Usuario se desconectó
        this.signalRService.onUserOffline.subscribe((userId) => {
            this.onlineUsers.update(users => {
                const newSet = new Set(users);
                newSet.delete(userId);
                return newSet;
            });
        });

        // Usuario está escribiendo
        this.signalRService.onUserTyping.subscribe((userId) => {
            this.typingUsers.update(users => {
                const newSet = new Set(users);
                newSet.add(userId);
                return newSet;
            });
        });

        // Usuario dejó de escribir
        this.signalRService.onUserStopTyping.subscribe((userId) => {
            this.typingUsers.update(users => {
                const newSet = new Set(users);
                newSet.delete(userId);
                return newSet;
            });
        });
    }

    /**
     * Verifica si hay un userId en los query params para iniciar una nueva conversación
     */
    private checkForNewConversation(): void {
        this.route.queryParams.subscribe(params => {
            const userId = params['userId'];
            if (userId && userId !== this.currentUserId()) {
                // Iniciar conversación con este usuario
                void this.startNewConversation(userId);
            }
        });
    }

    /**
     * Inicia una nueva conversación con un usuario
     */
    async startNewConversation(userId: string): Promise<void> {
        this.selectedUserId.set(userId);

        try {
            // Intentar cargar mensajes existentes
            const messages = await firstValueFrom(
                this.messagesApi.getConversation(userId, { limit: 50 })
            );
            this.selectedConversation.set(messages.reverse());

            // Guardar info del usuario desde el primer mensaje
            if (messages.length > 0) {
                const firstMsg = messages[0];
                const currentUserId = this.currentUserId();
                const isOtherUserSender = firstMsg.senderId !== currentUserId;

                this.selectedUserInfo.set({
                    name: isOtherUserSender ? firstMsg.senderUsername : firstMsg.receiverUsername,
                    avatar: isOtherUserSender ? firstMsg.senderAvatar : firstMsg.receiverAvatar
                });

                // Marcar como leído si hay mensajes
                await firstValueFrom(this.messagesApi.markConversationAsRead(userId));
            } else {
                // Si no hay mensajes, intentar obtener info de conversations
                const conv = this.conversations().find(
                    (m) => m.senderId === userId || m.receiverId === userId
                );
                if (conv) {
                    const currentUserId = this.currentUserId();
                    const isSender = conv.senderId === userId;
                    this.selectedUserInfo.set({
                        name: isSender ? conv.senderUsername : conv.receiverUsername,
                        avatar: isSender ? conv.senderAvatar : conv.receiverAvatar
                    });
                }
            }
        } catch (err) {
            // Si no hay mensajes, simplemente iniciar una conversación vacía
            this.selectedConversation.set([]);

            // Intentar obtener info de conversations
            const conv = this.conversations().find(
                (m) => m.senderId === userId || m.receiverId === userId
            );
            if (conv) {
                const currentUserId = this.currentUserId();
                const isSender = conv.senderId === userId;
                this.selectedUserInfo.set({
                    name: isSender ? conv.senderUsername : conv.receiverUsername,
                    avatar: isSender ? conv.senderAvatar : conv.receiverAvatar
                });
            }
        }
    }

    async loadConversations(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const data = await firstValueFrom(this.messagesApi.getConversationsList({ limit: 50 }));
            this.conversations.set(data);
        } catch (err) {
            this.error.set(getErrorMessage(err, 'No se pudieron cargar las conversaciones'));
        } finally {
            this.loading.set(false);
        }
    }

    async selectConversation(message: MessageDto): Promise<void> {
        const currentUserId = this.currentUserId();
        if (!currentUserId) return;

        const otherUserId = message.senderId === currentUserId ? message.receiverId : message.senderId;

        // Guardar info del usuario antes de cargar la conversación
        const isSender = message.senderId !== currentUserId;
        this.selectedUserInfo.set({
            name: isSender ? message.senderUsername : message.receiverUsername,
            avatar: isSender ? message.senderAvatar : message.receiverAvatar
        });

        await this.startNewConversation(otherUserId);
    }

    async sendMessage(): Promise<void> {
        if (this.messageForm.invalid || this.sending()) {
            return;
        }

        const userId = this.selectedUserId();
        if (!userId) return;

        this.sending.set(true);

        try {
            const { content } = this.messageForm.getRawValue();
            const newMessage = await firstValueFrom(
                this.messagesApi.sendMessage({ receiverId: userId, content })
            );

            this.selectedConversation.update((messages) => [...messages, newMessage]);
            this.messageForm.reset();

            // Notificar que dejó de escribir
            await this.signalRService.notifyStopTyping(userId);

            await this.loadConversations();
        } catch (err) {
            this.feedback.error(getErrorMessage(err, 'No se pudo enviar el mensaje'));
        } finally {
            this.sending.set(false);
        }
    }

    /**
     * Maneja el evento de escritura en el input
     * Notifica al otro usuario que está escribiendo
     */
    onInputChange(): void {
        const userId = this.selectedUserId();
        if (!userId) return;

        // Notificar que está escribiendo
        void this.signalRService.notifyTyping(userId);

        // Limpiar timeout anterior
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Después de 2 segundos sin escribir, notificar que dejó de escribir
        this.typingTimeout = setTimeout(() => {
            void this.signalRService.notifyStopTyping(userId);
        }, 2000);
    }

    closeConversation(): void {
        this.selectedUserId.set(null);
        this.selectedConversation.set([]);
        this.selectedUserInfo.set(null);
        this.messageForm.reset();
    }

    getOtherUserId(message: MessageDto): string {
        const currentUserId = this.currentUserId();
        return message.senderId === currentUserId ? message.receiverId : message.senderId;
    }

    getOtherUserName(message: MessageDto): string {
        const currentUserId = this.currentUserId();
        return message.senderId === currentUserId ? message.receiverUsername : message.senderUsername;
    }

    getOtherUserAvatar(message: MessageDto): string | undefined {
        const currentUserId = this.currentUserId();
        return message.senderId === currentUserId ? message.receiverAvatar : message.senderAvatar;
    }

    isUnread(message: MessageDto): boolean {
        const currentUserId = this.currentUserId();
        return message.receiverId === currentUserId && !message.isRead;
    }

    isUserOnline(userId: string): boolean {
        return this.onlineUsers().has(userId);
    }

    isSentByMe(message: MessageDto): boolean {
        return message.senderId === this.currentUserId();
    }

    toUserDto(message: MessageDto, isSender: boolean): UserDto {
        return {
            userId: isSender ? message.senderId : message.receiverId,
            nickname: isSender ? message.senderUsername : message.receiverUsername,
            email: isSender ? message.senderUsername : message.receiverUsername,
            profilePhotoUrl: isSender ? message.senderAvatar : message.receiverAvatar,
        };
    }

    trackMessage(_index: number, message: MessageDto): string {
        return message.messageId;
    }

    /**
     * Hace scroll automático al final del contenedor de mensajes
     */
    private scrollToBottom(): void {
        const container = this.messagesContainer()?.nativeElement;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
}
