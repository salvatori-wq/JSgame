// JSgame · Email sender via Brevo HTTP API.
// Zero deps novas — usa global fetch nativo do Node 18+.
//
// Setup zero-budget:
// 1. Criar conta gratuita brevo.com (sem cartão necessário)
// 2. Dashboard → SMTP & API → Generate new API key
// 3. Setar BREVO_API_KEY no .env / Render env vars
// 4. Setar BREVO_SENDER_EMAIL (precisa estar verified no Brevo: senders & IP)
//    Default: usa um placeholder; ajustar pra email próprio do dev/produção
//
// Free tier: 300 emails/dia, 9k/mês. Suficiente pra MVP coop pequeno.
// Se BREVO_API_KEY ausente, modo DEV: console.log o link em vez de enviar.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface SendEmailOpts {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailSendResult {
  ok: boolean;
  mode: 'sent' | 'dev-log' | 'failed';
  messageId?: string;
  error?: string;
}

/**
 * Envia email via Brevo. Em DEV (sem BREVO_API_KEY), apenas loga no console
 * — útil pra testar magic link localmente sem configurar nada.
 */
export async function sendEmail(opts: SendEmailOpts): Promise<EmailSendResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || 'noreply@jsgame.local';
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'JSgame';

  if (!apiKey) {
    // DEV: imprime no console pra dev poder copiar manualmente
    console.log('[email DEV] —————————————————————————————————————————');
    console.log(`[email DEV] Para: ${opts.to}`);
    console.log(`[email DEV] Subject: ${opts.subject}`);
    console.log(`[email DEV] HTML:\n${opts.htmlContent}`);
    console.log('[email DEV] —————————————————————————————————————————');
    console.log('[email DEV] Setar BREVO_API_KEY pra enviar de verdade.');
    return { ok: true, mode: 'dev-log' };
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: opts.to, name: opts.toName ?? opts.to.split('@')[0] }],
        subject: opts.subject,
        htmlContent: opts.htmlContent,
        textContent: opts.textContent ?? stripHtml(opts.htmlContent),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.warn(`[email] Brevo ${res.status}: ${errText.slice(0, 200)}`);
      return { ok: false, mode: 'failed', error: `${res.status} ${errText.slice(0, 100)}` };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, mode: 'sent', messageId: (data as { messageId?: string }).messageId };
  } catch (err) {
    console.warn('[email] envio falhou:', err);
    return { ok: false, mode: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Template HTML pra magic link de login. Tom D&D sombrio leve, sem floreio.
 */
export function buildMagicLinkEmail(opts: { email: string; verifyUrl: string; expiresMin: number }): SendEmailOpts {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>JSgame · Acesso</title></head>
<body style="font-family: 'Trebuchet MS', sans-serif; background: #181410; color: #e6d4a8; padding: 24px; max-width: 560px; margin: 0 auto;">
  <h1 style="color: #f4d07f; font-size: 22px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 18px;">⚔ JSGAME</h1>
  <p style="font-size: 15px; line-height: 1.5; color: #d6c7a3;">
    Alguém pediu acesso à conta <b>${escapeHtml(opts.email)}</b>. Se foi você, click no link abaixo.
    Expira em <b>${opts.expiresMin} minutos</b>.
  </p>
  <p style="margin: 26px 0;">
    <a href="${escapeAttr(opts.verifyUrl)}"
       style="display: inline-block; background: #b87828; color: #181410; padding: 12px 22px; border-radius: 4px;
              text-decoration: none; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">
      ⚔ Entrar na crônica
    </a>
  </p>
  <p style="font-size: 12px; color: #948566; margin-top: 28px;">
    Se você não pediu isso, ignora — o link expira sozinho. Ninguém entra na sua conta sem clicar aqui.
  </p>
  <hr style="border: 0; border-top: 1px solid #3a2d1c; margin: 24px 0;">
  <p style="font-size: 11px; color: #6e5e44; font-family: monospace;">
    Link: ${escapeHtml(opts.verifyUrl)}
  </p>
</body></html>`;

  return {
    to: opts.email,
    subject: 'JSgame · Seu link de acesso',
    htmlContent: html,
    textContent: `JSgame — Acesso solicitado pra ${opts.email}.\n\nLink (expira em ${opts.expiresMin}min):\n${opts.verifyUrl}\n\nSe não foi você, ignora.`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }
