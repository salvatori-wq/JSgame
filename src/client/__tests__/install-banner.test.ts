// @vitest-environment happy-dom
// Ω.7 — Tests do PWA Install Banner.

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Mock sessionStorage in-memory
  const mem: Record<string, string> = {};
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = String(v); },
    removeItem: (k: string) => { delete mem[k]; },
    clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() { return Object.keys(mem).length; },
  });
});

// Mock matchMedia padrão (não standalone)
function mockMatchMedia(standaloneMatch: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('display-mode: standalone') ? standaloneMatch : false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockUserAgent(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, writable: true, configurable: true });
}

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = '';
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  // CRITICAL: restaura real timers pra não vazar pra outros tests no single fork
  vi.useRealTimers();
});

describe('initInstallBanner', () => {
  it('NÃO renderiza banner em desktop (não mobile UA)', async () => {
    mockMatchMedia(false);
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/120');
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    vi.advanceTimersByTime(4000);
    expect(document.querySelector('.install-banner')).toBeNull();
  });

  it('NÃO renderiza banner em standalone (já instalado)', async () => {
    mockMatchMedia(true);
    mockUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile');
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    vi.advanceTimersByTime(4000);
    expect(document.querySelector('.install-banner')).toBeNull();
  });

  it('renderiza banner em Android fallback após 3s sem beforeinstallprompt', async () => {
    mockMatchMedia(false);
    mockUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile');
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    vi.advanceTimersByTime(3500);
    const banner = document.querySelector('.install-banner');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('data-mode')).toBe('android-fallback');
  });

  it('renderiza banner iOS imediato (sem aguardar beforeinstallprompt)', async () => {
    mockMatchMedia(false);
    mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');
    // document.readyState não controlamos em happy-dom — banner pode disparar via load event
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    // Triggera load
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(100);
    const banner = document.querySelector('.install-banner');
    expect(banner?.getAttribute('data-mode')).toBe('ios');
    expect(banner?.querySelector('.install-banner-sub')?.textContent).toContain('Compartilhar');
  });

  it('NÃO renderiza se dismissed na sessão (sessionStorage)', async () => {
    sessionStorage.setItem('jsgame.installBanner.dismissed', '1');
    mockMatchMedia(false);
    mockUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile');
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    vi.advanceTimersByTime(4000);
    expect(document.querySelector('.install-banner')).toBeNull();
  });

  it('click no dismiss salva flag na session', async () => {
    mockMatchMedia(false);
    mockUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile');
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    vi.advanceTimersByTime(3500);
    const dismissBtn = document.querySelector('.install-banner-dismiss') as HTMLButtonElement | null;
    expect(dismissBtn).not.toBeNull();
    dismissBtn?.click();
    expect(sessionStorage.getItem('jsgame.installBanner.dismissed')).toBe('1');
  });

  it('captura beforeinstallprompt e renderiza modo android (não fallback)', async () => {
    mockMatchMedia(false);
    mockUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile');
    const { initInstallBanner, _resetForTest } = await import('../install-banner');
    _resetForTest();
    initInstallBanner();
    // Simula beforeinstallprompt antes do timeout 3s
    const evt = new Event('beforeinstallprompt') as unknown as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
    (evt as unknown as { preventDefault: () => void }).preventDefault = () => {};
    (evt as unknown as { prompt: () => Promise<void> }).prompt = async () => {};
    (evt as unknown as { userChoice: Promise<{ outcome: string; platform: string }> }).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(evt);
    vi.advanceTimersByTime(100);
    const banner = document.querySelector('.install-banner');
    expect(banner?.getAttribute('data-mode')).toBe('android');
    expect(banner?.querySelector('.install-banner-cta')?.textContent).toContain('Instalar');
  });
});
