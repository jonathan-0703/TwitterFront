import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { SignalRService } from './signalr.service';
import { SessionService } from '../auth/session.service';

/**
 * Inicializador de SignalR
 * Conecta automáticamente cuando el usuario está autenticado
 * y desconecta cuando cierra sesión
 */
export function initializeSignalR() {
    const signalRService = inject(SignalRService);
    const sessionService = inject(SessionService);
    const router = inject(Router);

    return async () => {
        console.log('Inicializando SignalR...');

        // Si el usuario está autenticado, conectar
        if (sessionService.isAuthenticated()) {
            try {
                await signalRService.startConnection();
                console.log('SignalR inicializado correctamente');
            } catch (error) {
                console.error('Error al inicializar SignalR:', error);
            }
        }

        // Escuchar cambios en la navegación para conectar/desconectar
        router.events.subscribe(() => {
            const isAuthenticated = sessionService.isAuthenticated();
            const isConnected = signalRService.isConnectionActive();

            // Si está autenticado pero no conectado, conectar
            if (isAuthenticated && !isConnected) {
                signalRService.startConnection().catch(console.error);
            }
            // Si no está autenticado pero está conectado, desconectar
            else if (!isAuthenticated && isConnected) {
                signalRService.stopConnection().catch(console.error);
            }
        });
    };
}
