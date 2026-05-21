import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
// khalti payment integration via khalti app and stest sandbox
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KHALTI_BASE =
  process.env.NEXT_PUBLIC_KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  if (!process.env.KHALTI_SECRET_KEY) {
    return NextResponse.json(
      {
        error: 'khalti_not_configured',
        hint: 'Set KHALTI_SECRET_KEY in .env.local ',
      },
      { status: 500 },
    );
  }

  const { amount = 99900 } = (await req
    .json()
    .catch(() => ({}))) as { amount?: number };

  const payload = {
    return_url: `${APP_URL}/payment/callback`,
    website_url: APP_URL,
    amount, // paisa: 99900 = NPR 999
    purchase_order_id: `premium-${session.user.email}-${Date.now()}`,
    purchase_order_name: 'PortDefense Premium',
    customer_info: {
      name: session.user.name || 'Customer',
      email: session.user.email,
    },
  };

  const res = await fetch(`${KHALTI_BASE}/epayment/initiate/`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: 'khalti_initiate_failed', details: data },
      { status: 502 },
    );
  }

  return NextResponse.json({
    pidx: data.pidx,
    payment_url: data.payment_url,
    expires_at: data.expires_at,
  });
}
