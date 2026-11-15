import crypto from 'crypto';

export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  return (
    Boolean(keyId) &&
    Boolean(keySecret) &&
    !keyId.includes('YOUR_RAZORPAY') &&
    !keySecret.includes('YOUR_RAZORPAY')
  );
}

export function getRazorpayPublicKey(): string | null {
  return isRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID! : null;
}

export async function createRazorpayOrder(amountInRupees: number, receipt: string) {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay credentials are not configured.');
  }
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amountInRupees * 100),
      currency: 'INR',
      receipt,
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Razorpay order creation failed: ${errText}`);
  }

  return (await response.json()) as {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };
}

export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  if (!isRazorpayConfigured()) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  const generated = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(razorpaySignature));
  } catch {
    return false;
  }
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!webhookSecret || webhookSecret.includes('YOUR_RAZORPAY') || !signature) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
