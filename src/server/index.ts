// JSgame · Server.
// Express + Socket.io + SQLite + DM IA + Campaign engine.

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import {
  initPersistence, getDbClient,
  loadCampaign,
} from './persistence.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types.js';
import { Campaign, DungeonMaster, FallbackDM, type DMInterface } from './campaign.js';
import { buildProviderFromEnv } from './dm/providers/factory.js';
import { LobbyManager } from './lobby.js';
import { MemoryStore } from './memory.js';
import { validateSession, cleanupExpiredTokens, type User } from './auth.js';
import { parseSessionCookie, type ExpressReqWithUser } from './http/cookies.js';
import { registerApiRoutes } from './routes/api.js';
import { buildSocketHelpers } from './sockets/helpers.js';
import { registerConnectionHandler } from './sockets/connection.js';

// Render usa PORT (default 10000). Local usa SERVER_PORT (default 3001).
const PORT = parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '3001', 10);

// ════════════════════════════════════════════════════════════════════════════
// DM provider init (1x no boot)
// ════════════════════════════════════════════════════════════════════════════

function buildDM(): DMInterface {
  const provider = buildProviderFromEnv(process.env as Record<string, string | undefined>);
  if (provider) {
    console.log(`[dm] provider ativo: ${provider.name}`);
    // BUG-Ω.4 — Avisos explícitos em PROD pro João detectar fragilidade no boot.
    // Se só 1 provider, não tem fallback se ele falhar (Gemini sem quota = jogo trava).
    const providerCount = provider.name.startsWith('cascade(')
      ? (provider.name.match(/→/g)?.length ?? 0) + 1
      : 1;
    if (providerCount < 3) {
      console.warn(`[dm] ⚠ APENAS ${providerCount} provider(s) no cascade. Recomendado 3+ pra resiliência.`);
      console.warn(`[dm] ⚠ Free tier adicionais: CEREBRAS_API_KEY (Llama 3.3 70B, 1M tok/dia), MISTRAL_API_KEY (Mistral Small, 500K/dia)`);
      console.warn(`[dm] ⚠ Setup: cloud.cerebras.ai (gratuito) + console.mistral.ai (gratuito) → add no Render env vars`);
    }
    return new DungeonMaster(provider);
  }
  console.log('[dm] sem provider — usando FallbackDM offline');
  console.warn('[dm] ⚠ NENHUM provider configurado. Sem GEMINI_API_KEY/GROQ_API_KEY/etc o DM degrada sempre.');
  return new FallbackDM();
}

// ════════════════════════════════════════════════════════════════════════════
// Campaign store em memória (1 campanha por ID)
// ════════════════════════════════════════════════════════════════════════════

const campaigns = new Map<string, Campaign>();
const lobbyManager = new LobbyManager();
let memoryStore: MemoryStore | undefined;

async function getOrCreateCampaign(id: string | undefined, name: string | undefined, dm: DMInterface): Promise<Campaign> {
  if (id && campaigns.has(id)) return campaigns.get(id)!;
  if (id) {
    const persisted = await loadCampaign(id);
    if (persisted) {
      const camp = new Campaign(dm, { id: persisted.id, name: persisted.name, memory: memoryStore });
      camp.state = persisted;
      // Hidrata flags pra evitar disparar startSession outra vez no rejoin
      camp.markStartedIfHasHistory();
      campaigns.set(camp.state.id, camp);
      return camp;
    }
  }
  const camp = new Campaign(dm, { id, name, memory: memoryStore });
  campaigns.set(camp.state.id, camp);
  return camp;
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  await initPersistence();
  memoryStore = new MemoryStore(getDbClient());
  console.log('[memory] RAG store inicializado (FTS5/BM25)');
  const dm = buildDM();

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // CORS — reflete origin (necessário pra cookies httpOnly + credentials).
  // Em dev, frontend (5173) e backend (3001) são origins diferentes;
  // em prod, mesmo host (Express serve static). Wildcard '*' NÃO pode coexistir
  // com credentials=true, então refletimos o Origin da request.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // Auth middleware — popula req.user quando cookie de sessão é válido.
  // Não bloqueia request: rotas anônimas continuam funcionando (compat com
  // ownerName legado). Rotas autenticadas checam req.user explicitamente.
  app.use(async (req, _res, next) => {
    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      try {
        const user = await validateSession(token);
        if (user) (req as ExpressReqWithUser).user = user;
      } catch (err) {
        console.warn('[auth] validateSession falhou:', err);
      }
    }
    next();
  });

  // Cleanup periódico (1x na hora) — tira tokens/sessions expiradas do DB
  setInterval(() => {
    cleanupExpiredTokens().catch((err) => console.warn('[auth] cleanup falhou:', err));
  }, 60 * 60 * 1000);

  // 2B — Routes Express extraídas pra src/server/routes/api.ts
  registerApiRoutes(app, { campaigns, memoryStore, dm });

  // === Static (produção) — serve dist/client buildado pelo Vite
  if (process.env.NODE_ENV === 'production') {
    const staticDir = path.resolve(process.cwd(), 'dist/client');
    console.log(`[jsgame] servindo estático de ${staticDir}`);
    // V.1 — Cache-Control granular pra fechar a janela "deploy demora 1h pra aparecer".
    // Assets hashed (vite gera /assets/index-<hash>.js) → cache forever (immutable).
    // Resto (sw.js, index.html, manifest) → cache curto pra puxar versão nova logo.
    app.use(express.static(staticDir, {
      etag: true,
      setHeaders: (res, filePath) => {
        const lower = filePath.toLowerCase();
        if (lower.includes(`${path.sep}assets${path.sep}`) || lower.includes('/assets/')) {
          // Assets hashed: 1 ano + immutable (hash muda, URL muda)
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (lower.endsWith('sw.js') || lower.endsWith('index.html') || lower.endsWith('manifest.webmanifest')) {
          // Crítico: sw.js precisa atualizar logo (browsers respeitam max-age em SW
          // script). index.html é o entry — sempre fresh garante bundle novo.
          // no-cache obriga browser a revalidar antes de servir.
          res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
        } else {
          // Default (icons SVG etc): 1h
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }));
    // SPA fallback — qualquer rota não-API vai pro index.html (sempre fresh)
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // === HTTP + Socket.io
  const httpServer = createServer(app);
  const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: true, credentials: true }, // reflete origin, permite cookies
  });

  // Socket auth middleware — valida cookie de sessão no handshake e popula socket.data.user.
  // Anônimos passam sem user (compat — features legado funcionam via ownerName).
  io.use(async (socket, next) => {
    const token = parseSessionCookie(socket.handshake.headers.cookie);
    if (token) {
      try {
        const user = await validateSession(token);
        if (user) (socket.data as { user?: User }).user = user;
      } catch (err) {
        console.warn('[socket] validateSession falhou:', err);
      }
    }
    next();
  });

  // 2B — Socket helpers compartilhados (extraídos pra sockets/helpers.ts)
  const helpers = buildSocketHelpers(io);

  // 2B — Connection handler (todos os 24 socket events) extraído pra sockets/connection.ts
  registerConnectionHandler({ io, dm, lobbyManager, campaigns, helpers, getOrCreateCampaign });

  httpServer.listen(PORT, () => {
    console.log(`[jsgame] server listening on http://localhost:${PORT}`);
    console.log(`[jsgame] health: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown — flush DB
  const shutdown = async (sig: string): Promise<void> => {
    console.log(`[jsgame] ${sig} — flush DB e saindo`);
    // Fase 0d — grava as cronicas com save coalescido pendente ANTES de fechar o DB.
    const { flushAllCampaigns } = await import('./campaign-saver.js');
    await flushAllCampaigns();
    const { shutdownPersistence } = await import('./persistence.js');
    await shutdownPersistence();
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
}

main().catch((err) => {
  console.error('[jsgame] fatal boot error:', err);
  process.exit(1);
});
