import { NextResponse } from 'next/server'; // api page integration and usages and changes 
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  deleteUser,
  listUsers,
  setUserPlan,
  type CustomerEntry,
} from '@/lib/userStore';
import type { Plan } from '@/types/next-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const users: CustomerEntry[] = listUsers();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    plan?: Plan;
  } | null;
  if (!body?.email || !body.plan) {
    return NextResponse.json(
      { error: 'email_and_plan_required' },
      { status: 400 },
    );
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (body.plan !== 'free' && body.plan !== 'premium') {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
  }
  setUserPlan(email, body.plan);
  return NextResponse.json({ email, plan: body.plan, ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email_required' }, { status: 400 });
  }
  const removed = deleteUser(email);
  return NextResponse.json({ removed });
}
