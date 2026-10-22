import { describe, expect, it } from 'vitest';
import { buildFeedbackEmail, parseFeedback } from './feedback';

const valid = { category: 'Bug', message: 'The LRM heat looks wrong', contact: 'pilot@example.com', buildUrl: 'https://mw-builder.com/mercs/?b=abc' };

describe('feedback', () => {
  it('acepta un mensaje válido y descarta lo que no encaja', () => {
    expect(parseFeedback(valid)).toEqual(valid);
    expect(parseFeedback({ ...valid, category: 'Spam', buildUrl: 'https://evil.example/' }))
      .toMatchObject({ category: 'Other', buildUrl: '' });
  });

  it('rechaza mensajes vacíos, demasiado largos o con el campo trampa relleno', () => {
    expect(parseFeedback(null)).toBeNull();
    expect(parseFeedback({ ...valid, message: 'hey' })).toBeNull();
    expect(parseFeedback({ ...valid, message: 'x'.repeat(4001) })).toBeNull();
    expect(parseFeedback({ ...valid, website: 'http://spam' })).toBeNull();
  });

  it('no deja añadir cabeceras al correo desde los campos', () => {
    const feedback = parseFeedback({ ...valid, contact: 'a@b.com\r\nBcc: victim@example.com' });
    const email = buildFeedbackEmail(feedback!, 'me@example.com', 'Firefox\r\nX-Evil: 1', new Date('2026-10-22T12:00:00Z'));
    const headers = email.split('\r\n\r\n')[0];

    expect(headers).not.toMatch(/^Bcc:/m);
    expect(headers).not.toMatch(/^X-Evil:/m);
    expect(headers).toContain('To: <me@example.com>');
    expect(headers).toContain('Subject: [MW Builder] Bug');
  });

  it('responde al contacto solo si es un correo', () => {
    const header = (contact: string) => buildFeedbackEmail({ ...valid, contact }, 'me@example.com', '').split('\r\n\r\n')[0];
    expect(header('pilot@example.com')).toContain('Reply-To: <pilot@example.com>');
    expect(header('u/pilot')).not.toContain('Reply-To');
  });
});
