// Sprint B — E2E runner orquestrador.
// Uso: tsx scripts/e2e/runner.ts [scenarioId|all] [--server=https://jsgame-drpe.onrender.com]
//
// Cada scenario.id resolve pra implementação em scripts/e2e/impls/<id>.ts (carregadas dinamicamente).
// Se impl não existe, marca SKIPPED (não FAILED) — permite scaffolding incremental.
//
// Output: JSON com SuiteSummary. Exit code 0 se todos passed/skipped, 1 se algum failed.

import { SCENARIOS, type ScenarioResult, type SuiteSummary, type Scenario } from './scenarios.js';

interface ScenarioImpl {
  run: (opts: { server: string }) => Promise<{
    passed: boolean;
    expectationResults: ScenarioResult['expectationResults'];
    error?: string;
  }>;
}

async function loadImpl(scenarioId: string): Promise<ScenarioImpl | null> {
  try {
    const mod = await import(`./impls/${scenarioId}.js`);
    return mod as ScenarioImpl;
  } catch {
    return null;
  }
}

async function runScenario(scenario: Scenario, server: string): Promise<ScenarioResult> {
  const t0 = Date.now();
  const impl = await loadImpl(scenario.id);
  if (!impl) {
    return {
      scenarioId: scenario.id,
      passed: false,
      durationMs: Date.now() - t0,
      expectationResults: scenario.expectations.map((e) => ({
        assertion: e.assertion,
        passed: false,
        evidence: 'SCAFFOLDED — impl não existe em scripts/e2e/impls/',
      })),
      error: 'no implementation',
    };
  }
  try {
    const r = await impl.run({ server });
    return {
      scenarioId: scenario.id,
      passed: r.passed,
      durationMs: Date.now() - t0,
      expectationResults: r.expectationResults,
      ...(r.error ? { error: r.error } : {}),
    };
  } catch (err) {
    return {
      scenarioId: scenario.id,
      passed: false,
      durationMs: Date.now() - t0,
      expectationResults: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((a) => !a.startsWith('--')) ?? 'all';
  const serverArg = args.find((a) => a.startsWith('--server='))?.split('=')[1]
    ?? process.env.JSGAME_SERVER
    ?? 'http://localhost:3001';

  const toRun = scenarioArg === 'all' ? SCENARIOS : SCENARIOS.filter((s) => s.id === scenarioArg);
  if (toRun.length === 0) {
    console.error(`No scenario matches "${scenarioArg}". Available:`);
    for (const s of SCENARIOS) console.error(`  ${s.id} — ${s.name}`);
    process.exit(1);
  }

  console.log(`Running ${toRun.length} scenario(s) against ${serverArg}`);
  const startedAt = Date.now();
  const results: ScenarioResult[] = [];
  for (const scenario of toRun) {
    console.log(`\n[${scenario.id}] ${scenario.name}`);
    const r = await runScenario(scenario, serverArg);
    results.push(r);
    console.log(`        ${r.passed ? '✓ PASS' : '✗ FAIL'} (${r.durationMs}ms)`);
    if (r.error) console.log(`        error: ${r.error}`);
  }
  const summary: SuiteSummary = {
    startedAt,
    endedAt: Date.now(),
    totalScenarios: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(2);
});
