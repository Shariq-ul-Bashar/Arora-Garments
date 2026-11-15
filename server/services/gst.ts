export interface GstInvoiceSettings {
  gst_enabled?: boolean;
  gstin?: string;
  legal_name?: string;
  seller_state?: string;
  default_gst_rate?: number;
  tax_rate_percent?: number;
  tax_calculation_mode?: 'inclusive' | 'exclusive';
  tax_label?: string;
  return_window_days?: number;
  footer_note?: string;
}

export interface GstLineInput {
  title: string;
  quantity: number;
  line_total: number;
  gst_rate?: number | null;
}

export interface GstRateBucket {
  rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
}

export interface GstCalculationResult {
  gst_enabled: boolean;
  tax_calculation_mode: 'inclusive' | 'exclusive';
  supply_type: 'intra_state' | 'inter_state';
  seller_state: string;
  customer_state: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  grand_total: number;
  rate_breakdown: GstRateBucket[];
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function normalizeState(val?: string | null): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function calculateOrderGst(params: {
  items: GstLineInput[];
  discountAmount?: number;
  shippingFee?: number;
  customerState?: string | null;
  invoiceSettings?: GstInvoiceSettings | null;
}): GstCalculationResult {
  const settings = params.invoiceSettings || {};
  const subtotal = round2(params.items.reduce((s, it) => s + Number(it.line_total || 0), 0));
  const discountAmount = round2(Math.min(subtotal, Math.max(0, Number(params.discountAmount || 0))));
  const shippingFee = round2(Math.max(0, Number(params.shippingFee || 0)));
  const netItemsTotal = round2(Math.max(0, subtotal - discountAmount));

  const defaultRate = Math.max(0, Number(settings.default_gst_rate ?? settings.tax_rate_percent ?? 0));
  const gstEnabled =
    settings.gst_enabled !== undefined
      ? Boolean(settings.gst_enabled)
      : defaultRate > 0 || params.items.some((it) => Number(it.gst_rate || 0) > 0);

  const mode: 'inclusive' | 'exclusive' =
    settings.tax_calculation_mode === 'exclusive' ? 'exclusive' : 'inclusive';

  const sellerState = (settings.seller_state || 'Uttar Pradesh').trim();
  const customerState = (params.customerState || sellerState).trim();
  const isIntraState =
    !customerState || normalizeState(customerState) === normalizeState(sellerState);
  const supplyType: 'intra_state' | 'inter_state' = isIntraState ? 'intra_state' : 'inter_state';

  if (!gstEnabled || netItemsTotal <= 0) {
    return {
      gst_enabled: false,
      tax_calculation_mode: mode,
      supply_type: supplyType,
      seller_state: sellerState,
      customer_state: customerState,
      subtotal,
      discount_amount: discountAmount,
      shipping_fee: shippingFee,
      taxable_amount: netItemsTotal,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      tax_amount: 0,
      grand_total: round2(netItemsTotal + shippingFee),
      rate_breakdown: [],
    };
  }

  // Group net item values by applicable GST rate
  const bucketTotals = new Map<number, number>();
  let allocatedNet = 0;

  params.items.forEach((item, idx) => {
    const lineRaw = Number(item.line_total || 0);
    let netLine: number;
    if (idx === params.items.length - 1) {
      netLine = round2(Math.max(0, netItemsTotal - allocatedNet));
    } else if (subtotal > 0) {
      netLine = round2((lineRaw / subtotal) * netItemsTotal);
      allocatedNet = round2(allocatedNet + netLine);
    } else {
      netLine = 0;
    }

    const rate =
      item.gst_rate !== undefined && item.gst_rate !== null && !Number.isNaN(Number(item.gst_rate))
        ? Math.max(0, Number(item.gst_rate))
        : defaultRate;
    bucketTotals.set(rate, round2((bucketTotals.get(rate) || 0) + netLine));
  });

  const rateBreakdown: GstRateBucket[] = [];
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;

  for (const [rate, netAmount] of Array.from(bucketTotals.entries()).sort((a, b) => a[0] - b[0])) {
    if (netAmount <= 0) continue;
    let taxable = netAmount;
    let tax = 0;

    if (rate > 0) {
      if (mode === 'inclusive') {
        taxable = round2(netAmount / (1 + rate / 100));
        tax = round2(netAmount - taxable);
      } else {
        taxable = round2(netAmount);
        tax = round2((taxable * rate) / 100);
      }
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (tax > 0) {
      if (isIntraState) {
        cgst = round2(tax / 2);
        sgst = round2(tax - cgst);
      } else {
        igst = tax;
      }
    }

    rateBreakdown.push({
      rate,
      taxable_amount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      tax_amount: tax,
    });

    totalTaxable = round2(totalTaxable + taxable);
    totalCgst = round2(totalCgst + cgst);
    totalSgst = round2(totalSgst + sgst);
    totalIgst = round2(totalIgst + igst);
    totalTax = round2(totalTax + tax);
  }

  const grandTotal =
    mode === 'exclusive'
      ? round2(netItemsTotal + totalTax + shippingFee)
      : round2(netItemsTotal + shippingFee);

  return {
    gst_enabled: true,
    tax_calculation_mode: mode,
    supply_type: supplyType,
    seller_state: sellerState,
    customer_state: customerState,
    subtotal,
    discount_amount: discountAmount,
    shipping_fee: shippingFee,
    taxable_amount: totalTaxable,
    cgst_amount: totalCgst,
    sgst_amount: totalSgst,
    igst_amount: totalIgst,
    tax_amount: totalTax,
    grand_total: grandTotal,
    rate_breakdown: rateBreakdown,
  };
}
