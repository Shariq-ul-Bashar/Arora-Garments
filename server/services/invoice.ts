import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { GstCalculationResult } from './gst.ts';

export interface InvoiceOrderData {
  order_number: string;
  invoice_number: string;
  created_at: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string | null;
  shipping_address: {
    address_line?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  billing_address: {
    address_line?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: Array<{
    product_title: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  tax_amount: number;
  gst_breakdown_json?: string | null;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  payment_reference?: string | null;
  is_proforma?: number;
}

export interface InvoiceBusinessSettings {
  brand_name?: string;
  tagline?: string;
  address_line?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  primary_phone?: string;
  secondary_phone?: string;
  gst_enabled?: boolean;
  gstin?: string;
  legal_name?: string;
  seller_state?: string;
  tax_calculation_mode?: 'inclusive' | 'exclusive';
  tax_label?: string;
  footer_note?: string;
  logo_url?: string;
}

function resolveLocalLogoPath(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    const p = path.resolve(process.cwd(), url.slice(1));
    return fs.existsSync(p) ? p : null;
  }
  if (url.startsWith('/assets/')) {
    const p = path.resolve(process.cwd(), 'public', url.slice(1));
    return fs.existsSync(p) ? p : null;
  }
  return null;
}

function formatPaymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending Payment (COD)',
    awaiting_payment: 'Awaiting Payment',
    payment_claimed: 'Payment Claimed (Unverified)',
    under_verification: 'Under Verification',
    paid: 'Paid / Verified',
    collected: 'Collected (COD)',
    rejected: 'Payment Rejected',
    refunded: 'Refunded',
    failed: 'Failed',
  };
  return map[status] || String(status || 'PENDING').toUpperCase();
}

function formatPaymentMethodLabel(method: string): string {
  if (method === 'UPI_WHATSAPP') return 'UPI / WhatsApp';
  if (method === 'WHATSAPP_MANUAL') return 'WhatsApp Order';
  if (method === 'COD') return 'Cash on Delivery (COD)';
  return method || 'COD';
}

function formatDateIST(val: string): string {
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val || '');
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(val || '');
  }
}

export function streamInvoicePdf(
  res: Response,
  order: InvoiceOrderData,
  business: InvoiceBusinessSettings
) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });

  const isPaidOrCollected = ['paid', 'collected'].includes(order.payment_status);
  const hasGstin = Boolean(business.gstin && business.gstin.trim());
  const docTitle = isPaidOrCollected
    ? hasGstin
      ? 'TAX INVOICE'
      : 'RETAIL INVOICE'
    : 'PROFORMA ORDER SUMMARY';
  const filePrefix = isPaidOrCollected
    ? order.invoice_number || order.order_number
    : `PROFORMA-${order.order_number}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}.pdf"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  doc.on('error', (err) => {
    console.error('PDF generation stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    } else {
      res.end();
    }
  });

  doc.pipe(res);

  let headerTopY = 48;
  const logoFile = resolveLocalLogoPath(business.logo_url);
  if (logoFile) {
    try {
      const ext = path.extname(logoFile).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        doc.image(logoFile, 48, 44, { height: 32 });
        headerTopY = 82;
      }
    } catch {
      headerTopY = 48;
    }
  }

  const displayBrand = business.legal_name?.trim() || business.brand_name || 'ARORA GARMENTS';
  const storeSubBrand =
    business.legal_name?.trim() && business.brand_name && business.legal_name.trim() !== business.brand_name
      ? `${business.brand_name} · ${business.tagline || 'ULTIMATE FASHION DESTINATION'}`
      : business.tagline || 'ULTIMATE FASHION DESTINATION';

  if (!logoFile || headerTopY === 48) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827').text(displayBrand, 48, headerTopY, { width: 270 });
    headerTopY = doc.y + 2;
    doc.fontSize(8).font('Helvetica').fillColor('#6B7280').text(storeSubBrand, 48, headerTopY, { width: 270 });
    headerTopY = doc.y + 6;
  } else {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(displayBrand, 48, headerTopY, { width: 270 });
    headerTopY = doc.y + 4;
  }

  const sellerAddress = [
    business.address_line || 'CV59+RH9, Faislabad',
    business.city || 'Bulandshahr',
    `${business.state || 'Uttar Pradesh'} ${business.pincode || '203001'}`,
    business.country || 'India',
  ]
    .filter(Boolean)
    .join(', ');

  const phones = [business.primary_phone, business.secondary_phone].filter(Boolean).join(' | ');

  doc.fontSize(8.5).font('Helvetica').fillColor('#111827').text(sellerAddress, 48, headerTopY, { width: 270 });
  headerTopY = doc.y + 2;
  if (phones) {
    doc.text(`Phone: ${phones}`, 48, headerTopY, { width: 270 });
    headerTopY = doc.y + 2;
  }
  if (hasGstin) {
    doc.font('Helvetica-Bold').text(`GSTIN: ${business.gstin!.trim()}`, 48, headerTopY, { width: 270 });
    headerTopY = doc.y + 2;
  } else if (business.gst_enabled) {
    doc.font('Helvetica').fillColor('#6B7280').text('GSTIN: Not Configured', 48, headerTopY, { width: 270 });
    headerTopY = doc.y + 2;
  }

  // Invoice / Proforma Meta Block (Right)
  doc
    .fontSize(13)
    .font('Helvetica-Bold')
    .fillColor(isPaidOrCollected ? '#111827' : '#9A3412')
    .text(docTitle, 330, 48, { align: 'right', width: 217 });

  let rightY = 72;
  const drawMeta = (txt: string) => {
    doc.fontSize(8.5).font('Helvetica').fillColor('#111827').text(txt, 330, rightY, { align: 'right', width: 217 });
    rightY += 13.5;
  };
  drawMeta(`Invoice No: ${order.invoice_number || order.order_number}`);
  drawMeta(`Order ID: ${order.order_number}`);
  drawMeta(`Order Date: ${formatDateIST(order.created_at)}`);
  drawMeta(`Method: ${formatPaymentMethodLabel(order.payment_method)}`);
  drawMeta(`Payment: ${formatPaymentStatusLabel(order.payment_status)}`);
  if (order.payment_reference) {
    drawMeta(`UTR / Ref: ${order.payment_reference}`);
  }
  const supplyState = order.shipping_address?.state || business.seller_state || business.state || 'Uttar Pradesh';
  drawMeta(`Place of Supply: ${supplyState}`);

  const ruleY = Math.max(168, headerTopY + 10, rightY + 6);
  doc.moveTo(48, ruleY).lineTo(547, ruleY).strokeColor('#E5E7EB').stroke();

  let addrStartY = ruleY + 12;
  if (!isPaidOrCollected) {
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#9A3412')
      .text(
        'NOTE: This document is a Proforma Order Summary issued prior to final payment verification/collection. A verified Retail Invoice is issued once payment is confirmed.',
        48,
        addrStartY,
        { width: 499 }
      );
    addrStartY = doc.y + 10;
  }

  const ship = order.shipping_address || {};
  const bill = order.billing_address || ship;

  // Customer Billing & Shipping
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#6B7280').text('BILLED TO', 48, addrStartY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text(order.customer_name || 'Customer', 48, addrStartY + 14, { width: 225 });
  const billLine1 = [bill.address_line, bill.locality].filter(Boolean).join(', ');
  const billLine2 = [bill.city, bill.state, bill.pincode ? `- ${bill.pincode}` : ''].filter(Boolean).join(', ').replace(', -', ' -');
  doc
    .fontSize(8.5)
    .font('Helvetica')
    .text(`Mobile: ${order.customer_mobile || ''}`, 48, doc.y + 2, { width: 225 })
    .text(billLine1 || '-', 48, doc.y + 2, { width: 225 })
    .text(billLine2 || '-', 48, doc.y + 2, { width: 225 });
  const leftEndY = doc.y;

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#6B7280').text('SHIPPED TO', 310, addrStartY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text(order.customer_name || 'Customer', 310, addrStartY + 14, { width: 235 });
  const shipLine1 = [ship.address_line, ship.locality].filter(Boolean).join(', ');
  const shipLine2 = [ship.city, ship.state, ship.pincode ? `- ${ship.pincode}` : ''].filter(Boolean).join(', ').replace(', -', ' -');
  doc
    .fontSize(8.5)
    .font('Helvetica')
    .text(`Mobile: ${order.customer_mobile || ''}`, 310, doc.y + 2, { width: 235 })
    .text(shipLine1 || '-', 310, doc.y + 2, { width: 235 })
    .text(shipLine2 || '-', 310, doc.y + 2, { width: 235 });
  const rightEndY = doc.y;

  // Table Header
  let y = Math.max(leftEndY, rightEndY) + 18;
  const drawTableHeader = (topY: number) => {
    doc.rect(48, topY, 499, 24).fill('#F3F4F6');
    doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold');
    doc.text('ITEM & VARIANT', 56, topY + 8);
    doc.text('SKU', 250, topY + 8);
    doc.text('QTY', 355, topY + 8, { width: 35, align: 'right' });
    doc.text('RATE (INR)', 400, topY + 8, { width: 65, align: 'right' });
    doc.text('AMOUNT (INR)', 470, topY + 8, { width: 70, align: 'right' });
    return topY + 30;
  };

  y = drawTableHeader(y);

  for (const item of order.items || []) {
    if (y > 685) {
      doc.addPage();
      y = drawTableHeader(48);
    }
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(item.product_title || 'Garment Item', 56, y, { width: 185 });
    const titleBottom = doc.y;
    doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(`Size: ${item.size || '-'} | Color: ${item.color || '-'}`, 56, titleBottom + 1, { width: 185 });
    const variantBottom = doc.y;

    doc.fillColor('#111827').fontSize(8).text(item.sku || '-', 250, y + 2, { width: 100 });
    doc.fontSize(9).text(String(item.quantity || 1), 355, y + 2, { width: 35, align: 'right' });
    doc.text(`Rs. ${Number(item.unit_price || 0).toFixed(2)}`, 400, y + 2, { width: 65, align: 'right' });
    doc.text(`Rs. ${Number(item.line_total || 0).toFixed(2)}`, 470, y + 2, { width: 70, align: 'right' });

    y = Math.max(y + 30, variantBottom + 8);
    doc.moveTo(48, y - 3).lineTo(547, y - 3).strokeColor('#E5E7EB').stroke();
  }

  // Parse GST Breakdown safely (never invent breakdown for legacy orders that have no gst_breakdown_json)
  let gstBreakdown: GstCalculationResult | null = null;
  if (order.gst_breakdown_json) {
    try {
      gstBreakdown = JSON.parse(order.gst_breakdown_json) as GstCalculationResult;
    } catch {
      gstBreakdown = null;
    }
  }

  const taxAmount = Number(order.tax_amount || 0);
  const cgst = Number(order.cgst_amount ?? gstBreakdown?.cgst_amount ?? 0);
  const sgst = Number(order.sgst_amount ?? gstBreakdown?.sgst_amount ?? 0);
  const igst = Number(order.igst_amount ?? gstBreakdown?.igst_amount ?? 0);
  const taxableAmount = Number(order.taxable_amount ?? gstBreakdown?.taxable_amount ?? 0);

  // Estimate space needed for totals + GST block so nothing overflows footer
  const neededHeight = 140 + (gstBreakdown?.rate_breakdown?.length || 0) * 16;
  if (y + neededHeight > 760) {
    doc.addPage();
    y = 48;
  }

  y += 12;

  // Left GST Summary Table (if GST breakdown is available and active)
  const summaryStartY = y;
  if (gstBreakdown && gstBreakdown.gst_enabled && taxAmount > 0) {
    let gstY = summaryStartY;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827').text('GST TAX BREAKDOWN', 48, gstY);
    gstY += 13;
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(
        `${gstBreakdown.tax_calculation_mode === 'inclusive' ? 'Tax-Inclusive Pricing' : 'Tax-Exclusive Pricing'} · ${
          gstBreakdown.supply_type === 'intra_state' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'
        }`,
        48,
        gstY,
        { width: 260 }
      );
    gstY += 14;

    if (gstBreakdown.rate_breakdown && gstBreakdown.rate_breakdown.length > 0) {
      for (const b of gstBreakdown.rate_breakdown) {
        const line =
          gstBreakdown.supply_type === 'intra_state'
            ? `GST ${b.rate}% on Rs. ${b.taxable_amount.toFixed(2)}: CGST Rs. ${b.cgst_amount.toFixed(2)} + SGST Rs. ${b.sgst_amount.toFixed(2)}`
            : `IGST ${b.rate}% on Rs. ${b.taxable_amount.toFixed(2)}: Rs. ${b.igst_amount.toFixed(2)}`;
        doc.fontSize(8).font('Helvetica').fillColor('#374151').text(line, 48, gstY, { width: 265 });
        gstY = doc.y + 3;
      }
    }
  }

  // Right Totals Stack
  const drawTotalRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10.5 : 9).fillColor('#111827');
    doc.text(label, 325, y, { width: 140, align: 'right' });
    doc.text(value, 470, y, { width: 75, align: 'right' });
    y += bold ? 22 : 16;
  };

  drawTotalRow('Items Subtotal:', `Rs. ${Number(order.subtotal || 0).toFixed(2)}`);
  if (Number(order.discount_amount || 0) > 0) {
    drawTotalRow('Discount:', `- Rs. ${Number(order.discount_amount).toFixed(2)}`);
  }

  if (gstBreakdown && gstBreakdown.gst_enabled && taxAmount > 0) {
    drawTotalRow('Taxable Value:', `Rs. ${taxableAmount.toFixed(2)}`);
    if (cgst > 0 || sgst > 0) {
      drawTotalRow('CGST:', `Rs. ${cgst.toFixed(2)}`);
      drawTotalRow('SGST:', `Rs. ${sgst.toFixed(2)}`);
    } else if (igst > 0) {
      drawTotalRow('IGST:', `Rs. ${igst.toFixed(2)}`);
    }
    if (gstBreakdown.tax_calculation_mode === 'inclusive') {
      doc.font('Helvetica').fontSize(7.5).fillColor('#6B7280').text('(GST included in item prices)', 325, y - 3, { width: 220, align: 'right' });
      y += 12;
    }
  } else if (taxAmount > 0) {
    drawTotalRow(business.tax_label || 'Tax:', `Rs. ${taxAmount.toFixed(2)}`);
  }

  drawTotalRow('Shipping:', Number(order.shipping_fee || 0) === 0 ? 'Rs. 0.00 (Free)' : `Rs. ${Number(order.shipping_fee).toFixed(2)}`);

  doc.moveTo(335, y - 2).lineTo(547, y - 2).strokeColor('#111827').stroke();
  y += 5;
  drawTotalRow('Grand Total:', `Rs. ${Number(order.grand_total || 0).toFixed(2)}`, true);

  // Footer Note placed safely below content or at bottom of page
  const footerY = Math.max(y + 24, 735);
  if (footerY > 780) {
    doc.addPage();
  }
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#6B7280')
    .text(
      business.footer_note ||
        'Thank you for shopping with ARORA GARMENTS, Bulandshahr. All prices are in INR.',
      48,
      footerY > 780 ? 735 : footerY,
      { width: 499, align: 'center' }
    );

  doc.end();
}
