import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { setUserPlan } from '@/lib/userStore';
//verifying the payment status with khalti and updating the user plan accordingly in the application.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KHALTI_BASE =
  process.env.NEXT_PUBLIC_KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  if (!process.env.KHALTI_SECRET_KEY) {
    return NextResponse.json(
      { error: 'khalti_not_configured' },
      { status: 500 },
    );
  }

  const { pidx } = (await req.json().catch(() => ({}))) as { pidx?: string };
  if (!pidx) {
    return NextResponse.json({ error: 'missing_pidx' }, { status: 400 });
  }

  const res = await fetch(`${KHALTI_BASE}/epayment/lookup/`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pidx }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: 'khalti_lookup_failed', details: data },
      { status: 502 },
    );
  }

  if (data.status === 'Completed') {
    setUserPlan(session.user.email, 'premium');
    return NextResponse.json({
      ok: true,
      status: 'Completed',
      transaction_id: data.transaction_id,
      amount: data.total_amount,
    });
  }

  return NextResponse.json({
    ok: false,
    status: data.status ?? 'Unknown',
    details: data,
  });
}
