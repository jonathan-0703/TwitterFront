import { Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from '../auth/session.service';
import { MessageDto } from '../../features/messages/models/messages.models';

/**
 * Servicio de SignalR para comunicación en tiempo real
 * Maneja la conexión WebSocket con el backend para mensajería instantánea
 */
@Injectable({ providedIn: 'root' })
export class SignalRService {
    private readonly sessionService = inject(SessionService);
    private hubConnection: HubConnection | null = null;

    // Signals para estado de conexión
    readonly connectionState = signal<HubConnectionState>(HubConnectionState.Disconnected);
    readonly isConnected = signal(false);

    // Subjects para eventos del servidor
    private readonly messageReceived$ = new Subject<MessageDto>();
    private readonly userOnline$ = new Subject<string>();
    private readonly userOffline$ = new Subject<string>();
    private readonly userTyping$ = new Subject<string>();
    private readonly userStopTyping$ = new Subject<string>();

    // Observables públicos para suscribirse a eventos
    readonly onMessageReceived: Observable<MessageDto> = this.messageReceived$.asObservable();
    readonly onUserOnline: Observable<string> = this.userOnline$.asObservable();
    readonly onUserOffline: Observable<string> = this.userOffline$.asObservable();
    readonly onUserTyping: Observable<string> = this.userTyping$.asObservable();
    readonly onUserStopTyping: Observable<string> = this.userStopTyping$.asObservable();

    /**
     * Inicia la conexión con el hub de SignalR
     * Se conecta automáticamente al endpoint /hubs/message del backend
     */
    async startConnection(): Promise<void> {
        // Si ya está conectado, no hacer nada
        if (this.hubConnection && this.hubConnection.state === HubConnectionState.Connected) {
            console.log('✅ SignalR: Ya conectado');
            return;
        }

        // Obtener el token de autenticación
        const token = this.sessionService.getAccessToken();
        if (!token) {
            console.warn('⚠️ SignalR: No hay token de autenticación, no se puede conectar');
            return;
        }

        try {
            console.log('🔄 SignalR: Iniciando conexión...');

            // Construir la conexión al Hub
            this.hubConnection = new HubConnectionBuilder()
                .withUrl(`${environment.apiBaseUrl}/hubs/message`, {
                    accessTokenFactory: () => token, // Enviar el token JWT
                    skipNegotiation: false, // Permitir negociación de transporte
                    withCredentials: true, // Enviar cookies/credenciales
                    // Configurar transportes: intentar WebSockets primero, luego Long Polling
                    transport: environment.production
                        ? HttpTransportType.LongPolling | HttpTransportType.ServerSentEvents // Sin WebSockets en producción
                        : HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling // Todos en desarrollo
                })
                .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Reintentos automáticos
                .configureLogging(LogLevel.Information) // Logs para debugging
                .build();

            // Configurar los event handlers antes de conectar
            this.setupEventHandlers();

            // Iniciar la conexión
            await this.hubConnection.start();

            // Actualizar el estado
            this.connectionState.set(this.hubConnection.state);
            this.isConnected.set(true);

            console.log('✅ SignalR: Conectado exitosamente al hub de mensajes');
        } catch (error) {
            console.error('❌ SignalR: Error al conectar', error);
            this.connectionState.set(HubConnectionState.Disconnected);
            this.isConnected.set(false);
            throw error;
        }
    }

    /**
     * Detiene la conexión con el hub
     * Debe llamarse cuando el usuario cierra sesión o sale de la aplicación
     */
    async stopConnection(): Promise<void> {
        if (this.hubConnection) {
            try {
                await this.hubConnection.stop();
                this.connectionState.set(HubConnectionState.Disconnected);
                this.isConnected.set(false);
                console.log('🔌 SignalR: Desconectado correctamente');
            } catch (error) {
                console.error('❌ SignalR: Error al desconectar', error);
            }
        }
    }

    /**
     * Notifica al servidor que el usuario está escribiendo
     * El servidor enviará esta notificación al receptor
     * 
     * @param receiverId ID del usuario que recibirá la notificación
     */
    async notifyTyping(receiverId: string): Promise<void> {
        if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
            console.warn('⚠️ SignalR: No hay conexión activa para notificar typing');
            return;
        }

        try {
            await this.hubConnection.invoke('NotifyTyping', receiverId);
        } catch (error) {
            console.error('❌ SignalR: Error al notificar typing', error);
        }
    }

    /**
     * Notifica al servidor que el usuario dejó de escribir
     * 
     * @param receiverId ID del usuario que recibirá la notificación
     */
    async notifyStopTyping(receiverId: string): Promise<void> {
        if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
            return;
        }

        try {
            await this.hubConnection.invoke('NotifyStopTyping', receiverId);
        } catch (error) {
            console.error('❌ SignalR: Error al notificar stop typing', error);
        }
    }

    /**
     * Verifica si hay una conexión activa
     */
    isConnectionActive(): boolean {
        return this.hubConnection?.state === HubConnectionState.Connected;
    }

    /**
     * Obtiene el estado actual de la conexión
     */
    getConnectionState(): HubConnectionState {
        return this.hubConnection?.state ?? HubConnectionState.Disconnected;
    }

    /**
     * Configura los event handlers que escuchan eventos del servidor
     * Estos eventos son enviados desde el MessageHub en el backend
     */
    private setupEventHandlers(): void {
        if (!this.hubConnection) return;

        // ========================================
        // EVENTO: ReceiveMessage
        // Se dispara cuando otro usuario te envía un mensaje
        // ========================================
        this.hubConnection.on('ReceiveMessage', (message: MessageDto) => {
            console.log('SignalR: Mensaje recibido', message);
            this.messageReceived$.next(message);
        });

        // ========================================
        // EVENTO: UserOnline
        // Se dispara cuando un usuario se conecta
        // ========================================
        this.hubConnection.on('UserOnline', (userId: string) => {
            console.log('SignalR: Usuario en línea', userId);
            this.userOnline$.next(userId);
        });

        // ========================================
        // EVENTO: UserOffline
        // Se dispara cuando un usuario se desconecta
        // ========================================
        this.hubConnection.on('UserOffline', (userId: string) => {
            console.log('SignalR: Usuario fuera de línea', userId);
            this.userOffline$.next(userId);
        });

        // ========================================
        // EVENTO: UserTyping
        // Se dispara cuando un usuario está escribiendo
        // ========================================
        this.hubConnection.on('UserTyping', (userId: string) => {
            console.log('SignalR: Usuario escribiendo', userId);
            this.userTyping$.next(userId);
        });

        // ========================================
        // EVENTO: UserStopTyping
        // Se dispara cuando un usuario deja de escribir
        // ========================================
        this.hubConnection.on('UserStopTyping', (userId: string) => {
            console.log('SignalR: Usuario dejó de escribir', userId);
            this.userStopTyping$.next(userId);
        });

        // ========================================
        // EVENTOS DE CONEXIÓN
        // ========================================

        // Cuando se está reconectando
        this.hubConnection.onreconnecting((error) => {
            console.warn('ignalR: Reconectando...', error);
            this.connectionState.set(HubConnectionState.Reconnecting);
            this.isConnected.set(false);
        });

        // Cuando se reconectó exitosamente
        this.hubConnection.onreconnected((connectionId) => {
            console.log('SignalR: Reconectado exitosamente', connectionId);
            this.connectionState.set(HubConnectionState.Connected);
            this.isConnected.set(true);
        });

        // Cuando la conexión se cierra
        this.hubConnection.onclose((error) => {
            console.error('SignalR: Conexión cerrada', error);
            this.connectionState.set(HubConnectionState.Disconnected);
            this.isConnected.set(false);
        });
    }
}
