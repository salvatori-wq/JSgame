// JSgame · Login screen — magic link passwordless.
//
// UX:
//   1. Player digita email → click "Enviar link"
//   2. UI mostra "Olha tua caixa de entrada" + tempo de expiração
//   3. Em DEV (sem BREVO_API_KEY), o link aparece direto na tela pra teste
//   4. Player clica link no email → /api/auth/verify?token=X → cookie + redirect
//
// O componente roda standalone (recebe container + onAuthenticated callback).

import { el, escapeHtml } from '../util';
import { requestMagicLink, getMe, type AuthUser } from '../api';

export interface LoginScreenOpts {
  container: HTMLElement;
  onAuthenticated: (user: AuthUser) => void;
  onContinueAnonymous: () => void;
}

export class LoginScreen {
  private opts: LoginScreenOpts;
  private mode: 'form' | 'sent' = 'form';
  private email = '';
  private lastDevLink: string | null = null;
  private lastError: string | null = null;

  constructor(opts: LoginScreenOpts) {
    this.opts = opts;
  }

  start(): void {
    // Se já tem sessão válida, pula direto
    void getMe().then((user) => {
      if (user) this.opts.onAuthenticated(user);
      else this.render();
    }).catch(() => this.render());

    // Detecta auth=success no querystring (vindo do redirect do /verify)
    // → faz refresh do me e dispara onAuthenticated
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      // Limpa querystring sem reload
      window.history.replaceState({}, '', window.location.pathname);
    }
    const err = params.get('auth_error');
    if (err) {
      this.lastError = decodeAuthError(err);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  private render(): void {
    this.opts.container.innerHTML = '';
    const root = el('div', { class: 'login-screen' });

    root.appendChild(el('header', { class: 'login-header' }, [
      el('h1', { class: 'login-title', text: 'JSGAME' }),
      el('span', { class: 'login-diamond', text: '◆' }),
      el('p', { class: 'login-tagline', text: 'D&D 5e Online · Mestre IA · Coop até 3' }),
    ]));

    if (this.mode === 'form') {
      root.appendChild(this.renderForm());
    } else {
      root.appendChild(this.renderSent());
    }

    this.opts.container.appendChild(root);
  }

  private renderForm(): HTMLElement {
    const card = el('section', { class: 'login-card' });

    // POLISH α.1 — "Jogar sem cadastro" agora vem PRIMEIRO, dominante.
    // Antes ficava embaixo do form de email — player que não quer cadastro
    // achava o jogo "trancado". Reorganização inverte a hierarquia:
    // primeiro o caminho rápido (anônimo), depois o caminho persistente (email).
    card.appendChild(el('h2', { class: 'login-h2', text: '⚔ Jogar agora' }));
    card.appendChild(el('p', { class: 'login-intro', text: 'Sem cadastro, sem email, sem espera. Cria PJ, joga, salva no navegador.' }));

    // S3.4 — Botão anon ganha loading state visual ao click.
    // Antes: callback rodava imediato sem feedback — em mobile lento usuário
    // clicava 2x. Agora desabilita + troca texto + adiciona class is-loading.
    // Setattribute disabled + style :disabled (modals.css cuida do visual).
    const anonBtn = el('button', {
      class: 'login-anon-btn cta-glow',
      text: '🎮 Jogar sem cadastro',
      attrs: { type: 'button', title: 'PJs salvos só localmente neste navegador' },
      on: {
        click: () => {
          if (anonBtn.classList.contains('is-loading')) return;
          anonBtn.classList.add('is-loading');
          anonBtn.setAttribute('disabled', 'true');
          anonBtn.textContent = '⏳ Carregando…';
          // Defer pra DOM pintar o loading state antes do callback síncrono
          // disparar o re-render da home.
          requestAnimationFrame(() => this.opts.onContinueAnonymous());
        },
      },
    });
    card.appendChild(anonBtn);

    card.appendChild(el('div', { class: 'login-sep', text: '— ou crie conta pra salvar entre dispositivos —' }));

    card.appendChild(el('h3', { class: 'login-h3', text: '✉ Entrar via email (magic link)' }));

    if (this.lastError) {
      card.appendChild(el('div', { class: 'login-error', text: this.lastError }));
    }

    const input = el('input', {
      class: 'login-email-input',
      attrs: {
        type: 'email',
        placeholder: 'seu@email.com',
        autocomplete: 'email',
        value: this.email,
      },
      on: {
        input: (e) => { this.email = (e.target as HTMLInputElement).value; },
        keydown: (e) => {
          if ((e as KeyboardEvent).key === 'Enter') void this.submit();
        },
      },
    }) as HTMLInputElement;
    card.appendChild(input);

    // T1.3 — Loading state explícito ao submeter (era só disabled silencioso).
    // Mesmo padrão de S3.4: requestAnimationFrame defer pra DOM pintar antes do
    // callback assíncrono. Class `.is-loading` cuida do visual (modals.css).
    const submitBtn = el('button', {
      class: 'login-submit-btn',
      text: '⚔ Enviar link mágico',
      attrs: { type: 'button' },
      on: {
        click: () => {
          if (submitBtn.classList.contains('is-loading')) return;
          submitBtn.classList.add('is-loading');
          submitBtn.setAttribute('disabled', 'true');
          submitBtn.textContent = '⏳ Enviando…';
          requestAnimationFrame(() => void this.submit());
        },
      },
    });
    card.appendChild(submitBtn);

    return card;
  }

  private renderSent(): HTMLElement {
    const card = el('section', { class: 'login-card' });
    card.appendChild(el('h2', { class: 'login-h2', text: '✉ Verifica teu email' }));
    card.appendChild(el('p', { class: 'login-intro' }, [
      el('span', { text: 'Mandamos um link mágico pra ' }),
      el('b', { text: this.email }),
      el('span', { text: '. Click pra entrar — expira em 15min.' }),
    ]));

    if (this.lastDevLink) {
      // DEV mode — sem BREVO_API_KEY, mostra o link direto
      card.appendChild(el('div', { class: 'login-dev-warn' }, [
        el('div', { class: 'ld-title', text: '⚙ MODO DEV — sem BREVO_API_KEY' }),
        el('p', { text: 'Email não foi enviado de verdade. Click aqui:' }),
        el('a', {
          class: 'login-dev-link',
          attrs: { href: this.lastDevLink, target: '_self' },
          text: '🪄 Abrir link de dev',
        }),
      ]));
    }

    card.appendChild(el('button', {
      class: 'login-back-btn',
      text: '← Tentar outro email',
      attrs: { type: 'button' },
      on: { click: () => { this.mode = 'form'; this.lastDevLink = null; this.render(); } },
    }));

    return card;
  }

  private async submit(): Promise<void> {
    const email = this.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.lastError = 'Email inválido';
      this.render();
      return;
    }
    this.lastError = null;
    try {
      const r = await requestMagicLink(email);
      if (!r.ok) {
        this.lastError = r.error ?? 'Erro ao enviar';
        this.render();
        return;
      }
      this.lastDevLink = r.devLink ?? null;
      this.mode = 'sent';
      this.render();
    } catch (err) {
      this.lastError = `Falhou: ${err instanceof Error ? err.message : String(err)}`;
      this.render();
    }
  }
}

function decodeAuthError(reason: string): string {
  switch (reason) {
    case 'missing_token': return 'Link inválido — token faltando';
    case 'token não encontrado': return 'Link inválido — token não encontrado';
    case 'link expirou': return 'Link expirou — pede outro';
    case 'link já usado': return 'Link já foi usado — pede outro';
    case 'server_error': return 'Erro do servidor — tenta de novo';
    default: return `Erro: ${reason}`;
  }
}
