// JSgame · 2B — Helpers de cookie de sessão (extraídos de index.ts).
// Cookie httpOnly SameSite=Lax. Em prod, adiciona Secure.

import type express from 'express';
import type { User } from '../auth.js';

export const SESSION_COOKIE = 'jsg_session';

export interface ExpressReqWithUser extends express.Request {
  user?: User;
}

export function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    if (k === SESSION_COOKIE) {
      const v = pair.slice(eq + 1).trim();
      return decodeURIComponent(v);
    }
  }
  return null;
}

export function buildSessionCookie(token: string, expiresAt: number): string {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const inProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (inProd) parts.push('Secure');
  return parts.join('; ');
}

export function buildLogoutCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

export function getVerifyBaseUrl(req: express.Request): string {
  // Em prod, usa o host da request (Render). Em dev, frontend rodando em :5173 valida via API.
  // PUBLIC_URL pode sobrescrever (útil pra deploy com domínio próprio).
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  const host = req.headers.host;
  return `${proto}://${host}`;
}
