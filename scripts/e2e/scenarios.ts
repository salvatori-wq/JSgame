// Sprint B — E2E smoke scenarios definitions.
// Cada cenário é declarativo: id, name, steps, expectations.
// Implementação concreta no runner pode usar Chrome MCP, Playwright, ou curl + socket-client.
//
// Princípio: cenário descreve INTENÇÃO + ASSERTS, não comandos específicos do driver.
// Isso permite trocar driver (Chrome MCP → Playwright) sem reescrever scenarios.

export type Severity = 'smoke' | 'stress' | 'edge';

export interface ScenarioStep {
  action: string;       // o que fazer (humano-legível, ex: "navigate to /")
  evidence?: string;    // o que coletar pra report (screenshot, log, snapshot)
}

export interface ScenarioExpectation {
  assertion: string;    // o que esperar (ex: "DOM contains '<strong>'")
  failureSeverity: 'blocker' | 'major' | 'minor';
}

export interface Scenario {
  id: string;
  name: string;
  severity: Severity;
  prerequisites?: string[];   // estados pré-rodada (ex: "no active session in localStorage")
  steps: ScenarioStep[];
  expectations: ScenarioExpectation[];
  estimatedDurationSec: number;
  notes?: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'smoke-1',
    name: 'Onboarding novo player',
    severity: 'smoke',
    prerequisites: ['localStorage clean', 'no characters in DB for ownerName "TestE2E"'],
    steps: [
      { action: 'navigate to /' },
      { action: 'click "Criar personagem"' },
      { action: 'preencher 5 steps wizard (humano genérico, mago)' },
      { action: 'click "Iniciar crônica"' },
      { action: 'aguardar narração inicial' },
      { action: 'snapshot DOM + screenshot', evidence: 'screenshot' },
    ],
    expectations: [
      { assertion: 'wizard completou sem erro de validação', failureSeverity: 'blocker' },
      { assertion: 'DM respondeu em <30s', failureSeverity: 'major' },
      { assertion: 'cena tem .scene-description preenchida', failureSeverity: 'blocker' },
      { assertion: 'sidebar mostra PJ com HP 8 (mago humano nv 1)', failureSeverity: 'major' },
    ],
    estimatedDurationSec: 120,
  },
  {
    id: 'smoke-2',
    name: 'Rejoin sessão após reload',
    severity: 'smoke',
    prerequisites: ['smoke-1 completed (active session in localStorage)'],
    steps: [
      { action: 'F5 / page reload' },
      { action: 'aguardar campaign-screen carregar' },
      { action: 'snapshot DOM' },
    ],
    expectations: [
      { assertion: 'campaign-screen.ts renderizou direto (sem voltar pro home)', failureSeverity: 'blocker' },
      { assertion: 'narrações anteriores preservadas no log', failureSeverity: 'major' },
      { assertion: 'sheet do PJ restored idêntica', failureSeverity: 'blocker' },
    ],
    estimatedDurationSec: 30,
  },
  {
    id: 'smoke-3',
    name: 'Coop 2 players no mesmo lobby',
    severity: 'smoke',
    prerequisites: ['2 personagens em 2 browser tabs distintas'],
    steps: [
      { action: 'tab1: criar lobby, copiar invite code' },
      { action: 'tab2: usar invite code pra entrar' },
      { action: 'aguardar lobby ter 2 players' },
      { action: 'tab1: iniciar campanha' },
      { action: 'tab2 deve receber state update' },
    ],
    expectations: [
      { assertion: 'ambas tabs veem mesmo state.party (2 PJs)', failureSeverity: 'blocker' },
      { assertion: 'ambas tabs sincronizam narration', failureSeverity: 'major' },
      { assertion: 'socket reconnect funcional', failureSeverity: 'major' },
    ],
    estimatedDurationSec: 180,
    notes: 'Requer 2 sessões browser separadas. Driver simples: 2x curl + 2x socket-io-client.',
  },
  {
    id: 'smoke-4',
    name: 'Combat full cycle (start → win)',
    severity: 'smoke',
    prerequisites: ['active campaign in exploration mode'],
    steps: [
      { action: 'player action: "atacar o goblin"' },
      { action: 'DM deve disparar tool start_combat' },
      { action: 'no combat-screen, click attack até vencer' },
      { action: 'aguardar mode voltar pra exploration' },
    ],
    expectations: [
      { assertion: 'mode transiciona exploration → combat → exploration', failureSeverity: 'blocker' },
      { assertion: 'XP awarded ao PJ', failureSeverity: 'major' },
      { assertion: 'inventory pode ter loot adicionado', failureSeverity: 'minor' },
    ],
    estimatedDurationSec: 240,
  },
  {
    id: 'smoke-5',
    name: 'Death → tombstone gravado',
    severity: 'smoke',
    prerequisites: ['PJ com HP baixo'],
    steps: [
      { action: 'forçar 3 death save fails (mock RNG ou stub server)' },
      { action: 'aguardar character_died telemetria' },
      { action: 'GET /api/tombstones?ownerName=X' },
    ],
    expectations: [
      { assertion: 'tombstone aparece com cause + party + lastScene', failureSeverity: 'blocker' },
      { assertion: 'character_died event registered em metrics_events', failureSeverity: 'major' },
      { assertion: 'campaign acaba/pausa', failureSeverity: 'blocker' },
    ],
    estimatedDurationSec: 90,
  },
  {
    id: 'smoke-6',
    name: 'Rest cycle (long rest restaura tudo)',
    severity: 'smoke',
    prerequisites: ['PJ com HP gasto + spell slots usados'],
    steps: [
      { action: 'player action: "descansar 8 horas"' },
      { action: 'DM deve disparar long_rest tool' },
    ],
    expectations: [
      { assertion: 'HP volta pra maxHp', failureSeverity: 'blocker' },
      { assertion: 'todos spell slots used → 0', failureSeverity: 'blocker' },
      { assertion: 'hit dice regenera metade do max', failureSeverity: 'major' },
      { assertion: 'exhaustion -1 se > 0', failureSeverity: 'minor' },
    ],
    estimatedDurationSec: 60,
  },
  {
    id: 'smoke-7',
    name: 'Auto-recap em sessão 2',
    severity: 'smoke',
    prerequisites: ['campanha com 2+ memory_facts já salvos'],
    steps: [
      { action: 'reload página' },
      { action: 'click "Continuar crônica"' },
      { action: 'capturar narração inicial' },
    ],
    expectations: [
      { assertion: 'narração contém substring "Anteriormente" ou "Última vez"', failureSeverity: 'major' },
      { assertion: 'narração menciona pelo menos 1 fact relevante', failureSeverity: 'major' },
      { assertion: 'tempo de carregamento < 5s', failureSeverity: 'minor' },
    ],
    estimatedDurationSec: 60,
  },
  {
    id: 'smoke-8',
    name: 'Counterspell mecânico',
    severity: 'smoke',
    prerequisites: ['PJ mago nv 5+ com spell slot 3 disponível', 'combat ativo'],
    steps: [
      { action: 'enemy_casts triggerado' },
      { action: 'modal de counterspell deve aparecer' },
      { action: 'click "Contrasselar (slot 3)"' },
    ],
    expectations: [
      { assertion: 'modal aparece em < 3s', failureSeverity: 'blocker' },
      { assertion: 'pendingEnemySpell.cancelled = true', failureSeverity: 'blocker' },
      { assertion: 'dano da spell inimiga NÃO aplicado', failureSeverity: 'blocker' },
      { assertion: 'slot 3 do mago consumido', failureSeverity: 'major' },
    ],
    estimatedDurationSec: 90,
  },
  {
    id: 'smoke-9',
    name: 'Delete crônica via UI',
    severity: 'smoke',
    prerequisites: ['1 crônica antiga em home (não a ativa)'],
    steps: [
      { action: 'navigate to /' },
      { action: 'localizar crônica antiga + botão 🗑' },
      { action: 'click 🗑' },
      { action: 'confirm dialog' },
      { action: 'GET /api/campaigns/recent?ownerName=X' },
    ],
    expectations: [
      { assertion: 'crônica sumiu da home', failureSeverity: 'blocker' },
      { assertion: '/api/campaigns/recent não retorna ela', failureSeverity: 'blocker' },
      { assertion: 'memory_facts dela foram limpos (cascade)', failureSeverity: 'major' },
      { assertion: 'PJ permanece intacto (não foi deletado junto)', failureSeverity: 'blocker' },
    ],
    estimatedDurationSec: 30,
  },
  {
    id: 'smoke-10',
    name: 'Markdown render no narration log',
    severity: 'smoke',
    prerequisites: ['campanha ativa', 'forçar DM a usar **bold**, *italic*, `code`'],
    steps: [
      { action: 'player action que provoca DM usar emphasis (ex: "leia o pergaminho")' },
      { action: 'aguardar narration' },
      { action: 'querySelector .narration-text strong, em, code' },
    ],
    expectations: [
      { assertion: 'DOM contém <strong> tags renderizadas', failureSeverity: 'major' },
      { assertion: 'DOM contém <em> tags renderizadas', failureSeverity: 'major' },
      { assertion: 'sem <script> tag em nenhum lugar', failureSeverity: 'blocker' },
    ],
    estimatedDurationSec: 60,
  },
];

export interface ScenarioResult {
  scenarioId: string;
  passed: boolean;
  durationMs: number;
  expectationResults: Array<{ assertion: string; passed: boolean; evidence?: string }>;
  error?: string;
}

export interface SuiteSummary {
  startedAt: number;
  endedAt: number;
  totalScenarios: number;
  passed: number;
  failed: number;
  results: ScenarioResult[];
}
