import crypto from 'crypto';
import { db } from '../db.ts';

export function isWhatsAppCloudConfigured(): boolean {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  return (
    Boolean(token) &&
    Boolean(phoneId) &&
    !token.includes('YOUR_META_WHATSAPP') &&
    !phoneId.includes('YOUR_WHATSAPP_PHONE')
  );
}

export async function sendWhatsAppNotification(
  recipientMobile: string,
  messageText: string,
  templateName?: string
): Promise<{ sent: boolean; provider: string; error?: string }> {
  const cleanedPhone = recipientMobile.replace(/[^\d]/g, '');
  const e164 = cleanedPhone.startsWith('91') ? cleanedPhone : `91${cleanedPhone.slice(-10)}`;

  const notifId = crypto.randomUUID();
  if (!isWhatsAppCloudConfigured()) {
    db.prepare(
      'INSERT INTO notifications (id, channel, recipient, subject, message, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(notifId, 'whatsapp', e164, templateName || 'order_update', messageText, 'queued', JSON.stringify({ configured: false }));
    return { sent: false, provider: 'unconfigured' };
  }

  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_ACCESS_TOKEN!;

    const payload = templateName
      ? {
          messaging_product: 'whatsapp',
          to: e164,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: e164,
          type: 'text',
          text: { body: messageText },
        };

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      db.prepare(
        'INSERT INTO notifications (id, channel, recipient, subject, message, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(notifId, 'whatsapp', e164, templateName || 'order_update', messageText, 'failed', JSON.stringify(data));
      return { sent: false, provider: 'whatsapp_cloud', error: JSON.stringify(data) };
    }

    db.prepare(
      'INSERT INTO notifications (id, channel, recipient, subject, message, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(notifId, 'whatsapp', e164, templateName || 'order_update', messageText, 'sent', JSON.stringify(data));

    return { sent: true, provider: 'whatsapp_cloud' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    db.prepare(
      'INSERT INTO notifications (id, channel, recipient, subject, message, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(notifId, 'whatsapp', e164, templateName || 'order_update', messageText, 'failed', JSON.stringify({ error: msg }));
    return { sent: false, provider: 'whatsapp_cloud', error: msg };
  }
}
