import { Routes } from '@angular/router';

import { adminGuard, authChildGuard, authGuard, guestGuard } from './core/auth/auth.guards';
import { AdminLayoutComponent } from './core/layouts/admin-layout/admin-layout.component';
import { PrivateLayoutComponent } from './core/layouts/private-layout/private-layout.component';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/public/login/login.page').then((module) => module.LoginPage),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/public/register/register.page').then((module) => module.RegisterPage),
      },
    ],
  },
  {
    path: '',
    component: PrivateLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/private/home/home.page').then((module) => module.HomePage),
      },
      {
        path: 'profile/:id',
        loadComponent: () => import('./features/private/profile/profile.page').then((module) => module.ProfilePage),
      },
      {
        path: 'people',
        loadComponent: () => import('./features/private/people/people.page').then((module) => module.PeoplePage),
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/pages/messages.page').then((module) => module.MessagesPage),
      },
      {
        path: 'follows/:id',
        loadComponent: () => import('./features/follows/pages/follows-list.page').then((module) => module.FollowsPage),
      },
      {
        path: 'settings/profile',
        loadComponent: () =>
          import('./features/private/settings/profile/settings-profile.page').then(
            (module) => module.SettingsProfilePage,
          ),
      },
      {
        path: 'settings/password',
        loadComponent: () =>
          import('./features/private/settings/password/settings-password.page').then(
            (module) => module.SettingsPasswordPage,
          ),
      },
    ],
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.page').then((module) => module.AdminDashboardPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/users/admin-users.page').then((module) => module.AdminUsersPage),
      },
      {
        path: 'posts',
        loadComponent: () => import('./features/admin/posts/admin-posts.page').then((module) => module.AdminPostsPage),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/admin/reports/admin-reports.page').then((module) => module.AdminReportsPage),
      },
      {
        path: 'suspensions',
        loadComponent: () =>
          import('./features/admin/suspensions/admin-suspensions.page').then((module) => module.AdminSuspensionsPage),
      },
      {
        path: 'config',
        loadComponent: () => import('./features/admin/config/admin-config.page').then((module) => module.AdminConfigPage),
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/admin/audit/admin-audit.page').then((module) => module.AdminAuditPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/shared/not-found/not-found.page').then((module) => module.NotFoundPage),
  },
];
