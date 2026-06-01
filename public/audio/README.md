# Trilha por loops (Fase 2 — "Menos é Mais")

Esta pasta é onde moram os **loops de música medieval** que substituem a trilha
generativa (drone de serra + melodia aleatória que soava intrusiva). A infra já
está pronta e ligada por flag — **só faltam os arquivos**.

## Como ligar (passo a passo)

1. **Dropar os `.ogg` aqui** com os nomes exatos abaixo (1 a 6 arquivos).
2. No jogo: **Ajustes (⚙ Mais → Ajustes)** → seção **🎵 Áudio & avisos**:
   - liga **🎼 Música por loops (CC0)**
   - liga **🎵 Música ambiente**
3. Pronto — o loop do mood toca na hora, com reverb do mixer e volume do slider.
   Sem o arquivo de um mood, é **silêncio gracioso** (não quebra nada).

> A música segue **OFF por padrão** (decisão da estabilização). Só liga depois
> que você ouvir e aprovar — você é o ouvido, eu não escuto.

## Arquivos esperados (nomes exatos)

| Arquivo                  | Toca nos moods                                   | Clima                          |
|--------------------------|--------------------------------------------------|--------------------------------|
| `exploration.ogg`        | exploration-calm, travel                         | calmo, "a estrada", leitmotif  |
| `tension.ogg`            | exploration-tension, danger-low-hp               | suspense, perigo à espreita    |
| `combat.ogg`             | combat-skirmish, combat-boss                     | percussivo, urgente            |
| `rest.ogg`               | rest, sacred                                     | sereno, harpa/coral            |
| `mystery.ogg`            | mystery                                          | etéreo, sinos, modal lídio     |
| `tavern.ogg`             | shop, tavern, victory                            | festivo, dança, alaúde         |

Mapeamento em `src/client/audio/loops.ts` (`MOOD_TO_LOOP`). Dá pra começar com
**1 só** (ex: `exploration.ogg`) e ir adicionando — o resto cai em silêncio.

### Requisitos de cada loop
- **Formato `.ogg` (Vorbis)** — leve e toca em todo browser que o jogo suporta.
  (Converte de mp3/wav com `ffmpeg -i in.mp3 -c:a libvorbis -q:a 4 out.ogg`.)
- **Looável de verdade** — começo e fim casam sem "tump" audível. Idealmente
  ~30s–2min. Trilhas que terminam em silêncio/fade quebram a sensação de loop.
- **~1–2 MB cada** (qualidade boa, sem inchar o bundle). `-q:a 4` ≈ 128 kbps.
- **Mixagem com headroom** — não estourar; o jogo soma reverb por cima.

## Onde achar (grátis, zero-budget)

Ordem de preferência por facilidade de licença pra **embutir no app**:

1. **OpenGameArt.org** — filtrar por licença **CC0** (domínio público; sem crédito
   obrigatório) + tag "medieval"/"fantasy"/"loop". Melhor opção pra bundlar sem dor
   de cabeça. <https://opengameart.org/art-search-advanced> (License: CC0).
2. **Incompetech / Kevin MacLeod** — **CC-BY 4.0** (exige crédito). Seção "Medieval".
   Qualidade alta. Se usar, **precisa creditar** (ver abaixo). <https://incompetech.com>
3. **Free Music Archive / ccMixter** — filtrar por **CC0** ou **CC-BY**. Confere a
   licença faixa a faixa.

> ⚠️ **Tabletop Audio** soa ótimo mas a licença é "uso pessoal" — **não** é CC0 e
> não autoriza embutir/redistribuir no app. Evitar pra este uso.

### Se usar CC-BY (ex: Incompetech) — creditar
Adicione o crédito num lugar visível (sugestão: criar um item no **Glossário** ou
uma linha no rodapé/Sobre). Formato típico:

```
Música: "<Título>" por Kevin MacLeod (incompetech.com) — Licença CC BY 4.0
https://creativecommons.org/licenses/by/4.0/
```

Faixas **CC0** não exigem crédito (mas listar a fonte é educado).

## Por que loops e não a trilha generativa?

O motor generativo (`composer`/`instruments`/`theory`) é engenharia competente,
mas o produto soou ruim no 1º contato (random-walk em quintas paralelas, fatiga
em 1 min). Os loops gravados dão timbre real. **O motor generativo continua no
código** — esta trilha por loops é aditiva e opcional (flag). Dá pra A/B testar:
liga/desliga "Música por loops" em Ajustes e compara.
