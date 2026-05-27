// JSgame · λ.2 — Spell VFX detector.
// Parseia texto de narração pra detectar palavras-chave de magia + escola,
// retorna className apropriado pra wrapper (has-spell-vfx-{school}).

const FIRE_KEYWORDS = ['fogo', 'flama', 'flame', 'chama', 'queim', 'incandesce', 'fireball', 'fire bolt', 'burning'];
const HEAL_KEYWORDS = ['cura', 'curou', 'restaur', 'cure wounds', 'healing word', 'curing', 'regener'];
const COLD_KEYWORDS = ['gelo', 'frio', 'congel', 'cold', 'ice', 'frost', 'winter'];
const ARCANE_KEYWORDS = ['arcan', 'arcane', 'magic missile', 'mage hand', 'misty step', 'shield'];
const DIVINE_KEYWORDS = ['divin', 'sagrad', 'sacred flame', 'bless', 'guidance', 'inflict wounds'];

/**
 * Retorna className pra spell vfx baseado no texto da narração, ou null
 * se nenhuma escola detectada.
 */
export function detectSpellSchool(text: string): string | null {
  const lower = text.toLowerCase();
  // Divine vem antes de Fire pra capturar "chama sagrada" como divine (não fire)
  if (DIVINE_KEYWORDS.some((k) => lower.includes(k))) return 'has-spell-vfx-divine';
  if (FIRE_KEYWORDS.some((k) => lower.includes(k))) return 'has-spell-vfx-fire';
  if (HEAL_KEYWORDS.some((k) => lower.includes(k))) return 'has-spell-vfx-heal';
  if (COLD_KEYWORDS.some((k) => lower.includes(k))) return 'has-spell-vfx-cold';
  if (ARCANE_KEYWORDS.some((k) => lower.includes(k))) return 'has-spell-vfx-arcane';
  return null;
}
