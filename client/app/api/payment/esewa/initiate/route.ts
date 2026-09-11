import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { createPayment } from '@/lib/paymentStore';
import {
  ESEWA_FORM_URL,
  ESEWA_PRODUCT_CODE,
  PREMIUM_PRICE_NPR,
  esewaSign,
} from '@/lib/esewa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Starts an eSewa checkout for the signed-in user. The price is fixed
// server-side and the transaction is recorded against the session email, so
// verification later can only upgrade the account that actually paid.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const totalAmount = PREMIUM_PRICE_NPR;
  const transactionUuid = crypto.randomUUID();
  createPayment(transactionUuid, session.user.email, totalAmount);

  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const signature = esewaSign(
    `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_PRODUCT_CODE}`,
  );

  // The client submits these as a plain HTML form POST to eSewa.
  return NextResponse.json({
    action: ESEWA_FORM_URL,
    fields: {
      amount: String(totalAmount),
      tax_amount: '0',
      total_amount: String(totalAmount),
      transaction_uuid: transactionUuid,
      product_code: ESEWA_PRODUCT_CODE,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: `${APP_URL}/payment/callback`,
      failure_url: `${APP_URL}/pricing?payment=failed`,
      signed_field_names: signedFieldNames,
      signature,
    },
  });
}
