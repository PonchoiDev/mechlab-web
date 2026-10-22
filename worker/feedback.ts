// Mensajes de la web enviados por correo con Cloudflare Email Routing. La dirección de destino es
// un secreto del Worker (FEEDBACK_TO), así que no aparece ni en la web ni en el código.
export const FEEDBACK_PATH = '/mercs/api/feedback';

export const FROM_ADDRESS = 'feedback@mw-builder.com';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_FIELD_LENGTH = 300;
const MAX_URL_LENGTH = 2000;
export const FEEDBACK_CATEGORIES = ['Bug', 'Wrong game data', 'Idea', 'Other'] as const;

export interface FeedbackInput {
  category: string;
  message: string;
  contact: string;
  buildUrl: string;
}

// Quita los saltos de línea de lo que va en cabeceras, para que nadie pueda añadir cabeceras propias.
const singleLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

// Solo se adjuntan enlaces de la propia web (o de sus vistas previas).
const isSiteUrl = (value: string) => {
  try {
    const { hostname } = new URL(value);
    return hostname === 'mw-builder.com' || hostname.endsWith('.mw-builder.com') || hostname === 'localhost';
  } catch {
    return false;
  }
};

// Valida el cuerpo de la petición. Devuelve null si no es válido o si se rellenó el campo trampa
// (website), que solo ven los bots.
export const parseFeedback = (body: unknown): FeedbackInput | null => {
  if (typeof body !== 'object' || body === null) return null;
  const { category, message, contact, buildUrl, website } = body as Record<string, unknown>;
  if (typeof website === 'string' && website !== '') return null;
  if (typeof message !== 'string' || message.trim().length < 5 || message.length > MAX_MESSAGE_LENGTH) return null;

  const field = (value: unknown, max = MAX_FIELD_LENGTH) => typeof value === 'string' ? singleLine(value).slice(0, max) : '';
  const chosen = field(category);
  const url = field(buildUrl, MAX_URL_LENGTH);
  return {
    category: (FEEDBACK_CATEGORIES as readonly string[]).includes(chosen) ? chosen : 'Other',
    message: message.trim(),
    contact: field(contact),
    buildUrl: isSiteUrl(url) ? url : ''
  };
};

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export const buildFeedbackEmail = (feedback: FeedbackInput, to: string, userAgent: string, date = new Date()): string => {
  const replyTo = EMAIL_PATTERN.test(feedback.contact) ? [`Reply-To: <${feedback.contact}>`] : [];
  const body = [
    `Category: ${feedback.category}`,
    `Contact: ${feedback.contact || '(none)'}`,
    `Build: ${feedback.buildUrl || '(none)'}`,
    `Browser: ${singleLine(userAgent) || '(unknown)'}`,
    '',
    feedback.message
  ].join('\r\n');

  return [
    `From: MW Builder <${FROM_ADDRESS}>`,
    `To: <${to}>`,
    ...replyTo,
    `Subject: [MW Builder] ${feedback.category}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@mw-builder.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body.replace(/\r?\n/g, '\r\n')
  ].join('\r\n');
};

