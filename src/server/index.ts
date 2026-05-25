// JSgame · Server skeleton.
// Express + Socket.io + SQLite. Boot mínimo F1 — health endpoint + character REST.
// F2+ adiciona joinCampaign, DM integration, combat handlers.

import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import {
  initPersistence,
  saveCharacter, loadCharacter, listCharactersByOwner, deleteCharacter,
} from './persistence.js';
import type { ClientToServerEvents, ServerToClientEvents, CharacterSheet } from '../shared/types.js';
import { ALL_CLASSES } from '../dnd/classes.js';
import { ALL_RACES } from '../dnd/races.js';
import { ALL_SKILLS } from '../dnd/skills.js';
import { ALL_CONDITIONS } from '../dnd/conditions.js';

const PORT = parseInt(process.env.SERVER_PORT ?? '3001', 10);

async function main(): Promise<void> {
  await initPersistence();

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // CORS dev (vite proxy cuida em dev; abre pra deploy direto).
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'jsgame',
      uptime: process.uptime(),
      dmProvider: process.env.DM_PROVIDER ?? 'auto',
      hasGroq: !!process.env.GROQ_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    });
  });

  // D&D reference data — cliente fetcha pra char-creation wizard sem hardcode.
  app.get('/api/dnd/races', (_req, res) => { res.json({ races: ALL_RACES }); });
  app.get('/api/dnd/classes', (_req, res) => { res.json({ classes: ALL_CLASSES }); });
  app.get('/api/dnd/skills', (_req, res) => { res.json({ skills: ALL_SKILLS }); });
  app.get('/api/dnd/conditions', (_req, res) => { res.json({ conditions: ALL_CONDITIONS }); });

  // Characters CRUD
  app.get('/api/characters', (req, res) => {
    const owner = String(req.query.owner ?? '').trim();
    if (!owner) { res.status(400).json({ error: 'owner required' }); return; }
    res.json({ characters: listCharactersByOwner(owner) });
  });

  app.get('/api/characters/:id', (req, res) => {
    const sheet = loadCharacter(req.params.id);
    if (!sheet) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ character: sheet });
  });

  app.post('/api/characters', (req, res) => {
    const sheet = req.body as CharacterSheet;
    if (!sheet?.id || !sheet?.ownerName || !sheet?.characterName || !sheet?.classId || !sheet?.raceId) {
      res.status(400).json({ error: 'invalid sheet' });
      return;
    }
    sheet.lastPlayedAt = Date.now();
    saveCharacter(sheet);
    res.json({ ok: true, id: sheet.id });
  });

  app.delete('/api/characters/:id', (req, res) => {
    deleteCharacter(req.params.id);
    res.json({ ok: true });
  });

  // HTTP + Socket.io
  const httpServer = createServer(app);
  const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id);
    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
    });

    // F2+ handlers TBD: joinCampaign, takeAction, combatAction, etc.
    // Placeholder ack genérico:
    socket.on('chat', ({ text }) => {
      io.emit('dmNarration', { text: `Você disse: ${text}`, speaker: 'Eco', mood: 'neutral' });
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`[jsgame] server listening on http://localhost:${PORT}`);
    console.log(`[jsgame] health: http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error('[jsgame] fatal boot error:', err);
  process.exit(1);
});
