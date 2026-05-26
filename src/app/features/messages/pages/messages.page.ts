import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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
import { UserDto } from '../../users/models/users.models';


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
    readonly loading = signal(false);
    readonly sending = signal(false);
    readonly error = signal<string | null>(null);

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
        const userId = this.selectedUserId();
        if (!userId) return '';

        const conv = this.conversations().find(
            (m) => m.senderId === userId || m.receiverId === userId
        );

        if (!conv) return 'Usuario';

        const isSender = conv.senderId === userId;
        return isSender ? conv.senderUsername : conv.receiverUsername;
    });

    constructor() {
        void this.loadConversations();

        // Conectar a SignalR
        this.connectToSignalR();

        // Escuchar mensajes en tiempo real
        this.listenToNewMessages();

        // Verificar si hay un userId en los query params para iniciar conversación
        this.checkForNewConversation();
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
            }

            // Recargar la lista de conversaciones
            void this.loadConversations();
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

            if (messages.length > 0) {
                // Marcar como leído si hay mensajes
                await firstValueFrom(this.messagesApi.markConversationAsRead(userId));
            }
        } catch (err) {
            // Si no hay mensajes, simplemente iniciar una conversación vacía
            this.selectedConversation.set([]);
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
            await this.loadConversations();
        } catch (err) {
            this.feedback.error(getErrorMessage(err, 'No se pudo enviar el mensaje'));
        } finally {
            this.sending.set(false);
        }
    }

    closeConversation(): void {
        this.selectedUserId.set(null);
        this.selectedConversation.set([]);
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

    isSentByMe(message: MessageDto): boolean {
        return message.senderId === this.currentUserId();
    }

    toUserDto(message: MessageDto, isSender: boolean): UserDto {
        return {
            userId: isSender ? message.senderId : message.receiverId,
            fullName: isSender ? message.senderUsername : message.receiverUsername,
            email: isSender ? message.senderUsername : message.receiverUsername,
            profilePhotoUrl: isSender ? message.senderAvatar : message.receiverAvatar,
        };
    }

    trackMessage(_index: number, message: MessageDto): string {
        return message.messageId;
    }
}
