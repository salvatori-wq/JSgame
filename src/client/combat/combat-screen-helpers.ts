// JSgame · W3.1 — Helpers compartilhados entre combat-screen e combat-target-sheet.
// Extraídos pra evitar circular dep (combat-target-sheet importa de combat-screen
// que pode importar de target-sheet via wire-up).

/**
 * W3.1 — Fog of war derivado da % HP do inimigo.
 * Consultor D&D: "DM real nunca diz '23/45 HP', diz 'está ferido / mancando /
 * à beira'". Player NÃO joga contra planilha. HP numérico vai pro stat-block
 * modal (botão ℹ) pra quem quer ver.
 */
export function enemyHpAdjective(currentHp: number, maxHp: number): string {
  if (maxHp <= 0) return 'morto';
  if (currentHp <= 0) return 'caído';
  const pct = Math.round((currentHp / maxHp) * 100);
  if (pct >= 95) return 'intacto';
  if (pct >= 70) return 'arranhado';
  if (pct >= 45) return 'ferido';
  if (pct >= 20) return 'muito ferido';
  return 'à beira';
}
