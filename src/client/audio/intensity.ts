// Trilha Medieval — Curvas de intensidade adaptativa (puro, testável).
// Mapeia uma intensidade única [0,1] → níveis das camadas (drone/ritmo/melodia/
// harmonia) + brilho do filtro mestre. Layering vertical da pesquisa §5:
//   0.0–0.25 drone + melodia suave (exploração)
//   0.25–0.5 + percussão (tensão)
//   0.5–0.8  + harmonia/organum (combate)
//   0.8–1.0  tudo no auge + brilhante (boss/perigo)

export interface LayerLevels {
  drone: number; rhythm: number; melody: number; harmony: number;
}

/** Caps por mood (multiplicadores 0..1) — ex.: rest abafa a percussão. */
export type LayerCaps = Partial<LayerLevels>;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Rampa linear de uma camada: 0 antes de onAt, sobe até `max` em fullAt. */
export function layerLevel(intensity: number, onAt: number, fullAt: number, max: number): number {
  if (fullAt <= onAt) return intensity >= fullAt ? max : 0;
  return max * clamp01((intensity - onAt) / (fullAt - onAt));
}

/** Níveis das 4 camadas para uma intensidade, com caps opcionais por mood. */
export function computeLayers(intensity: number, caps: LayerCaps = {}): LayerLevels {
  const i = clamp01(intensity);
  return {
    drone:   (0.5 + 0.32 * i)               * (caps.drone   ?? 1),
    melody:  layerLevel(i, 0.0,  0.32, 0.72) * (caps.melody  ?? 1),
    rhythm:  layerLevel(i, 0.22, 0.52, 0.80) * (caps.rhythm  ?? 1),
    harmony: layerLevel(i, 0.5,  0.82, 0.50) * (caps.harmony ?? 1),
  };
}

/** Intensidade → brilho do lowpass mestre (0.4 distante … 0.95 presente). */
export function intensityToBrightness(intensity: number): number {
  return clamp01(0.4 + 0.55 * clamp01(intensity));
}
