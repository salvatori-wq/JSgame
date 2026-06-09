// QW-render — pickRenderScheduler: rAF só com página visível.
// Bug descoberto empiricamente no harness (página hidden → rAF suspenso →
// scheduleRender da Fase 0e nunca rodava → ribbon "⏳ Carregando…" eterna,
// dock/chips stale). Hidden não pinta frame, então cair pra setTimeout não
// reintroduz o "piscar" que o coalesce de rAF resolve.

import { describe, it, expect } from 'vitest';
import { pickRenderScheduler } from '../campaign-screen.js';

const raf = (): void => { /* stub rAF */ };

describe('QW-render — pickRenderScheduler', () => {
  it('página visível + rAF disponível → raf (coalesce anti-piscar da Fase 0e)', () => {
    expect(pickRenderScheduler({ visibilityState: 'visible' }, raf)).toBe('raf');
  });

  it('página HIDDEN → timeout mesmo com rAF (rAF suspenso não dispararia)', () => {
    expect(pickRenderScheduler({ visibilityState: 'hidden' }, raf)).toBe('timeout');
  });

  it('sem rAF no ambiente → timeout', () => {
    expect(pickRenderScheduler({ visibilityState: 'visible' }, undefined)).toBe('timeout');
  });

  it('sem document (ambiente raro) + rAF → raf', () => {
    expect(pickRenderScheduler(undefined, raf)).toBe('raf');
  });

  it('visibilityState exótico (prerender) NÃO é hidden → raf', () => {
    expect(pickRenderScheduler({ visibilityState: 'prerender' }, raf)).toBe('raf');
  });
});
