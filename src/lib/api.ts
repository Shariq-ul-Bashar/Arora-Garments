const TOKEN_STORAGE_KEY = 'ag_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      data?: any;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export function formatINR(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
}

export async function downloadInvoicePdf(
  orderIdOrNumber: string,
  mobile?: string,
  fallbackName?: string
): Promise<void> {
  const query = mobile?.trim() ? `?mobile=${encodeURIComponent(mobile.trim())}` : '';
  const url = `/api/orders/${encodeURIComponent(orderIdOrNumber)}/invoice.pdf${query}`;
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Could not download invoice (${res.status}).`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('pdf')) {
    throw new Error('Server returned an unexpected response instead of a PDF invoice.');
  }

  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Generated invoice PDF is empty.');
  }

  let filename = `${fallbackName || orderIdOrNumber}.pdf`;
  const disp = res.headers.get('content-disposition') || '';
  const match = disp.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) {
    filename = match[1];
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

export const DEPARTMENT_LABELS: Record<string, string> = {
  'mens-wear': "Men's Wear",
  'womens-wear': "Women's Wear",
  'kids-wear': 'Kids Wear',
  footwear: 'Footwear',
};

export function paymentMethodLabel(method?: string): string {
  if (method === 'UPI_WHATSAPP') return 'UPI / Pay via WhatsApp';
  if (method === 'WHATSAPP_MANUAL') return 'WhatsApp Order Enquiry';
  if (method === 'COD') return 'Cash on Delivery (COD)';
  return method || 'COD';
}

export function paymentStatusLabel(status?: string): string {
  switch (status) {
    case 'awaiting_payment':
      return 'Awaiting UPI Payment';
    case 'payment_claimed':
      return 'Payment Claimed (Awaiting Verification)';
    case 'under_verification':
      return 'Under Manual Verification';
    case 'paid':
      return 'Paid / Verified';
    case 'collected':
      return 'Collected (COD)';
    case 'rejected':
      return 'Payment Rejected';
    case 'refunded':
      return 'Refunded';
    case 'pending':
      return 'Pending (Pay on Delivery)';
    case 'failed':
      return 'Failed';
    default:
      return status || 'Pending';
  }
}

export function paymentStatusBadgeClass(status?: string): string {
  switch (status) {
    case 'paid':
    case 'collected':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'payment_claimed':
    case 'under_verification':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'awaiting_payment':
    case 'pending':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'rejected':
    case 'failed':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'refunded':
      return 'bg-purple-50 text-purple-800 border-purple-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}
