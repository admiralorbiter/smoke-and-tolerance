export interface ShotInput {
  barrelMaterial: string;
  propellantType: string;
  refinementLevel: number;
  projectileType: string;
  sealingQuality: string;
  weatherHumidity: number;
  weatherWind: number;
  weatherRain: number;
  primingQuality: number;
  seed: bigint;
  weatherProtection?: string;
  persistentFouling: number;
  propellantProfile: string;
}

export const FRAME_STRIDE = 20;

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
  unburnedMass: number;
  gasMass: number;
  temperature: number;
  grainRadius: number;
  wallHeatLoss: number;
  foulingIndex: number;
  burnProfileCode: number;
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

export interface ShotResultWasm {
  input: ShotInput;
  frameCount: number;
  frameDataPtr: number;
  outcomes: string[];
  diagnosis: DiagnosisEntry[];
  summary: string;
}

export function parseFramesFromBuffer(
  memoryBuffer: ArrayBuffer,
  pointer: number,
  count: number
): ShotFrame[] {
  // Validate memory size
  const expectedBytes = count * FRAME_STRIDE * 8;
  if (memoryBuffer.byteLength < expectedBytes) {
    throw new Error(`Buffer size mismatch: expected at least ${expectedBytes} bytes, got ${memoryBuffer.byteLength}`);
  }

  const floatOffset = pointer / 8; // pointer is in bytes, Float64 is 8 bytes
  const buffer = new Float64Array(memoryBuffer);
  const frames: ShotFrame[] = [];

  const stageMapping = [
    "setup",
    "ignition",
    "pressure",
    "movement",
    "muzzle_exit",
    "flight",
    "impact",
    "aftermath",
  ];

  for (let i = 0; i < count; i++) {
    const startIdx = floatOffset + i * FRAME_STRIDE;
    const stageCode = buffer[startIdx + 11];
    const stage = stageMapping[Math.round(stageCode)] || "aftermath";

    // Deduce warning text for UI feedback based on physical parameters
    const warnings: string[] = [];
    const pressure = buffer[startIdx + 5];
    const leakage = buffer[startIdx + 6];
    const stress = buffer[startIdx + 7];

    if (stage === "ignition") {
      warnings.push("Priming powder burning...");
    } else if (stage === "movement") {
      if (leakage > 0.01) {
        warnings.push("Gas blowing past projectile");
      }
    } else if (stage === "aftermath") {
      if (stress > 200.0) {
        warnings.push("TEST DEVICE RUPTURED");
      } else if (pressure > 0.5) {
        warnings.push("Projectile stuck in bore");
      }
    }

    frames.push({
      t: buffer[startIdx + 0],
      timeMs: buffer[startIdx + 1],
      projectileX: buffer[startIdx + 2],
      projectileY: buffer[startIdx + 3],
      projectileVelocity: buffer[startIdx + 4],
      pressure,
      leakage,
      barrelStress: stress,
      smoke: buffer[startIdx + 8],
      fouling: buffer[startIdx + 9],
      aimOffset: buffer[startIdx + 10],
      stage,
      warnings,
      unburnedMass: buffer[startIdx + 12],
      gasMass: buffer[startIdx + 13],
      temperature: buffer[startIdx + 14],
      grainRadius: buffer[startIdx + 15],
      wallHeatLoss: buffer[startIdx + 16],
      foulingIndex: buffer[startIdx + 17],
      burnProfileCode: buffer[startIdx + 18],
    });
  }

  return frames;
}
