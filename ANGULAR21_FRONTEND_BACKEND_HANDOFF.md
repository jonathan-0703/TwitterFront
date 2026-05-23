# Twitter Backend API - Angular 21 Integration Guide

This document gives an AI agent or Angular 21 frontend developer the backend context needed to work safely and fast against this API.

## Quick path

1. Use this API as a REST backend served under `/api`.
2. Implement auth first: login, JWT storage, refresh-token rotation, auth interceptor.
3. Build core user/post flows before admin flows.
4. Do **not** build password reset, comments, likes, retweets, follows, messaging, or media yet.

## Architecture at a glance

| Topic | Decision |
|---|---|
| Stack | .NET 10 + ASP.NET Core + EF Core + SQL Server |
| Architecture | Clean Architecture: Domain -> Application -> Infrastructure -> WebApi -> Shared |
| API style | REST controllers |
| Auth | JWT + refresh token |
| Database | SQL Server |
| Logging | Serilog to console, optional MongoDB sink |
| CORS | Open by default |
| Realtime | `AddSignalR()` exists, but no Hub is implemented |
| Admin auth | Permission-based, layered over roles |

## Runtime and deployment context

- Deploy target: Render
- App port: `8080`
- Local app profile: `WebApi/Properties/launchSettings.json`
- Config sources:
  - `appsettings.json`
  - `appsettings.Development.json`
  - `WebApi/secret.json`
  - environment variables

### Important config keys

```env
ConnectionStrings__DefaultConnection=
Jwt__PrivateKey=
Jwt__Issuer=Twitter
Jwt__Audience=Twitter API
Jwt__ExpirationInMinutesMin=60
Jwt__ExpirationInMinutesMax=1440
Auth__RefreshToken__ExpirationInDays=15
SMTP__Host=
SMTP__Port=
SMTP__User=
SMTP__Password=
SMTP__From=
```

## Authentication model

### Flow

1. `POST /api/auth/login`
2. Receive `token` + `refreshToken`
3. Send JWT in `Authorization: Bearer <token>`
4. On expiration, call `POST /api/auth/renew` with the refresh token
5. Replace both token and refresh token with the new pair

### Important frontend rules

- Refresh tokens are **rotated**.
- If the frontend forgets to store the new refresh token, the session breaks.
- Build an Angular HTTP interceptor from day one.

### JWT claims

| Claim | Meaning |
|---|---|
| `UserId` | Current authenticated user GUID |
| role claim | Only the **first** role is embedded in the JWT |

### Auth caveats

- Password reset endpoints exist but are **not implemented**.
- Do not build UI for forgot-password / verify-otp yet.

## Authorization model

### Levels

| Level | Mechanism | Notes |
|---|---|---|
| Public | No auth attribute | Some user and post endpoints are public |
| Authenticated | `[Authorize]` | Requires valid JWT |
| Permission-based | `[RequirePermission(...)]` | Used on admin endpoints |
| Suspension-aware | `[RequireNotSuspended]` | Blocks suspended users |

### Roles in the system

- `User`
- `Admin`
- `SuperAdmin`
- `Moderator`
- `Developer`

### Permission constants used by code

- `users.view`
- `users.delete`
- `users.verify`
- `users.roles`
- `users.ban`
- `posts.view`
- `posts.delete`
- `posts.flag`
- `reports.view`
- `reports.assign`
- `reports.resolve`
- `config.view`
- `config.edit`
- `audit.view`
- `dashboard.view`
- `sessions.view`

## Response conventions

### Success envelope

Most endpoints return `GenericResponse<T>`:

```ts
interface GenericResponse<T> {
  data: T;
  message: string;
  errors: string[];
  timeStamp: string;
}
```

### Error format

Errors use `ProblemDetails` or equivalent error JSON from middleware.

```ts
interface ProblemDetails {
  status: number;
  title: string;
  detail: string;
  traceId: string;
  timestamp: string;
}
```

### Pagination convention

- Uses `limit` + `offset`
- No total-count metadata
- `limit=0` usually means no limit

Frontend implication: use **load more** or custom pagination state instead of assuming server pagination metadata.

## Endpoint inventory

## Auth - `api/auth`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/renew` | Public | Renew JWT + refresh token |
| POST | `/api/auth/reset-password` | Public | Exists but not implemented |
| POST | `/api/auth/verify-otp` | Public | Exists but not implemented |

### Main frontend DTOs

```ts
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginAuthResponse {
  token: string;
  refreshToken: string;
}
```

## Users - `api/user`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/user/create` | Public | Register user |
| GET | `/api/user/list` | Public | List users |
| GET | `/api/user/{id}` | Public | Get user by id |
| PUT | `/api/user/{id}/update` | Public | Update user |
| PATCH | `/api/user/change-password` | JWT | Change own password |
| DELETE | `/api/user/{id}/delete` | `users.delete` | Soft-delete user |
| GET | `/api/user/me` | JWT | Get current user |
| POST | `/api/user/test-email` | Public | Test SMTP endpoint |

### Public user contract

```ts
interface UserDto {
  userId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
  isSuspended?: boolean;
  isShadowBanned?: boolean;
  deletedAt?: string | null;
}
```

**Important:** public and admin user responses are not perfectly consistent. Treat admin-only fields as optional in the frontend model.

## Posts - `api/post`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/post/create` | Public | Create post |
| GET | `/api/post/list` | Public | List posts |
| GET | `/api/post/{id}` | Public | Get post by id |
| PUT | `/api/post/{id}/update` | Public | Update post |
| PATCH | `/api/post/{id}/change-status` | Public | Change publish state |
| DELETE | `/api/post/{id}/delete` | Public | Delete post |

### Post contract

```ts
interface PostDto {
  postId: string;
  userId: string;
  content: string;
  isPublished: boolean;
  createdAt: string;
  userFullName?: string;
  userAvatar?: string | null;
  username?: string | null;
  repliedToPostId?: string | null;
  reportCount?: number;
  isFlagged?: boolean;
  deletedReason?: string | null;
  likesCount?: number;
  retweetsCount?: number;
  repliesCount?: number;
  mediaUrls?: string[] | null;
}
```

### Post caveats

- Many fields in `PostDto` exist but are **not really populated**.
- Do not build UI that depends on likes, retweets, replies, media, or usernames being complete.
- The admin side uses soft delete semantics; public endpoints are less strict.

## Admin endpoints

All admin endpoints require:

- valid JWT
- not suspended
- correct permission

### Admin users - `api/admin/users`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/users/list` | `users.view` | List users |
| DELETE | `/api/admin/users/{id}` | `users.delete` | Soft-delete user |
| POST | `/api/admin/users/{id}/restore` | `users.delete` | Restore user |
| POST | `/api/admin/users/{id}/verify` | `users.verify` | Verify user |
| DELETE | `/api/admin/users/{id}/verify` | `users.verify` | Unverify user |
| PUT | `/api/admin/users/{id}/role` | `users.roles` | Change role |

### Admin posts - `api/admin/posts`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/posts/list` | `posts.view` | List posts |
| POST | `/api/admin/posts/{id}/flag` | `posts.flag` | Flag post |
| DELETE | `/api/admin/posts/{id}` | `posts.delete` | Soft-delete post |
| POST | `/api/admin/posts/{id}/restore` | `posts.delete` | Restore post |

### Admin reports - `api/admin/reports`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/reports/pending` | `reports.view` | Pending reports |
| GET | `/api/admin/reports/all` | `reports.view` | All reports |
| POST | `/api/admin/reports/create` | `reports.view` | Create report |
| PUT | `/api/admin/reports/{id}/assign` | `reports.assign` | Assign report |
| PUT | `/api/admin/reports/{id}/resolve` | `reports.resolve` | Resolve report |
| PUT | `/api/admin/reports/{id}/dismiss` | `reports.resolve` | Dismiss report |

### Admin suspensions - `api/admin/suspensions`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| POST | `/api/admin/suspensions/suspend` | `users.ban` | Suspend user |
| POST | `/api/admin/suspensions/lift` | `users.ban` | Lift suspension |
| GET | `/api/admin/suspensions/history/{userId}` | `users.ban` | Suspension history |

### Admin dashboard - `api/admin/dashboard`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/dashboard/stats` | `dashboard.view` | Read dashboard stats |
| POST | `/api/admin/dashboard/recalculate` | `dashboard.view` | Recalculate stats |

### Admin config - `api/admin/config`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/config/all` | `config.view` | All config values |
| GET | `/api/admin/config/{key}` | `config.view` | One config value |
| PUT | `/api/admin/config/{key}` | `config.edit` | Update config |

### Admin audit - `api/admin/audit`

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/audit/logs` | `audit.view` | Audit log filters |

## Features status

### Ready enough for frontend

- login
- token renewal
- user registration
- current-user fetch
- password change
- post listing
- post creation/update/basic CRUD
- admin users
- admin posts
- admin suspensions
- admin reports
- admin config
- admin audit
- admin dashboard

### Exists but incomplete / risky

- password reset
- verify OTP
- post DTO rich social data
- dashboard metrics accuracy
- includeDeleted behavior in some admin flows

### Do not build yet

- comments
- likes
- retweets
- follows
- direct messages
- media uploads
- search
- real-time SignalR features
- shadow-ban UI

## Frontend integration advice for Angular 21

## Recommended delivery order

1. **Core app shell**
   - environments
   - API client layer
   - auth store/signals
   - JWT interceptor
   - route guards

2. **Auth**
   - login form
   - session persistence
   - token refresh flow

3. **Core social UI**
   - feed page
   - create post form
   - profile page
   - edit profile
   - change password

4. **Admin app/panel**
   - users
   - posts
   - reports
   - suspensions
   - config
   - audit
   - dashboard

## Suggested Angular 21 frontend shape

- `core/`
  - auth
  - http
  - guards
  - interceptors
  - config
- `features/auth/`
- `features/feed/`
- `features/profile/`
- `features/admin/`
  - users
  - posts
  - reports
  - suspensions
  - audit
  - config
  - dashboard

Prefer:

- standalone components
- signal-based state
- resource/http patterns where useful
- strongly typed API contracts per feature

## Known caveats and integration warnings

1. JWT refresh is mandatory.
2. Public post endpoints are permissive; do not assume final security rules are stable.
3. `PostDto` exposes fields the backend does not fully populate.
4. `UserDto` varies between public and admin usage.
5. Pagination has no total count.
6. Password reset flow is not usable yet.
7. There are backend schema/code mismatches that have been patched operationally; frontend should avoid assuming every admin field is perfect unless verified in live API responses.

## Files that define backend behavior

- `WebApi/Program.cs`
- `WebApi/Extensions/ServiceCollectionExtension.cs`
- `WebApi/Extensions/PipelineExtensions.cs`
- `WebApi/Extensions/SeedExtensions.cs`
- `WebApi/Middlewares/ErrorHandlerMiddleware.cs`
- `WebApi/Controllers/AuthController.cs`
- `WebApi/Controllers/UserController.cs`
- `WebApi/Controllers/PostController.cs`
- `WebApi/Controllers/AdminUserController.cs`
- `WebApi/Controllers/AdminPostController.cs`
- `WebApi/Controllers/AdminReportController.cs`
- `WebApi/Controllers/AdminSuspensionController.cs`
- `WebApi/Controllers/AdminDashboardController.cs`
- `WebApi/Controllers/AdminConfigController.cs`
- `WebApi/Controllers/AdminAuditController.cs`
- `WebApi/Attributes/RequirePermissionAttribute.cs`
- `WebApi/Attributes/RequireNotSuspendedAttribute.cs`
- `Application/Services/AuthService.cs`
- `Application/Services/UserService.cs`
- `Application/Services/PostService.cs`
- `Application/Services/AdminService.cs`
- `Application/Services/SuspensionService.cs`
- `Application/Services/ReportService.cs`
- `Application/Services/ConfigService.cs`
- `Application/Services/DashboardService.cs`
- `Application/Services/AuditService.cs`
- `Application/Helpers/TokenHelper.cs`
- `Application/Models/DTOs/*`
- `Domain/Database/SqlServer/Context/TwitterDbContext.cs`
- `Shared/Constants/PermissionConstants.cs`
- `DB/twitter.sql`

## Checklist for AI/frontend work

- [ ] Read this file first
- [ ] Confirm live API base URL
- [ ] Confirm JWT + refresh flow works in current environment
- [ ] Treat incomplete DTO fields as optional
- [ ] Build auth interceptor before protected screens
- [ ] Avoid implementing non-existent social features
- [ ] Validate admin permissions against live backend responses

## Next step

For Angular 21 work, start by generating:

1. typed API interfaces from the controllers in this guide,
2. an auth interceptor with refresh-token rotation,
3. a feature-first folder structure for feed, profile, and admin.
