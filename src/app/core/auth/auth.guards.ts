import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';

import { adminRoles } from './session.model';
import { SessionService } from './session.service';

function createLoginRedirect(returnUrl: string) {
  const router = inject(Router);

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl },
  });
}

export const authGuard: CanActivateFn = (_route, state) => {
  const sessionService = inject(SessionService);

  return sessionService.isAuthenticated() ? true : createLoginRedirect(state.url);
};

export const authChildGuard: CanActivateChildFn = (_childRoute, state) => {
  const sessionService = inject(SessionService);

  return sessionService.isAuthenticated() ? true : createLoginRedirect(state.url);
};

export const guestGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  return sessionService.isAuthenticated() ? router.createUrlTree(['/home']) : true;
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (!sessionService.isAuthenticated()) {
    return createLoginRedirect(state.url);
  }

  return sessionService.hasRole(adminRoles) ? true : router.createUrlTree(['/home']);
};
