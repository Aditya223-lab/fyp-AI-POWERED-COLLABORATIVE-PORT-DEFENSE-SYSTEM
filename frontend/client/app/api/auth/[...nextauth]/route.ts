import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
//next auth route for secure authentication and session management in the application, allowing users to sign in and maintain their session across the app. 
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
