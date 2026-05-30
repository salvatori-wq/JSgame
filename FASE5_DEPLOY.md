# Fase 5 — Deploy + Keep-alive (botar tudo no ar)

> **Bloqueante**: sem isto, NADA das Fases 1-4 chega no seu celular. O Render
> free não auto-deploya dormindo (foi o que aconteceu com os 8 fixes anteriores
> — `HEAD b86c697` está em `origin/main` mas prod ainda serve o bundle velho
> `index-vi39x_TX.js`).

## 1. Push (precisa do seu OK)

As Fases 1-6 estão commitadas localmente em `main`. Quando você der o OK:

```bash
git push origin main
```

Isso pode (ou não) disparar o auto-deploy do Render. Se NÃO disparar (free pausa
auto-deploy dormindo), faça o passo 2.

## 2. Manual Deploy no Render (garantia)

1. Abra https://dashboard.render.com/web/srv-d8abeurbc2fs73ft0fpg
2. Botão **Manual Deploy** (canto superior direito) → **Deploy latest commit**.
3. Aguarde o build (~2-5 min). O log mostra "Build successful" + "Live".

## 3. Confirmar que subiu (smoke)

```bash
# O bundle hash tem que MUDAR (≠ vi39x_TX):
curl -s https://jsgame-drpe.onrender.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js'

# Providers vivos (Mestre não-mudo):
curl -s https://jsgame-drpe.onrender.com/api/health
```

`/api/health` deve mostrar `hasGemini/hasGroq/...: true` e `activeProvider`
"DungeonMaster". "Mestre mudo" = cold-start (não chave) → espere 1 toque.

## 4. No celular (o que validar)

- O **dado gira no toque** (não congela no "?") — mesmo no 1º acesso frio.
- Menu inferior **WhatsApp**: 🧭 Explorar · 💬 Falar · ⚔ Batalha · 🎲 Dado · ⋯ Mais.
- Em **combate**: ⚔ Atacar dominante sempre visível no rodapé; a luta cabe na tela.
- Tocar a **faixa do PJ** (topo) abre a ficha completa.

## 5. Keep-alive (precisa de você — 1 vez)

Um GitHub Action cron batendo em `/api/health` a cada ~10 min mantém o servidor
quente → dado responde rápido. Grátis e ilimitado (repo público). **Eu não pude
commitar o `.yml` por você**: o token OAuth do CLI não tem o escopo `workflow`
(o GitHub bloqueia criar `.github/workflows/*` sem ele). O arquivo está no seu
worktree local (`.github/workflows/keep-alive.yml`, não rastreado). Duas formas:

**A) Pelo site (mais fácil, 30s):** GitHub → repo → **Add file → Create new file**
→ nome `.github/workflows/keep-alive.yml` → cole o conteúdo abaixo → Commit.
(Commit pela web sempre permite workflow.)

**B) Pelo seu terminal** (suas credenciais têm o escopo):
`git add .github/workflows/keep-alive.yml && git commit -m "ci: keep-alive" && git push`

```yaml
name: keep-alive
on:
  schedule:
    - cron: '*/10 * * * *'   # a cada ~10 min
  workflow_dispatch: {}
concurrency:
  group: keep-alive
  cancel-in-progress: false
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping prod /api/health (acorda o Render free)
        run: |
          URL="https://jsgame-drpe.onrender.com/api/health"
          for i in 1 2 3; do
            code=$(curl -sS -o /tmp/health.json -w '%{http_code}' --max-time 120 "$URL" || echo "000")
            echo "tentativa $i: HTTP $code"
            if [ "$code" = "200" ]; then echo "quente ✅"; head -c 400 /tmp/health.json || true; exit 0; fi
            sleep 20
          done
          echo "::warning::keep-alive sem 200 em 3 tentativas (pode estar acordando)"
```

- Depois: ver os runs em https://github.com/salvatori-wq/JSgame/actions
  (aba Actions → "keep-alive" → "Run workflow" pra testar na hora).

**Garantia extra (opcional, zero custo, SEM precisar do workflow)**: UptimeRobot
ou cron-job.org grátis apontando um monitor HTTP(s) pra
`https://jsgame-drpe.onrender.com/api/health` a cada 5 min. Cobre a folga do
agendador do GitHub (às vezes atrasa). Mais simples que o Action e não exige escopo.
