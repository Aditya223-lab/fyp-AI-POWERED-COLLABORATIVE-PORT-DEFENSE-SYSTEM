import type { DefaultSession } from 'next-auth';

export type Role = 'admin' | 'customer';
export type Plan = 'free' | 'premium';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      plan: Plan;
    } & DefaultSession['user'];
    /** HS256 JWT minted for the Spring backend. See lib/auth.ts. */
    accessToken?: string;
    /** Unix seconds. When this passes, the client should re-fetch the session. */
    accessTokenExp?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role;
    plan: Plan;
    /** Backend-bound JWT minted in the `jwt` callback. */
    backendToken?: string;
    backendTokenExp?: number;
  }
}
