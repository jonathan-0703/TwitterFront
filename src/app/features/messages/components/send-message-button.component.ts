import { Component, input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Botón para iniciar una conversación con un usuario
 * Uso: <app-send-message-button [userId]="userId" />
 */
@Component({
    selector: 'app-send-message-button',
    standalone: true,
    template: `
        <button 
            type="button"
            class="send-message-btn"
            (click)="startConversation()"
            [disabled]="!userId()">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Enviar mensaje</span>
        </button>
    `,
    styles: [`
        .send-message-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1.25rem;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.9375rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .send-message-btn:hover:not(:disabled) {
            background: #1976d2;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        }

        .send-message-btn:active:not(:disabled) {
            transform: translateY(0);
        }

        .send-message-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            opacity: 0.6;
        }

        .send-message-btn svg {
            width: 20px;
            height: 20px;
        }
    `]
})
export class SendMessageButtonComponent {
    /** ID del usuario con quien iniciar la conversación */
    userId = input.required<string>();

    constructor(private router: Router) { }

    startConversation(): void {
        const id = this.userId();
        if (id) {
            // Navegar a la página de mensajes con el userId como query param
            void this.router.navigate(['/messages'], {
                queryParams: { userId: id }
            });
        }
    }
}
