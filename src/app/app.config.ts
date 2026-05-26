import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { authInterceptor } from './core/auth/auth.interceptor';
import { SessionService } from './core/auth/session.service';
import { initializeSignalR } from './core/realtime/signalr.initializer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(SessionService).hydrate(),
    },
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useFactory: initializeSignalR,
    },
  ],
};
