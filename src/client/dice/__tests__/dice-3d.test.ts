// γ.1 — Tests pras helpers do componente Dado.
// renderDie é DOM-puro, rollAndReveal usa fake timers.
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Antes de importar dice-3d, garantir que matchMedia exista no jsdom.
// jsdom não implementa por default — stub mínimo retornando matches=false.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('renderDie', () => {
  it('cria um element com data-kind e data-value corretos', async () => {
    const { renderDie } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: 18 });
    expect(die.getAttribute('data-kind')).toBe('d20');
    expect(die.getAttribute('data-value')).toBe('18');
    expect(die.classList.contains('die-3d')).toBe(true);
    expect(die.classList.contains('die-d20')).toBe(true);
  });

  it('aplica special class quando passado', async () => {
    const { renderDie } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: 20, special: 'crit' });
    expect(die.classList.contains('die-crit')).toBe(true);
  });

  it('mostra "?" quando value não fornecido', async () => {
    const { renderDie } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    const face = die.querySelector('.die-face');
    expect(face?.textContent).toBe('?');
  });

  it('adiciona aria-label legível pra screen reader', async () => {
    const { renderDie } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: 15 });
    expect(die.getAttribute('aria-label')).toContain('D20');
    expect(die.getAttribute('aria-label')).toContain('15');
  });

  it('inclui die-shadow pseudo-element pra profundidade', async () => {
    const { renderDie } = await import('../dice-3d');
    const die = renderDie({ kind: 'd6', value: 4 });
    expect(die.querySelector('.die-shadow')).not.toBeNull();
  });
});

describe('rollAndReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('seta valor final após duration e chama onDone', async () => {
    const { renderDie, rollAndReveal } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: '?' });
    document.body.appendChild(die);
    const onDone = vi.fn();
    rollAndReveal(die, { final: 17, special: 'success', onDone, durationMs: 500 });

    expect(die.classList.contains('is-rolling')).toBe(true);

    vi.advanceTimersByTime(600);

    expect(die.classList.contains('is-rolling')).toBe(false);
    expect(die.getAttribute('data-value')).toBe('17');
    expect(die.classList.contains('die-success')).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('aplica classe crit no special=crit', async () => {
    const { renderDie, rollAndReveal } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    rollAndReveal(die, { final: 20, special: 'crit', durationMs: 300 });
    vi.advanceTimersByTime(400);
    expect(die.classList.contains('die-crit')).toBe(true);
  });

  it('aplica classe fumble no special=fumble', async () => {
    const { renderDie, rollAndReveal } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    rollAndReveal(die, { final: 1, special: 'fumble', durationMs: 300 });
    vi.advanceTimersByTime(400);
    expect(die.classList.contains('die-fumble')).toBe(true);
  });

  it('ψ.1 — dispara onLand antes de onDone (35% do duration)', async () => {
    const { renderDie, rollAndReveal } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    const order: string[] = [];
    rollAndReveal(die, {
      final: 15,
      durationMs: 1000,
      onLand: () => order.push('land'),
      onDone: () => order.push('done'),
    });
    // Avança 400ms — onLand deve já ter disparado (em 350ms = 35% de 1000)
    vi.advanceTimersByTime(400);
    expect(order).toContain('land');
    expect(order).not.toContain('done');
    // Avança até o fim
    vi.advanceTimersByTime(700);
    expect(order).toEqual(['land', 'done']);
  });

  it('ψ.1 — onLand chamado apenas 1 vez mesmo se finish acionar fallback', async () => {
    const { renderDie, rollAndReveal } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    const onLand = vi.fn();
    rollAndReveal(die, { final: 10, durationMs: 500, onLand });
    vi.advanceTimersByTime(700);
    expect(onLand).toHaveBeenCalledTimes(1);
  });

  it('Ω.1 — respeita prefers-reduced-motion (duração 600ms dramatic)', async () => {
    // Re-mock matchMedia pra retornar matches=true (reduced motion)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    // Garante que body não tem force-motion (default ON, mas em test isolado nada aplicou)
    document.body.classList.remove('force-motion');
    const { renderDie, rollAndReveal, prefersReducedMotion } = await import('../dice-3d');
    expect(prefersReducedMotion()).toBe(true);

    const die = renderDie({ kind: 'd20' });
    const onDone = vi.fn();
    rollAndReveal(die, { final: 12, onDone });
    // Ω.1 — Default 600ms em reduced (dramatic reveal, não fade invisível)
    vi.advanceTimersByTime(700);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Ω.1 — body.force-motion ignora prefers-reduced-motion (anim cinematográfica)', async () => {
    // Re-mock matchMedia pra reduce ATIVO (OS quer reduced)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    document.body.classList.add('force-motion');
    const { prefersReducedMotion } = await import('../dice-3d');
    expect(prefersReducedMotion()).toBe(false);
    document.body.classList.remove('force-motion');
  });

  it('Ω.1 — telemetry hook dispara visual_started + visual_completed', async () => {
    document.body.classList.remove('force-motion');
    const { renderDie, rollAndReveal, setDiceTelemetryHook } = await import('../dice-3d');
    const events: Array<{ kind: string; data?: unknown }> = [];
    setDiceTelemetryHook((kind, data) => events.push({ kind, data }));
    const die = renderDie({ kind: 'd20' });
    rollAndReveal(die, { final: 17, durationMs: 200 });
    vi.advanceTimersByTime(300);
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('dice_roll_visual_started');
    expect(kinds).toContain('dice_roll_visual_completed');
    setDiceTelemetryHook(null);
  });

  it('Ω.1 — re-query face defensive: cria face se foi removida do DOM', async () => {
    document.body.classList.remove('force-motion');
    const { renderDie, rollAndReveal } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: '?' });
    document.body.appendChild(die);
    // Remove face manualmente — simula DOM mutado
    die.querySelector('.die-face')?.remove();
    const onDone = vi.fn();
    rollAndReveal(die, { final: 14, durationMs: 200, onDone });
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(die.getAttribute('data-value')).toBe('14');
    expect(die.querySelector('.die-face')?.textContent).toBe('14');
  });
});

describe('startSpinning / settle / stop (Fase 1 — gira-agora/assenta-depois)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.classList.remove('force-motion');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startSpinning gira AGORA sem valor final (is-rolling + ticks, data-value fica "?")', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: '?' });
    document.body.appendChild(die);
    const handle = startSpinning(die);
    expect(die.classList.contains('is-rolling')).toBe(true);
    expect(handle.done).toBe(false);
    // Após alguns ticks a face mostra um número aleatório (não "?")…
    vi.advanceTimersByTime(130);
    expect(die.querySelector('.die-face')?.textContent).not.toBe('?');
    // …mas o valor final NÃO foi decidido ainda (não assentou).
    expect(die.getAttribute('data-value')).toBe('?');
    handle.stop();
  });

  it('settle assenta no valor final após durationMs e chama onDone', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: '?' });
    document.body.appendChild(die);
    const handle = startSpinning(die);
    const onDone = vi.fn();
    handle.settle(15, { special: 'success', durationMs: 500, onDone });
    // Continua girando durante a aterrissagem.
    expect(die.classList.contains('is-rolling')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(die.classList.contains('is-rolling')).toBe(false);
    expect(die.getAttribute('data-value')).toBe('15');
    expect(die.querySelector('.die-face')?.textContent).toBe('15');
    expect(die.classList.contains('die-success')).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(handle.done).toBe(true);
  });

  it('settle com durationMs=0 revela na hora', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    const handle = startSpinning(die);
    const onDone = vi.fn();
    handle.settle(20, { durationMs: 0, onDone });
    expect(die.getAttribute('data-value')).toBe('20');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(handle.done).toBe(true);
  });

  it('stop aborta o giro e volta o dado pro "?" (watchdog) — nunca congela', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: '?' });
    document.body.appendChild(die);
    const handle = startSpinning(die);
    vi.advanceTimersByTime(130);
    handle.stop();
    expect(die.classList.contains('is-rolling')).toBe(false);
    expect(die.querySelector('.die-face')?.textContent).toBe('?');
    expect(die.getAttribute('data-value')).toBe('?');
    expect(handle.done).toBe(true);
  });

  it('settle após stop é no-op (não revela)', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20', value: '?' });
    const handle = startSpinning(die);
    handle.stop();
    const onDone = vi.fn();
    handle.settle(10, { durationMs: 100, onDone });
    vi.advanceTimersByTime(200);
    expect(onDone).not.toHaveBeenCalled();
    expect(die.getAttribute('data-value')).toBe('?');
  });

  it('settle chamado 2× revela só uma vez (primeiro valor vence)', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    const handle = startSpinning(die);
    const onDone = vi.fn();
    handle.settle(8, { durationMs: 300, onDone });
    handle.settle(12, { durationMs: 300, onDone }); // ignorado — já assentando
    vi.advanceTimersByTime(400);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(die.getAttribute('data-value')).toBe('8');
  });

  it('settle dispara onLand antes de onDone (durante a aterrissagem)', async () => {
    const { renderDie, startSpinning } = await import('../dice-3d');
    const die = renderDie({ kind: 'd20' });
    const handle = startSpinning(die);
    const order: string[] = [];
    handle.settle(15, { durationMs: 1000, onLand: () => order.push('land'), onDone: () => order.push('done') });
    vi.advanceTimersByTime(400); // land a 35% = 350ms
    expect(order).toContain('land');
    expect(order).not.toContain('done');
    vi.advanceTimersByTime(700);
    expect(order).toEqual(['land', 'done']);
  });
});

describe('haptic wrapper', () => {
  it('degrade gracefully sem navigator.vibrate', async () => {
    // Sobrescreve vibrate por função que joga erro (simula browser sem suporte
    // ou permissão negada). Haptic wrapper deve capturar e silenciar.
    const nav = navigator as Navigator & { vibrate?: unknown };
    const orig = nav.vibrate;
    nav.vibrate = () => { throw new Error('vibrate not supported'); };
    try {
      const { hapticTap, hapticCrit, hapticFumble, hapticSuccess } = await import('../../haptic');
      expect(() => hapticTap()).not.toThrow();
      expect(() => hapticCrit()).not.toThrow();
      expect(() => hapticFumble()).not.toThrow();
      expect(() => hapticSuccess()).not.toThrow();
    } finally {
      if (orig !== undefined) {
        nav.vibrate = orig;
      }
    }
  });

  it('chama navigator.vibrate quando disponível', async () => {
    const spy = vi.fn();
    (navigator as Navigator & { vibrate?: unknown }).vibrate = spy;
    // Reset cache do módulo pra pegar enabled fresh
    vi.resetModules();
    const { hapticTap, hapticCrit } = await import('../../haptic');
    hapticTap();
    expect(spy).toHaveBeenCalledWith(20);
    hapticCrit();
    expect(spy).toHaveBeenLastCalledWith([80, 40, 80, 40, 80]);
  });

  it('respeita setHapticEnabled(false) e silencia vibrate', async () => {
    const spy = vi.fn();
    (navigator as Navigator & { vibrate?: unknown }).vibrate = spy;
    vi.resetModules();
    const { hapticTap, setHapticEnabled } = await import('../../haptic');
    setHapticEnabled(false);
    spy.mockClear();
    hapticTap();
    expect(spy).not.toHaveBeenCalled();
    setHapticEnabled(true); // restaura pra outros tests
  });
});
