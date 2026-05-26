// Sprint D — Runner pra adversarial probes.
// Uso: tsx scripts/adversarial/run-probes.ts [probeId|all] [--server=http://localhost:3001]
//
// Cada probe:
//  1) Cria uma campanha minimal (via REST)
//  2) Snapshot stateBefore + sheetBefore
//  3) Dispara o prompt EVIL via socket (takeAction)
//  4) Aguarda narração
//  5) Snapshot stateAfter + sheetAfter
//  6) Roda validator → resultado JSON
//
// IMPORTANTE: Este runner consome quota LLM. Default roda 1 probe sample.
// Pra rodar tudo: tsx scripts/adversarial/run-probes.ts all
//
// **Não executar em CI sem orçamento de tokens definido**.

import { PROBES, type Probe, type ProbeRunSummary } from './probes.js';

const SERVER = process.env.JSGAME_SERVER ?? 'http://localhost:3001';
const args = process.argv.slice(2);
const probeIdArg = args.find((a) => !a.startsWith('--')) ?? 'inject-jailbreak';

async function runSingleProbe(probe: Probe): Promise<{
  probeId: string;
  passed: boolean;
  reason: string;
  durationMs: number;
}> {
  const t0 = Date.now();
  console.log(`\n[probe] ${probe.id} (${probe.category})`);
  console.log(`        prompt: "${probe.prompt.slice(0, 80)}..."`);

  try {
    // Health check primeiro
    const health = await fetch(`${SERVER}/api/health`);
    if (!health.ok) throw new Error(`server unreachable: ${health.status}`);

    // SCAFFOLDING — full integration requer:
    //  - criar PJ via POST /api/characters (sheet completa)
    //  - criar campaign via socket emit start_campaign
    //  - emit take_action com probe.prompt
    //  - listen for campaign_state_updated
    //  - snapshot before/after
    //
    // Como esta sessão não pode segurar socket connection,
    // o run completo é manual. Vide TODO inline abaixo.

    console.log(`        [SCAFFOLDED — full run requer socket session ativa]`);
    return {
      probeId: probe.id,
      passed: false,
      reason: 'scaffolded only — execute manualmente via DM + socket session',
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      probeId: probe.id,
      passed: false,
      reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - t0,
    };
  }
}

async function main(): Promise<void> {
  const toRun = probeIdArg === 'all' ? PROBES : PROBES.filter((p) => p.id === probeIdArg);
  if (toRun.length === 0) {
    console.error(`No probe matches "${probeIdArg}". Available:`);
    for (const p of PROBES) console.error(`  ${p.id} (${p.category})`);
    process.exit(1);
  }

  console.log(`Running ${toRun.length} probe(s) against ${SERVER}`);
  const results: ProbeRunSummary['results'] = [];
  for (const probe of toRun) {
    const r = await runSingleProbe(probe);
    results.push({ ...r, category: probe.category });
  }
  const summary: ProbeRunSummary = {
    totalProbes: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
  console.log('\n' + JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(2);
});
