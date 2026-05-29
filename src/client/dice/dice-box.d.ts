// Type shim mínimo pra @3d-dice/dice-box (a lib não publica @types).
// Só declaramos o que o wrapper (dice-box-engine.ts) usa.
declare module '@3d-dice/dice-box' {
  export interface DiceBoxConfig {
    id?: string;
    assetPath: string;
    container?: string;
    theme?: string;
    themeColor?: string;
    scale?: number;
    gravity?: number;
    settleTimeout?: number;
    [key: string]: unknown;
  }
  export default class DiceBox {
    constructor(config: DiceBoxConfig);
    init(): Promise<unknown>;
    roll(notation: unknown): Promise<unknown>;
    add(notation: unknown): Promise<unknown>;
    clear(): void;
    hide(): void;
    show(): void;
    onRollComplete?: (results: unknown) => void;
  }
}
