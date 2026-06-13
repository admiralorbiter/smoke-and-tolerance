export interface ShotInput {
  barrelMaterial: string;
  propellantType: string;
  refinementLevel: number;
  projectileType: string;
  sealingQuality: string;
  weatherHumidity: number;
  weatherWind: number;
  weatherRain: number;
  seed: bigint;
}

export interface ShotFrame {
  t: number;
  timeMs: number;
  stage: string;
  projectileX: number;
  projectileY: number;
  projectileVelocity: number;
  pressure: number;
  leakage: number;
  barrelStress: number;
  smoke: number;
  fouling: number;
  aimOffset: number;
  warnings: string[];
}

export interface DiagnosisEntry {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  explanation: string;
}

export interface ShotResult {
  input: ShotInput;
  frames: ShotFrame[];
  outcomes: string[];
  diagnosis: DiagnosisEntry[];
  summary: string;
}
