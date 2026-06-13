export interface AlchemicalMix {
  saltpeterRatio: number; // 0 - 100
  charcoalRatio: number;  // 0 - 100
  sulfurRatio: number;    // 0 - 100
  charcoalSource: 'willow' | 'alder' | 'oak';
  saltpeterPurity: number; // 0 - 100
  weatherProtection?: string;
}

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
  customMixActive?: boolean;
  alchemicalMix?: AlchemicalMix;
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

export interface EraConfig {
  id: string;
  name: string;
  displayName: string;
  dateRange: string;
  allowedMetallurgies: string[]; // "bamboo", "wrought_iron", "cast_bronze"
  allowedPropellants: string[];  // "uneven", "fast_then_weak", "steady", "slow_smoky", "damp_partial"
  maxSaltpeterRefinement: number;
  allowedProjectiles: string[];  // "none", "lead_arrow", "pebbles", "rough_stone", "lead_ball"
  allowedWaddings: string[];     // "none", "tow", "clay"
  defaultInputs: {
    barrelMaterial: string;
    propellantProfile: string;
    refinementLevel: number;
    projectileType: string;
    sealingQuality: string;
  };
  codex: {
    illustration: string;
    description: string;
    objective: string;
    unreliable: string;
    nextStep: string;
    challenge: string;
  };
  lockedHumidity?: number;
  lockedWind?: number;
  lockedRain?: number;
}

export const ERA_REGISTRY: Record<string, EraConfig> = {
  strange_fire: {
    id: 'strange_fire',
    name: 'I. Strange Fire',
    displayName: 'Strange Fire',
    dateRange: '800s–1000s',
    allowedMetallurgies: ['bamboo'],
    allowedPropellants: ['uneven', 'slow_smoky', 'damp_partial'],
    maxSaltpeterRefinement: 50,
    allowedProjectiles: ['none'],
    allowedWaddings: ['none'],
    defaultInputs: {
      barrelMaterial: 'bamboo',
      propellantProfile: 'uneven',
      refinementLevel: 45,
      projectileType: 'none',
      sealingQuality: 'none',
    },
    codex: {
      illustration: '🜁 🜔 🜍 🜘',
      description: 'Before there were barrels or projectiles, alchemists in East Asia experimented with energetic mixtures. Gunpowder was treated as a dangerous medicine or incendiary compound rather than a propellant.',
      objective: 'Experiment with slow-burning meal powder formulas in low-strength casings and manage smoke and heat.',
      unreliable: 'The raw serpentine mixes burn unevenly and absorb humidity instantly. Bamboo tubes split easily along their natural fibers.',
      nextStep: 'Enclosing the mixture and attaching it to projectile shafts (fire arrows) to deliver fire at a distance.',
      challenge: 'Chronicle Challenge: Achieve a burn duration of at least 8.0 ms (simulated duration) using Bamboo and Uneven Serpentine without causing a fiber split (barrel rupture).'
    },
    lockedHumidity: 30,
    lockedWind: 0,
    lockedRain: 0
  },
  fire_delivered: {
    id: 'fire_delivered',
    name: 'II. Fire Delivered',
    displayName: 'Fire Delivered',
    dateRange: '1000s–1100s',
    allowedMetallurgies: ['bamboo'],
    allowedPropellants: ['uneven', 'slow_smoky', 'damp_partial'],
    maxSaltpeterRefinement: 60,
    allowedProjectiles: ['lead_arrow'],
    allowedWaddings: ['none', 'tow'],
    defaultInputs: {
      barrelMaterial: 'bamboo',
      propellantProfile: 'uneven',
      refinementLevel: 55,
      projectileType: 'lead_arrow',
      sealingQuality: 'tow',
    },
    codex: {
      illustration: '🜛 🜔 🏹',
      description: 'The first weaponized applications of gunpowder involved attaching burning packets or rocket-like tubes to arrow shafts. The tube directed fire backward to launch the arrow or forward as an incendiary.',
      objective: 'Launch arrow-bolts from bamboo guide tubes. Minimize starting friction while ensuring a sufficient gas seal.',
      unreliable: 'Poorly refined saltpeter leads to weak thrust, while damp conditions extinguish the exposed matches entirely.',
      nextStep: 'Packing small debris or pebbles inside the tube to eject a spray of fire and gravel directly from the muzzle.',
      challenge: 'Chronicle Challenge: Reach a muzzle velocity of at least 40 m/s with a Lead Arrow-Bolt from a Bamboo barrel.'
    },
    lockedHumidity: 75,
    lockedWind: 15,
    lockedRain: 15
  },
  directional_blast: {
    id: 'directional_blast',
    name: 'III. Directional Blast',
    displayName: 'Directional Blast',
    dateRange: '1100s–1200s',
    allowedMetallurgies: ['bamboo', 'wrought_iron'],
    allowedPropellants: ['uneven', 'slow_smoky', 'damp_partial'],
    maxSaltpeterRefinement: 75,
    allowedProjectiles: ['pebbles'],
    allowedWaddings: ['none', 'tow'],
    defaultInputs: {
      barrelMaterial: 'bamboo',
      propellantProfile: 'uneven',
      refinementLevel: 65,
      projectileType: 'pebbles',
      sealingQuality: 'tow',
    },
    codex: {
      illustration: '🜂 🜔 🜏 🜍',
      description: 'The "Fire Lance" emerged as a bamboo or paper tube lashed to a spear, designed to spray fire, poisonous fumes, and shrapnel (pebbles, iron shards) at close range.',
      objective: 'Simulate a multi-projectile directional blast cone. Maximize muzzle velocity and wide debris scatter.',
      unreliable: 'Bamboo tubes burn through or split quickly, while rough gravel causes significant inner bore scraping and erratic gas leakage.',
      nextStep: 'Casting thick bronze or welding wrought iron staves to create reusable barrels that can contain high pressure.',
      challenge: 'Chronicle Challenge: Achieve a muzzle velocity of over 30 m/s with Pebble Spray from a Wrought Iron barrel.'
    },
    lockedHumidity: 40,
    lockedWind: 65,
    lockedRain: 0
  },
  hand_cannon: {
    id: 'hand_cannon',
    name: 'IV. The Difficult Shot',
    displayName: 'The Difficult Shot',
    dateRange: 'Late 1200s',
    allowedMetallurgies: ['bamboo', 'wrought_iron', 'cast_bronze'],
    allowedPropellants: ['uneven', 'fast_then_weak', 'steady', 'slow_smoky', 'damp_partial'],
    maxSaltpeterRefinement: 100,
    allowedProjectiles: ['lead_arrow', 'pebbles', 'rough_stone', 'lead_ball'],
    allowedWaddings: ['none', 'tow', 'clay'],
    defaultInputs: {
      barrelMaterial: 'wrought_iron',
      propellantProfile: 'steady',
      refinementLevel: 65,
      projectileType: 'lead_ball',
      sealingQuality: 'tow',
    },
    codex: {
      illustration: '🜔 🜕 🜘 🝓',
      description: 'The first true metal hand cannons (like the Heilongjiang chong) utilized cast bronze or wrought iron to contain high pressures, firing heavy lead balls or tightly fitting stones.',
      objective: 'Achieve a clean, high-velocity target hit. Manage the dangerous trade-offs between barrel stress and windage leakage.',
      unreliable: 'Corrosion, heavy soot fouling, weld seam failures in iron, and casting voids in bronze make each shot a calculated risk.',
      nextStep: 'Scaling up metallurgical castings to create large, stationary siege artillery firing giant stone spheres.',
      challenge: 'Chronicle Challenge: Fire a Lead Ball from a Cast Bronze barrel achieving >90 m/s muzzle velocity without exceeding the yield strength (deformation).'
    },
    lockedHumidity: 90,
    lockedWind: 30,
    lockedRain: 75
  },
  early_cannon: {
    id: 'early_cannon',
    name: 'early_cannon',
    displayName: 'Foundry & Siege',
    dateRange: '1300s',
    allowedMetallurgies: ['cast_bronze'],
    allowedPropellants: ['uneven', 'fast_then_weak', 'steady', 'slow_smoky', 'damp_partial'],
    maxSaltpeterRefinement: 100,
    allowedProjectiles: ['rough_stone', 'lead_ball'],
    allowedWaddings: ['tow', 'clay'],
    defaultInputs: {
      barrelMaterial: 'cast_bronze',
      propellantProfile: 'steady',
      refinementLevel: 85,
      projectileType: 'rough_stone',
      sealingQuality: 'clay',
    },
    codex: {
      illustration: '🝛 🜔 🝖 🜏',
      description: 'By the early 1300s, Europe and East Asia cast massive siege cannons. These heavy, vase-shaped bombards fired stone spheres or giant metal arrows to breach castle fortifications.',
      objective: 'Coordinate large charges, heavy wadding plugs, and cast metallurgy to breach defenses.',
      unreliable: 'Casting air bubble voids and extreme peak pressures can lead to catastrophic explosions, destroying the cannon and crew.',
      nextStep: 'Standardizing gunpowder formulas (corned powder) and developing wheeled gun carriages for field battles.',
      challenge: 'Chronicle Challenge: Achieve a muzzle velocity of at least 110 m/s with a heavy Rough Stone projectile using a Clay wadding plug.'
    },
    lockedHumidity: 85,
    lockedWind: 60,
    lockedRain: 45
  },
  sandbox: {
    id: 'sandbox',
    name: 'VI. Sandbox Playground',
    displayName: 'Sandbox Playground',
    dateRange: 'Free Play',
    allowedMetallurgies: ['bamboo', 'wrought_iron', 'cast_bronze'],
    allowedPropellants: ['uneven', 'fast_then_weak', 'steady', 'slow_smoky', 'damp_partial'],
    maxSaltpeterRefinement: 100,
    allowedProjectiles: ['none', 'lead_arrow', 'pebbles', 'rough_stone', 'lead_ball'],
    allowedWaddings: ['none', 'tow', 'clay'],
    defaultInputs: {
      barrelMaterial: 'cast_bronze',
      propellantProfile: 'steady',
      refinementLevel: 85,
      projectileType: 'lead_ball',
      sealingQuality: 'tow',
    },
    codex: {
      illustration: '🜔 🜕 🝓 🝛',
      description: 'Welcome to the Sandbox Playground. Here, all historical restrictions are lifted. You can pair any barrel metallurgy, projectile, wadding, or propellant mix, and dynamically control the weather conditions without restrictions.',
      objective: 'Experiment freely with physical tolerances, propellant velocities, and environmental protections.',
      unreliable: 'No safety rails—watch out for bamboo bursts or wet misfires.',
      nextStep: 'Select your apparatus and ignite.',
      challenge: 'Sandbox Mode: All features and environmental conditions are unlocked.'
    }
  }
};
