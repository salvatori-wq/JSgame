// Fase 0c — predicados puros de ownership (reutilizados nas rotas REST e no
// socket joinCampaign). Mantidos puros pra serem testáveis sem DB nem Express.
//
// Modelo do projeto:
// - PJ de user LOGADO carrega `userId`. PJ ANÔNIMO/legado não tem `userId`
//   (identificado por `ownerName`; "jogar sem cadastro" depende disso).
// - Crônica (CampaignState) NÃO tem dono direto: a posse deriva de ter um PJ
//   próprio dentro de `partyCharacterIds`.

import type { CharacterSheet } from '../shared/types.js';

/**
 * Pode o requester (logado ou anônimo) ler/mutar/usar este PJ?
 * - PJ com `userId`: só o dono (userId === requesterUserId).
 * - PJ sem `userId` (anônimo): liberado — não há identidade pra gatear, e travar
 *   quebraria o "jogar sem cadastro". O IDOR que IMPORTA é o PJ DE OUTRO user.
 * - sheet null (não existe): true — o 404/idempotência é tratado fora; não há
 *   nada a proteger.
 */
export function canAccessCharacter(
  sheet: Pick<CharacterSheet, 'userId'> | null | undefined,
  requesterUserId: string | undefined,
): boolean {
  if (!sheet) return true;
  if (!sheet.userId) return true;
  return sheet.userId === requesterUserId;
}

/**
 * O user logado é dono de pelo menos 1 PJ na party da crônica?
 * `ownedCharacterIds` = ids dos PJs do user (de listCharactersByUserId).
 */
export function ownsCampaignParty(
  partyCharacterIds: string[] | undefined,
  ownedCharacterIds: Iterable<string>,
): boolean {
  const party = partyCharacterIds ?? [];
  if (party.length === 0) return false;
  const owned = new Set(ownedCharacterIds);
  return party.some((id) => owned.has(id));
}
