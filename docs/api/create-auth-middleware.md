# createAuthMiddleware

Creates Express middleware that verifies JWTs and builds the `GatewayContext` attached to each request.

## Signature

```ts
function createAuthMiddleware(config: AuthConfig): RequestHandler
```

## Parameters

### `config.secret`

- **Type:** `Uint8Array | string`
- **Required:** Yes

The JWT signing secret. If a string is provided, it's encoded to `Uint8Array` using `TextEncoder`.

### `config.extractToken`

- **Type:** `(req: Request) => string | null`
- **Required:** No
- **Default:** Extracts from `Authorization: Bearer <token>` header

Custom function to extract the JWT from the request. Use this for cookies, custom headers, or query parameters.

## GatewayContext

On successful verification, the middleware attaches `req.ctx`:

```ts
interface GatewayContext {
  userId: string;    // From JWT claim
  tenantId: string;  // From JWT claim
  roles: string[];   // From JWT claim (defaults to [])
}
```

## JWT Claims

The middleware expects these JWT claims:

| Claim | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | Unique user identifier |
| `tenantId` | `string` | Yes | Tenant for multi-tenant isolation |
| `roles` | `string[]` | No | User roles (defaults to `[]`) |

## Error Responses

| Status | Error | When |
|--------|-------|------|
| `401` | `Missing authentication token` | No token in request |
| `401` | `Invalid token: missing userId or tenantId` | Token valid but missing required claims |
| `401` | `Invalid or expired token` | Token verification failed |

## Examples

### Default (Bearer Token)

```ts
const auth = createAuthMiddleware({
  secret: process.env.JWT_SECRET!,
});

app.use('/api/gateway', auth, gateway);
```

### Cookie-Based Auth

```ts
const auth = createAuthMiddleware({
  secret: process.env.JWT_SECRET!,
  extractToken: (req) => req.cookies?.token ?? null,
});
```

### Custom Header

```ts
const auth = createAuthMiddleware({
  secret: process.env.JWT_SECRET!,
  extractToken: (req) => req.headers['x-api-key'] as string ?? null,
});
```

### Generating Tokens

The gateway expects standard JWTs. Here's how to create one with the `jose` library:

```ts
import { SignJWT } from 'jose';

const token = await new SignJWT({
  userId: user.id,
  tenantId: user.tenantId,
  roles: user.roles,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
```
