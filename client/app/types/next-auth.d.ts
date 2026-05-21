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
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role;
    plan: Plan;
  }
}
