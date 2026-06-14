import { ShotFrame, ShotInput } from '../types';

const BARREL_LIMITS: Record<string, { yield: number; ultimate: number }> = {
  bamboo: { yield: 30.0, ultimate: 45.0 },
  wrought_iron: { yield: 130.0, ultimate: 220.0 },
  cast_bronze: { yield: 160.0, ultimate: 280.0 },
};

export class CutawayRenderer {
  private cutawayCanvas: HTMLCanvasElement;
  private cutawayCtx: CanvasRenderingContext2D;
  private trajectoryCanvas: HTMLCanvasElement;
  private trajectoryCtx: CanvasRenderingContext2D;
  private sootLevel: number = 0; // accumulated fouling level
  public xrayMode: boolean = false;
  private activeFrames: ShotFrame[] = [];

  constructor(cutawayCanvasId: string, trajectoryCanvasId: string) {
    this.cutawayCanvas = document.getElementById(cutawayCanvasId) as HTMLCanvasElement;
    this.cutawayCtx = this.cutawayCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.trajectoryCanvas = document.getElementById(trajectoryCanvasId) as HTMLCanvasElement;
    this.trajectoryCtx = this.trajectoryCanvas.getContext('2d') as CanvasRenderingContext2D;
  }

  public setFrames(frames: ShotFrame[]) {
    this.activeFrames = frames;
  }

  public setXrayMode(enabled: boolean) {
    this.xrayMode = enabled;
  }

  public setSootLevel(level: number) {
    this.sootLevel = level;
  }

  public clear() {
    this.clearCutaway();
    this.clearTrajectory();
  }

  private clearCutaway() {
    const ctx = this.cutawayCtx;
    const w = this.cutawayCanvas.width;
    const h = this.cutawayCanvas.height;

    // Draw parchment paper background texture
    ctx.fillStyle = '#181512';
    ctx.fillRect(0, 0, w, h);

    // Subtle Leonardo parchment grid lines
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1;

    // Draw alchemical notebook label
    ctx.fillStyle = '#6e5e4f';
    ctx.font = 'italic 12px Lora, serif';
    ctx.fillText('fig 1. Barrel Cutaway (Scale 1:1)', 15, h - 15);
  }

  private clearTrajectory() {
    const ctx = this.trajectoryCtx;
    const w = this.trajectoryCanvas.width;
    const h = this.trajectoryCanvas.height;

    // Draw parchment paper background texture
    ctx.fillStyle = '#181512';
    ctx.fillRect(0, 0, w, h);

    // Subtle Leonardo parchment grid lines
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1;

    // Draw alchemical notebook label
    ctx.fillStyle = '#6e5e4f';
    ctx.font = 'italic 12px Lora, serif';
    ctx.fillText('fig 2. Range & Target Projection (35m)', 15, h - 15);
  }

  public drawFrame(
    frame: ShotFrame,
    inputs: ShotInput,
    isPaused: boolean = false,
    history: Array<{ inputs: ShotInput; frames: ShotFrame[] }> = []
  ) {
    this.clear();
    
    const barrelLeft = 60;
    const barrelLengthPx = 440;
    const barrelRight = barrelLeft + barrelLengthPx;
    const centerY = this.xrayMode ? 225 : 320;
    const boreRadiusPx = this.xrayMode ? 55 : 40;
    const wallThickness = this.xrayMode ? 26 : 20;

    const barrelMaterial = inputs.barrelMaterial;
    const projectileType = inputs.projectileType;
    const waddingType = inputs.sealingQuality;
    const propellantType = inputs.propellantType;
    const refinementLevel = inputs.refinementLevel;

    // Update soot level
    if (frame.fouling > this.sootLevel) {
      this.sootLevel = frame.fouling;
    }

    // Camera shake calculation based on pressure
    let dx = 0;
    let dy = 0;
    if (frame.stage === 'ignition' || frame.stage === 'pressure' || frame.stage === 'movement') {
      const shakeIntensity = Math.min(6.0, frame.pressure * 0.18);
      if (shakeIntensity > 0.1) {
        dx = (Math.random() - 0.5) * shakeIntensity;
        dy = (Math.random() - 0.5) * shakeIntensity;
      }
    }

    // --- DRAW TARGET RANGE (Right Side) ---
    this.drawTargetRange(frame, projectileType, history, inputs);

    // --- DRAW BARREL METALLURGY (Left Side on Cutaway Canvas with Shake) ---
    this.cutawayCtx.save();
    if (dx !== 0 || dy !== 0) {
      this.cutawayCtx.translate(dx, dy);
    }
    
    const ctx = this.cutawayCtx;
    ctx.save();
    
    // Draw barrel block based on material
    ctx.lineWidth = 2;
    let wallStroke = '#3d3228';
    
    // Determine metal color based on material
    let wallColor = '#2d241c'; // default iron
    if (barrelMaterial === 'bamboo') {
      wallColor = '#4a422a';
    } else if (barrelMaterial === 'cast_bronze') {
      wallColor = '#5c4832';
    }

    if (this.xrayMode) {
      wallColor = 'rgba(10, 24, 20, 0.85)';
      wallStroke = 'rgba(64, 185, 145, 0.6)';
    }
    ctx.strokeStyle = wallStroke;

    // Evaluate failure states using physical limits
    const limits = BARREL_LIMITS[barrelMaterial] || BARREL_LIMITS.cast_bronze;
    const isDeformed = frame.barrelStress >= limits.yield;
    const isRuptured = frame.barrelStress >= limits.ultimate;

    const maxHeatLoss = barrelMaterial === 'cast_bronze' ? 4000 : barrelMaterial === 'wrought_iron' ? 2500 : 800;
    const redGlow = Math.min(1.0, frame.wallHeatLoss / maxHeatLoss);

    // Inside bore background
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(barrelLeft, centerY - boreRadiusPx, barrelLengthPx, boreRadiusPx * 2);

    // Draw Soot deposits (Fouling) inside the bore walls
    if (this.sootLevel > 0.02) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, this.sootLevel * 0.95)})`;
      ctx.fillRect(barrelLeft, centerY - boreRadiusPx, barrelLengthPx, 4);
      ctx.fillRect(barrelLeft, centerY + boreRadiusPx - 4, barrelLengthPx, 4);

      // Draw jagged carbon crust bumps for high fouling levels
      if (this.sootLevel > 0.5) {
        ctx.fillStyle = `rgba(10, 8, 7, ${Math.min(0.95, this.sootLevel)})`;
        // Draw top bore wall bumps
        for (let x = barrelLeft + 10; x < barrelLeft + barrelLengthPx - 10; x += 15) {
          ctx.beginPath();
          const height = 3 + Math.sin(x * 0.5) * 2.5;
          ctx.arc(x, centerY - boreRadiusPx + 2, height, 0, Math.PI * 2);
          ctx.fill();
        }
        // Draw bottom bore wall bumps
        for (let x = barrelLeft + 15; x < barrelLeft + barrelLengthPx - 10; x += 15) {
          ctx.beginPath();
          const height = 3 + Math.cos(x * 0.5) * 2.5;
          ctx.arc(x, centerY + boreRadiusPx - 2, height, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (isRuptured) {
      // Material-specific ruptured animations
      if (barrelMaterial === 'bamboo') {
        ctx.fillStyle = wallColor;
        // Top wall split left
        ctx.save();
        ctx.translate(barrelLeft, centerY - boreRadiusPx - wallThickness);
        ctx.rotate(-0.08);
        ctx.fillRect(0, -wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.strokeRect(0, -wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.restore();

        // Top wall split right
        ctx.save();
        ctx.translate(barrelLeft + barrelLengthPx / 2, centerY - boreRadiusPx - wallThickness);
        ctx.rotate(0.08);
        ctx.fillRect(0, -wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.strokeRect(0, -wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.restore();

        // Bottom wall split left
        ctx.save();
        ctx.translate(barrelLeft, centerY + boreRadiusPx);
        ctx.rotate(0.08);
        ctx.fillRect(0, wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.strokeRect(0, wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.restore();

        // Bottom wall split right
        ctx.save();
        ctx.translate(barrelLeft + barrelLengthPx / 2, centerY + boreRadiusPx);
        ctx.rotate(-0.08);
        ctx.fillRect(0, wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.strokeRect(0, wallThickness / 2, barrelLengthPx / 2, wallThickness);
        ctx.restore();
        
        // Horizontal gas vents
        ctx.fillStyle = '#ff9f1c';
        for (let i = 0; i < 15; i++) {
          let px = barrelLeft + 120 + Math.sin(i * 123) * 80;
          let py = centerY - 30 + Math.abs(Math.sin(i * 456)) * 60;
          ctx.fillRect(px, py, 12, 3);
        }
      } else if (barrelMaterial === 'wrought_iron') {
        ctx.fillStyle = wallColor;
        // Split left half of walls
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx - wallThickness, 140, wallThickness);
        ctx.strokeRect(barrelLeft, centerY - boreRadiusPx - wallThickness, 140, wallThickness);
        ctx.fillRect(barrelLeft, centerY + boreRadiusPx, 140, wallThickness);
        ctx.strokeRect(barrelLeft, centerY + boreRadiusPx, 140, wallThickness);

        // Split right half of walls
        ctx.fillRect(barrelLeft + 160, centerY - boreRadiusPx - wallThickness, barrelLengthPx - 160, wallThickness);
        ctx.strokeRect(barrelLeft + 160, centerY - boreRadiusPx - wallThickness, barrelLengthPx - 160, wallThickness);
        ctx.fillRect(barrelLeft + 160, centerY + boreRadiusPx, barrelLengthPx - 160, wallThickness);
        ctx.strokeRect(barrelLeft + 160, centerY + boreRadiusPx, barrelLengthPx - 160, wallThickness);

        // Vertical seam separation flame jet
        let gradJet = ctx.createLinearGradient(0, centerY - 100, 0, centerY + 100);
        gradJet.addColorStop(0, 'rgba(217, 78, 52, 0)');
        gradJet.addColorStop(0.2, '#ff9f1c');
        gradJet.addColorStop(0.5, '#fff');
        gradJet.addColorStop(0.8, '#ff9f1c');
        gradJet.addColorStop(1, 'rgba(217, 78, 52, 0)');
        ctx.fillStyle = gradJet;
        ctx.fillRect(barrelLeft + 140, centerY - 120, 20, 240);
      } else {
        // cast_bronze - shattering shards
        ctx.fillStyle = wallColor;
        // Walls with gap
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx - wallThickness, 110, wallThickness);
        ctx.strokeRect(barrelLeft, centerY - boreRadiusPx - wallThickness, 110, wallThickness);
        ctx.fillRect(barrelLeft, centerY + boreRadiusPx, 110, wallThickness);
        ctx.strokeRect(barrelLeft, centerY + boreRadiusPx, 110, wallThickness);

        ctx.fillRect(barrelLeft + 190, centerY - boreRadiusPx - wallThickness, barrelLengthPx - 190, wallThickness);
        ctx.strokeRect(barrelLeft + 190, centerY - boreRadiusPx - wallThickness, barrelLengthPx - 190, wallThickness);
        ctx.fillRect(barrelLeft + 190, centerY + boreRadiusPx, barrelLengthPx - 190, wallThickness);
        ctx.strokeRect(barrelLeft + 190, centerY + boreRadiusPx, barrelLengthPx - 190, wallThickness);

        // Floating bronze shards
        ctx.fillStyle = wallColor;
        ctx.strokeStyle = '#3d3228';
        ctx.lineWidth = 1.5;
        const shards = [
          { x: barrelLeft + 130, y: centerY - 60, r: -0.4, w: 15, h: 10 },
          { x: barrelLeft + 160, y: centerY - 70, r: 0.2, w: 10, h: 12 },
          { x: barrelLeft + 140, y: centerY + 55, r: 0.5, w: 12, h: 12 },
          { x: barrelLeft + 170, y: centerY + 65, r: -0.3, w: 14, h: 8 },
        ];
        shards.forEach(s => {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.r);
          ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
          ctx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
          ctx.restore();
        });

        // Expanding radial gas flash
        let flashGrad = ctx.createRadialGradient(
          barrelLeft + 150, centerY, 5,
          barrelLeft + 150, centerY, 60
        );
        flashGrad.addColorStop(0, '#fff');
        flashGrad.addColorStop(0.3, '#ff9f1c');
        flashGrad.addColorStop(0.6, 'rgba(217, 78, 52, 0.6)');
        flashGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(barrelLeft + 150, centerY, 65, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Normal Walls
      // Top wall
      ctx.fillStyle = wallColor;
      ctx.fillRect(barrelLeft, centerY - boreRadiusPx - wallThickness, barrelLengthPx, wallThickness);
      if (redGlow > 0.01) {
        ctx.fillStyle = `rgba(158, 42, 43, ${redGlow * 0.75})`;
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx - wallThickness, barrelLengthPx, wallThickness);
      }
      ctx.strokeRect(barrelLeft, centerY - boreRadiusPx - wallThickness, barrelLengthPx, wallThickness);

      // Bottom wall
      ctx.fillStyle = wallColor;
      ctx.fillRect(barrelLeft, centerY + boreRadiusPx, barrelLengthPx, wallThickness);
      if (redGlow > 0.01) {
        ctx.fillStyle = `rgba(158, 42, 43, ${redGlow * 0.75})`;
        ctx.fillRect(barrelLeft, centerY + boreRadiusPx, barrelLengthPx, wallThickness);
      }
      ctx.strokeRect(barrelLeft, centerY + boreRadiusPx, barrelLengthPx, wallThickness);
    }

    // --- DRAW X-RAY METALLURGICAL CRACKS ---
    if (this.xrayMode && !isRuptured && frame.barrelFatigue > 0) {
      ctx.save();
      
      let seed = inputs.flawSeed || 12345;
      const pseudoRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const getCrackColor = (fatigue: number) => {
        const pulse = Math.sin(Date.now() * 0.005);
        const r = Math.floor(220 + pulse * 35);
        const g = Math.floor(80 + pulse * 20 * (1.0 - fatigue));
        const b = 20;
        const opacity = 0.5 + fatigue * 0.5;
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      };

      const crackColor = getCrackColor(frame.barrelFatigue);
      ctx.strokeStyle = crackColor;
      ctx.lineWidth = 1.2 + frame.barrelFatigue * 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 4 + frame.barrelFatigue * 6;
      ctx.shadowColor = crackColor;

      if (barrelMaterial === 'bamboo') {
        // Horizontal/longitudinal split lines
        const numSplits = Math.floor(frame.barrelFatigue * 8) + 2;
        for (let i = 0; i < numSplits; i++) {
          const isTop = pseudoRandom() > 0.5;
          const x = barrelLeft + 20 + pseudoRandom() * (barrelLengthPx - 100);
          const len = 30 + pseudoRandom() * 120 * frame.barrelFatigue;
          const y = isTop 
            ? centerY - boreRadiusPx - 20 + 3 + pseudoRandom() * 14
            : centerY + boreRadiusPx + 3 + pseudoRandom() * 14;
          
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + len, y);
          ctx.stroke();
        }
      } else if (barrelMaterial === 'wrought_iron') {
        // Weld seam separations
        const numSeams = 4;
        for (let i = 0; i < numSeams; i++) {
          const isTop = i < 2;
          const seamY = isTop
            ? centerY - boreRadiusPx - 20 + (i + 1) * 7
            : centerY + boreRadiusPx + (i - 1) * 7;
          
          const numSegments = Math.floor(frame.barrelFatigue * 4) + 1;
          for (let s = 0; s < numSegments; s++) {
            const x = barrelLeft + 15 + pseudoRandom() * (barrelLengthPx - 80);
            const len = 20 + pseudoRandom() * 90 * frame.barrelFatigue;
            
            ctx.beginPath();
            ctx.moveTo(x, seamY);
            let cx = x;
            const steps = 4;
            for (let st = 1; st <= steps; st++) {
              cx += len / steps;
              const cy = seamY + (pseudoRandom() - 0.5) * 3 * frame.barrelFatigue;
              ctx.lineTo(cx, cy);
            }
            ctx.stroke();
          }
        }
      } else if (barrelMaterial === 'cast_bronze') {
        // Circular voids with random-walk branching crack paths
        const voids = [
          { x: barrelLeft + 150, y: centerY - boreRadiusPx - 10, r: 4.5 },
          { x: barrelLeft + 300, y: centerY + boreRadiusPx + 10, r: 4.5 }
        ];

        voids.forEach(v => {
          ctx.save();
          ctx.fillStyle = '#0c0a09';
          ctx.strokeStyle = crackColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          const numBranches = Math.floor(frame.barrelFatigue * 3) + 1;
          for (let b = 0; b < numBranches; b++) {
            let cx = v.x;
            let cy = v.y;
            let angle = pseudoRandom() * Math.PI * 2;
            const steps = Math.floor(frame.barrelFatigue * 14) + 4;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for (let s = 0; s < steps; s++) {
              angle += (pseudoRandom() - 0.5) * 1.5;
              const stepLen = 4 + pseudoRandom() * 6;
              cx += Math.cos(angle) * stepLen;
              cy += Math.sin(angle) * stepLen;
              
              const wallMin = cy < centerY ? centerY - boreRadiusPx - 20 : centerY + boreRadiusPx;
              const wallMax = cy < centerY ? centerY - boreRadiusPx : centerY + boreRadiusPx + 20;
              if (cy < wallMin) cy = wallMin;
              if (cy > wallMax) cy = wallMax;
              if (cx < barrelLeft) cx = barrelLeft;
              if (cx > barrelRight) cx = barrelRight;

              ctx.lineTo(cx, cy);
            }
            ctx.stroke();
          }
        });
      }
      ctx.restore();
    }

    // Draw bronze casting bubble void defect in normal wall (stress concentrator)
    if (barrelMaterial === 'cast_bronze' && !isRuptured) {
      ctx.save();
      ctx.strokeStyle = wallStroke;
      ctx.fillStyle = '#0c0a09';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(barrelLeft + 150, centerY - boreRadiusPx - 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Breech plug (left end)
    ctx.fillStyle = wallColor;
    ctx.fillRect(barrelLeft - 15, centerY - boreRadiusPx - 20, 15, boreRadiusPx * 2 + 40);
    ctx.strokeRect(barrelLeft - 15, centerY - boreRadiusPx - 20, 15, boreRadiusPx * 2 + 40);

    // Draw touch-hole channel
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(barrelLeft + 40, centerY - boreRadiusPx - 20, 8, 20);
    ctx.strokeStyle = wallStroke;
    ctx.strokeRect(barrelLeft + 40, centerY - boreRadiusPx - 20, 8, 20);

    // Draw Weather Protection cover over touch-hole Breech
    if (inputs.weatherProtection && inputs.weatherProtection !== 'none') {
      if (inputs.weatherProtection === 'parchment') {
        ctx.save();
        ctx.fillStyle = '#bfa57a'; // tan parchment paper
        ctx.strokeStyle = '#6e5e4f';
        ctx.lineWidth = 1.5;
        ctx.fillRect(barrelLeft + 30, centerY - boreRadiusPx - 24, 28, 6);
        ctx.strokeRect(barrelLeft + 30, centerY - boreRadiusPx - 24, 28, 6);
        // Ties / threads holding it
        ctx.strokeStyle = '#4a3f35';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barrelLeft + 32, centerY - boreRadiusPx - 24);
        ctx.lineTo(barrelLeft + 32, centerY - boreRadiusPx - 18);
        ctx.moveTo(barrelLeft + 56, centerY - boreRadiusPx - 24);
        ctx.lineTo(barrelLeft + 56, centerY - boreRadiusPx - 18);
        ctx.stroke();
        ctx.restore();
      } else if (inputs.weatherProtection === 'pan_shield') {
        ctx.save();
        ctx.fillStyle = wallColor; // matches barrel color (bronze/iron)
        ctx.strokeStyle = wallStroke;
        ctx.lineWidth = 2;
        // Draw a metal shield cover pivoting above touchhole
        ctx.beginPath();
        ctx.arc(barrelLeft + 44, centerY - boreRadiusPx - 22, 10, Math.PI, 0); // semi-circle dome
        ctx.lineTo(barrelLeft + 54, centerY - boreRadiusPx - 20);
        ctx.lineTo(barrelLeft + 34, centerY - boreRadiusPx - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Hinge pin
        ctx.fillStyle = '#ffb703'; // brass pin
        ctx.beginPath();
        ctx.arc(barrelLeft + 34, centerY - boreRadiusPx - 20, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (inputs.weatherProtection === 'operator_cowl') {
        ctx.save();
        ctx.fillStyle = '#221e1a'; // dark cowl fabric
        ctx.strokeStyle = '#120f0c';
        ctx.lineWidth = 1.5;
        // Draw a draping sleeve/cloth texture over the touchhole area
        ctx.beginPath();
        ctx.moveTo(barrelLeft + 15, centerY - boreRadiusPx - 35);
        ctx.quadraticCurveTo(barrelLeft + 44, centerY - boreRadiusPx - 30, barrelLeft + 70, centerY - boreRadiusPx - 35);
        ctx.lineTo(barrelLeft + 65, centerY - boreRadiusPx - 15);
        ctx.quadraticCurveTo(barrelLeft + 44, centerY - boreRadiusPx - 18, barrelLeft + 20, centerY - boreRadiusPx - 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Fabric folds lines
        ctx.strokeStyle = '#3d3630';
        ctx.beginPath();
        ctx.moveTo(barrelLeft + 25, centerY - boreRadiusPx - 32);
        ctx.lineTo(barrelLeft + 30, centerY - boreRadiusPx - 20);
        ctx.moveTo(barrelLeft + 55, centerY - boreRadiusPx - 32);
        ctx.lineTo(barrelLeft + 50, centerY - boreRadiusPx - 20);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw Bamboo Knots / Iron Seams for flavor (if not ruptured or drawing on remaining wall parts)
    if (barrelMaterial === 'bamboo' && !isRuptured) {
      ctx.strokeStyle = '#2d241c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Draw bamboo segments
      ctx.moveTo(barrelLeft + 100, centerY - boreRadiusPx - 22);
      ctx.lineTo(barrelLeft + 100, centerY - boreRadiusPx);
      ctx.moveTo(barrelLeft + 100, centerY + boreRadiusPx);
      ctx.lineTo(barrelLeft + 100, centerY + boreRadiusPx + 22);

      ctx.moveTo(barrelLeft + 220, centerY - boreRadiusPx - 22);
      ctx.lineTo(barrelLeft + 220, centerY - boreRadiusPx);
      ctx.moveTo(barrelLeft + 220, centerY + boreRadiusPx);
      ctx.lineTo(barrelLeft + 220, centerY + boreRadiusPx + 22);
      ctx.stroke();
    } else if (barrelMaterial === 'wrought_iron' && !isRuptured) {
      // Draw staves wraps/hoops
      ctx.strokeStyle = '#110e0c';
      ctx.lineWidth = 2;
      for (let x = barrelLeft + 40; x < barrelRight; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, centerY - boreRadiusPx - 20);
        ctx.lineTo(x, centerY - boreRadiusPx);
        ctx.moveTo(x, centerY + boreRadiusPx);
        ctx.lineTo(x, centerY + boreRadiusPx + 20);
        ctx.stroke();
      }
    }

    // --- DRAW STRESS VEINS ---
    if (isDeformed) {
      ctx.save();
      ctx.strokeStyle = '#ff3c00';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ff3c00';
      
      if (barrelMaterial === 'cast_bronze') {
        // Radial veins propagating from the void bubble defect at (barrelLeft + 150, centerY - boreRadiusPx - 10)
        const voidX = barrelLeft + 150;
        const voidY = centerY - boreRadiusPx - 10;
        
        ctx.beginPath();
        // Vein 1: down-left into chamber
        ctx.moveTo(voidX, voidY);
        ctx.lineTo(voidX - 15, voidY + 12);
        ctx.lineTo(voidX - 30, voidY + 18);
        
        // Vein 2: down-right into chamber
        ctx.moveTo(voidX, voidY);
        ctx.lineTo(voidX + 18, voidY + 14);
        ctx.lineTo(voidX + 35, voidY + 20);
        
        // Vein 3: left along wall
        ctx.moveTo(voidX, voidY);
        ctx.lineTo(voidX - 25, voidY - 2);
        ctx.lineTo(voidX - 50, voidY - 4);
        
        // Vein 4: right along wall
        ctx.moveTo(voidX, voidY);
        ctx.lineTo(voidX + 25, voidY - 1);
        ctx.lineTo(voidX + 55, voidY - 3);
        ctx.stroke();
      } else {
        // Standard distributed veins for iron and bamboo
        const veinCount = 6;
        for (let i = 0; i < veinCount; i++) {
          let vx = barrelLeft + 60 + i * 50;
          // Don't draw veins in the gaps if ruptured
          if (isRuptured && barrelMaterial === 'wrought_iron' && vx >= barrelLeft + 140 && vx <= barrelLeft + 160) continue;

          // Top wall veins
          ctx.beginPath();
          ctx.moveTo(vx, centerY - boreRadiusPx);
          ctx.lineTo(vx + (i % 2 === 0 ? 5 : -5), centerY - boreRadiusPx - 10);
          ctx.lineTo(vx + (i % 2 === 0 ? 2 : -8), centerY - boreRadiusPx - 18);
          ctx.stroke();

          // Bottom wall veins
          ctx.beginPath();
          ctx.moveTo(vx + 10, centerY + boreRadiusPx);
          ctx.lineTo(vx + 10 + (i % 2 === 0 ? -5 : 5), centerY + boreRadiusPx + 10);
          ctx.lineTo(vx + 10 + (i % 2 === 0 ? -2 : 8), centerY + boreRadiusPx + 18);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // --- DRAW PROPULSION SYSTEM (Inside Chamber) ---
    let pressureGlow = Math.min(1.0, frame.pressure / 12.0); // scale max pressure

    if (frame.stage === 'ignition' || frame.stage === 'pressure' || frame.stage === 'movement') {
      const projPosPx = barrelLeft + (frame.projectileX * barrelLengthPx);
      const fireEndPx = projectileType === 'none' ? (barrelLeft + barrelLengthPx) : projPosPx;

      if (pressureGlow > 0.05) {
        // Red/Orange fire gas glow behind projectile (or all the way out for none)
        let grad = ctx.createLinearGradient(barrelLeft, centerY, fireEndPx, centerY);
        grad.addColorStop(0, '#ff9f1c');
        grad.addColorStop(0.5, '#d94e34');
        grad.addColorStop(1, `rgba(158, 42, 43, ${pressureGlow})`);
        ctx.fillStyle = grad;
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx, fireEndPx - barrelLeft, boreRadiusPx * 2);

        // draw pressure expansion circles
        ctx.strokeStyle = `rgba(255, 159, 28, ${pressureGlow})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 20; r < (fireEndPx - barrelLeft); r += 40) {
          ctx.arc(barrelLeft + r, centerY, boreRadiusPx - 5, 0, Math.PI * 2);
        }
        ctx.stroke();
      } else {
        if (projectileType === 'none') {
          // Render a tied paper packet / pouch inside the chamber
          ctx.save();
          ctx.fillStyle = '#bca085'; // paper color
          ctx.strokeStyle = '#8c7662';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(barrelLeft + 45, centerY, boreRadiusPx - 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw a pouch string tie
          ctx.strokeStyle = '#5c4b3c';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(barrelLeft + 45, centerY - boreRadiusPx + 4);
          ctx.lineTo(barrelLeft + 45, centerY + boreRadiusPx - 4);
          ctx.stroke();
          ctx.restore();
        } else {
          // Just solid unignited gunpowder pile
          ctx.fillStyle = '#222';
          ctx.beginPath();
          ctx.moveTo(barrelLeft, centerY + boreRadiusPx);
          ctx.quadraticCurveTo(barrelLeft + 60, centerY + boreRadiusPx, barrelLeft + 80, centerY + boreRadiusPx - 15);
          ctx.quadraticCurveTo(barrelLeft + 30, centerY - 10, barrelLeft, centerY - 15);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Draw touch-hole matching slow-match descent & weather particles
      if (frame.stage === 'ignition') {
        const expectedDelay = 2.0 + (inputs.weatherHumidity / 100.0) * 8.0 + (100.0 - inputs.primingQuality) * 0.15 + (inputs.propellantProfile === 'damp_partial' ? 8.0 : 0.0) + (frame.foulingIndex || 0.0) * 6.0 + 0.75;
        const progress = Math.min(1.0, frame.timeMs / expectedDelay);
        
        const touchholeX = barrelLeft + 44;
        const touchholeY = centerY - boreRadiusPx - 20;
        const matchTipX = touchholeX;
        const matchTipY = touchholeY - 40 * (1.0 - progress);

        // Draw wooden holder stock
        ctx.strokeStyle = '#5c4b3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(matchTipX + 35, matchTipY - 50);
        ctx.lineTo(matchTipX + 10, matchTipY - 12);
        ctx.stroke();

        // Draw hemp match rope wrapped around it and tip
        ctx.strokeStyle = '#bca085';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(matchTipX + 10, matchTipY - 12);
        ctx.bezierCurveTo(matchTipX + 5, matchTipY - 8, matchTipX, matchTipY - 5, matchTipX, matchTipY);
        ctx.stroke();

        // Glowing match tip (ember)
        ctx.fillStyle = '#ff4500';
        ctx.shadowColor = '#ff8c00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(matchTipX, matchTipY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow

        // Spark shower if touching
        if (progress > 0.9) {
          ctx.strokeStyle = '#d94e34';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) {
            let angle = (i * Math.PI) / 3;
            let rx = Math.cos(angle) * 12;
            let ry = Math.sin(angle) * 12;
            ctx.beginPath();
            ctx.moveTo(touchholeX, touchholeY);
            ctx.lineTo(touchholeX + rx, touchholeY + ry);
            ctx.stroke();
          }
        }

        // Windy: grains of priming powder blowing off
        if (inputs.weatherWind > 0) {
          const windSpeed = inputs.weatherWind / 100.0;
          const grainOffset = (frame.timeMs * 3.0) % 30;
          ctx.fillStyle = '#222';
          ctx.beginPath();
          ctx.arc(touchholeX + 4 + grainOffset * windSpeed * 2.5, touchholeY + 2 - grainOffset * 0.5, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Rainy weather steam puffs on hot barrel
      if (inputs.weatherRain > 0) {
        const rainSpeed = inputs.weatherRain / 100.0;
        const numPuffs = Math.floor(rainSpeed * 4) + 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < numPuffs; i++) {
          const px = barrelLeft + ((frame.timeMs * 83 + i * 173) % barrelLengthPx);
          const py = centerY - boreRadiusPx - 20;
          const radius = (frame.timeMs * 1.5 + i * 4) % 7;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // --- DRAW PROJECTILE & WADDING with Rattling ---
    if (projectileType !== 'none' && frame.stage !== 'flight' && frame.stage !== 'impact' && frame.stage !== 'aftermath') {
      const projX = barrelLeft + (frame.projectileX * (barrelLengthPx - 30));
      
      let wobbleY = 0;
      let drawSparks = false;
      let sparkSide: 'top' | 'bottom' = 'top';

      if (frame.stage === 'movement') {
        // wobble frequency is high, amplitude scaled by aimOffset and projectile clearances
        const freq = 100.0;
        const rawWobble = Math.sin(frame.projectileX * freq);
        const maxWobble = projectileType === 'rough_stone' ? 5.5 : 2.5;
        wobbleY = rawWobble * Math.min(maxWobble, Math.abs(frame.aimOffset) * 2.0);
        
        // Trigger sparks if projectile hits the top/bottom bore walls
        if (Math.abs(wobbleY) > maxWobble - 1.2) {
          drawSparks = true;
          sparkSide = wobbleY < 0 ? 'top' : 'bottom';
        }
      }

      const projY = centerY + wobbleY;

      this.drawProjectile(ctx, projX, projY, boreRadiusPx, projectileType);
      this.drawWadding(ctx, projX, projY, boreRadiusPx, waddingType);

      // Draw sparks
      if (drawSparks) {
        ctx.save();
        ctx.strokeStyle = '#ffdd67';
        ctx.lineWidth = 1.5;
        const sparkX = projX + 15;
        const sparkY = sparkSide === 'top' ? centerY - boreRadiusPx : centerY + boreRadiusPx;
        
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + (Math.random() - 0.5) * 0.5;
          const length = 4 + Math.random() * 5;
          ctx.beginPath();
          ctx.moveTo(sparkX, sparkY);
          ctx.lineTo(sparkX + Math.cos(angle) * length, sparkY + Math.sin(angle) * length);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw windage gas leakage blowing past the ball
      if (frame.leakage > 0.01) {
        ctx.fillStyle = `rgba(230, 195, 135, ${Math.min(1.0, frame.leakage * 2.0)})`;
        // Top gap leak
        ctx.fillRect(projX - 10, centerY - boreRadiusPx, 40, 3);
        // Bottom gap leak
        ctx.fillRect(projX - 10, centerY + boreRadiusPx - 3, 40, 3);
      }
    }

    // --- MUZZLE FLASH ---
    if (frame.stage === 'muzzle_exit') {
      let flashGrad = ctx.createRadialGradient(
        barrelRight, centerY, 5,
        barrelRight, centerY, 45
      );
      flashGrad.addColorStop(0, '#fff');
      flashGrad.addColorStop(0.3, '#ff9f1c');
      flashGrad.addColorStop(0.7, 'rgba(217, 78, 52, 0.5)');
      flashGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(barrelRight, centerY, 50, 0, Math.PI * 2);
      ctx.fill();

      // Smoke cloud
      ctx.fillStyle = 'rgba(100, 90, 80, 0.4)';
      ctx.beginPath();
      ctx.arc(barrelRight + 20, centerY - 10, 25, 0, Math.PI * 2);
      ctx.arc(barrelRight + 35, centerY + 10, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- PRE-EXIT GAS BLOW-BY JETS ---
    if (frame.stage === 'movement' && frame.leakage > 0.01 && frame.projectileX > 0.1 && frame.projectileX < 0.9) {
      ctx.save();
      const leakageFactor = Math.min(1.0, frame.leakage * 2.5);
      const jetLength = 30 + leakageFactor * 40;
      
      let preJetGrad = ctx.createLinearGradient(barrelRight, centerY, barrelRight + jetLength, centerY);
      preJetGrad.addColorStop(0, 'rgba(255, 159, 28, 0.8)');
      preJetGrad.addColorStop(0.4, 'rgba(219, 78, 52, 0.5)');
      preJetGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = preJetGrad;
      ctx.beginPath();
      ctx.moveTo(barrelRight, centerY - 10);
      ctx.lineTo(barrelRight + jetLength, centerY - 4);
      ctx.lineTo(barrelRight + jetLength, centerY + 4);
      ctx.lineTo(barrelRight, centerY + 10);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = 'rgba(120, 110, 100, 0.35)';
      ctx.beginPath();
      ctx.arc(barrelRight + jetLength * 0.7, centerY - 8, 12, 0, Math.PI * 2);
      ctx.arc(barrelRight + jetLength * 0.9, centerY + 6, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }

    // --- DRAW DYNAMIC VENTING PARTICLES ---
    if (frame.leakage > 0.0001) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 159, 28, 0.75)';
      
      // 1. Touch-hole venting particles (drifts upwards)
      const touchholeX = barrelLeft + 44;
      const touchholeY = centerY - boreRadiusPx - 20;
      const tSeed = frame.timeMs * 0.1;
      for (let i = 0; i < 3; i++) {
        const px = touchholeX + (Math.sin(tSeed + i * 1.7) * 4);
        const py = touchholeY - ((tSeed + i * 12) % 25);
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Windage blow-by particles (flows forward out of the muzzle)
      if (frame.stage === 'movement') {
        const projX = barrelLeft + (frame.projectileX * (barrelLengthPx - 30));
        
        // Drifting particles forward from projectile
        for (let i = 0; i < 4; i++) {
          const flowX = projX + 15 + ((tSeed + i * 20) % (barrelRight - projX - 15));
          
          // Top windage leak path
          ctx.beginPath();
          ctx.arc(flowX, centerY - boreRadiusPx + 2 + Math.sin(tSeed + i) * 1.5, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // Bottom windage leak path
          ctx.beginPath();
          ctx.arc(flowX, centerY + boreRadiusPx - 2 + Math.cos(tSeed + i) * 1.5, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // --- DRAW CHEMISTRY & IGNITION ZOOM LENSES ---
    if (!this.xrayMode) {
      if (frame.stage === 'ignition' || frame.stage === 'pressure') {
        this.drawChemistryZoom(
          ctx,
          frame,
          propellantType,
          refinementLevel,
          barrelLeft,
          centerY,
          boreRadiusPx
        );
      }
      if (frame.stage === 'setup' || frame.stage === 'ignition') {
        this.drawIgnitionZoom(
          ctx,
          frame,
          inputs,
          barrelLeft,
          centerY,
          boreRadiusPx
        );
      }
    }

    ctx.restore();

    if (isPaused && !this.xrayMode) {
      this.drawManuscriptCallouts(
        frame,
        projectileType,
        barrelLeft,
        centerY,
        boreRadiusPx,
        barrelLengthPx
      );
    }

    // Premium Visual Polish: Muzzle Exit Lens Flare
    if (frame.stage === 'flight' && frame.projectileX < 4.0) {
      const exitProgress = (frame.projectileX - 1.0) / 3.0; // 0.0 at exit, increases as it flies
      const flareOpacity = Math.max(0.0, 1.0 - exitProgress);
      if (flareOpacity > 0.01) {
        const flareR = 60 * flareOpacity;
        const grad = ctx.createRadialGradient(
          barrelRight, centerY, 2,
          barrelRight, centerY, flareR
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${flareOpacity * 0.95})`);
        grad.addColorStop(0.2, `rgba(255, 183, 3, ${flareOpacity * 0.8})`);
        grad.addColorStop(0.5, `rgba(217, 78, 52, ${flareOpacity * 0.5})`);
        grad.addColorStop(1.0, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(barrelRight, centerY, flareR, 0, Math.PI * 2);
        ctx.fill();

        // Add visual shockwave ring
        ctx.strokeStyle = `rgba(255, 200, 150, ${flareOpacity * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(barrelRight, centerY, flareR * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Premium Visual Polish: Dynamic Idle Sparkles
    if (frame.stage === 'setup' || frame.stage === 'ignition') {
      const touchX = barrelLeft + 44;
      const touchY = centerY - boreRadiusPx - wallThickness;
      const t = performance.now() * 0.001; // elapsed seconds
      for (let i = 0; i < 5; i++) {
        const particleId = i * 2.3;
        const life = (t * 0.5 + particleId) % 1.0;
        const opacity = 1.0 - life;
        const px = touchX + 4 + Math.sin(t * 5 + particleId) * 6;
        const py = touchY - life * 25 - 2;
        const size = (1.5 - life * 0.8);
        ctx.fillStyle = `rgba(255, 159, 28, ${opacity})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    this.cutawayCtx.restore(); // camera shake restore

    // Draw copper-rimmed lens overlay if in xrayMode
    if (this.xrayMode) {
      const ctx = this.cutawayCtx;
      const w = this.cutawayCanvas.width;
      const h = this.cutawayCanvas.height;
      ctx.save();
      
      // Radial lens vignette using copper/rust colors
      const grad = ctx.createRadialGradient(w / 2, h / 2, w / 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(200, 125, 85, 0.0)');
      grad.addColorStop(0.7, 'rgba(120, 65, 35, 0.12)');
      grad.addColorStop(1.0, 'rgba(40, 20, 10, 0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Copper bezel / frame around the edges of the canvas
      ctx.strokeStyle = '#a66846'; // copper metal
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      
      // Subtle inner gold/copper highlight
      ctx.strokeStyle = 'rgba(230, 170, 110, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(7, 7, w - 14, h - 14);

      // Tech details text in corners
      ctx.fillStyle = '#bfa085';
      ctx.font = 'normal 9px Share Tech Mono, monospace';
      ctx.fillText('🔍 METALLURGICAL LENS ACTIVE', 15, 20);
      
      const fatiguePct = (frame.barrelFatigue * 100).toFixed(1);
      ctx.fillStyle = frame.barrelFatigue > 0.8 ? '#ff3c00' : frame.barrelFatigue > 0.4 ? '#ff9f1c' : '#bca085';
      ctx.fillText(`DEGRADATION: ${fatiguePct}%`, w - 130, 20);

      ctx.restore();
    }
  }

  private drawChemistryZoom(
    ctx: CanvasRenderingContext2D,
    frame: ShotFrame,
    propellantType: string,
    refinementLevel: number,
    barrelLeft: number,
    centerY: number,
    boreRadiusPx: number
  ) {
    ctx.save();
    
    // Zoom lens coordinates (scaled up)
    const zoomX = 520;
    const zoomY = 110;
    const zoomR = 60;
    const targetX = barrelLeft + 60; // chamber center
    const targetY = centerY;

    // 1. Draw leader lines (optical zoom cone)
    ctx.strokeStyle = 'rgba(140, 118, 98, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(targetX - 20, targetY - boreRadiusPx);
    ctx.lineTo(zoomX - zoomR, zoomY);
    ctx.moveTo(targetX + 20, targetY - boreRadiusPx);
    ctx.lineTo(zoomX + zoomR, zoomY);
    ctx.stroke();

    // 2. Draw Zoom circle frame with dynamic thermal glow
    const maxTemp = 2500.0;
    const tempIntensity = Math.min(1.0, Math.max(0.0, (frame.temperature - 293.15) / (maxTemp - 293.15)));
    
    ctx.strokeStyle = '#8c7662';
    if (tempIntensity > 0.01) {
      const zoomBgGrad = ctx.createRadialGradient(zoomX, zoomY, 2, zoomX, zoomY, zoomR);
      zoomBgGrad.addColorStop(0, `rgba(255, 120, 30, ${tempIntensity * 0.45})`);
      zoomBgGrad.addColorStop(0.6, `rgba(158, 42, 43, ${tempIntensity * 0.3})`);
      zoomBgGrad.addColorStop(1.0, '#0c0a09');
      ctx.fillStyle = zoomBgGrad;
    } else {
      ctx.fillStyle = '#0c0a09';
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zoomX, zoomY, zoomR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Draw burning grains inside the lens
    const unburnedPercent = (frame.unburnedMass / 0.015) * 100.0;
    const burnProgress = 1.0 - (frame.unburnedMass / 0.015);

    ctx.save();
    // Clip drawing to the zoom circle
    ctx.beginPath();
    ctx.arc(zoomX, zoomY, zoomR, 0, Math.PI * 2);
    ctx.clip();

    if (propellantType === 'corned') {
      // Draw shrinking powder grains (spheres) based on actual grainRadius
      const grainRadius = Math.max(1.5, (frame.grainRadius / 0.0012) * 5.0);
      ctx.fillStyle = '#2d2d2d';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      
      const grainPositions = [
        { dx: -15, dy: -5 }, { dx: -5, dy: -15 }, { dx: 10, dy: -10 },
        { dx: -10, dy: 10 }, { dx: 5, dy: 15 }, { dx: 15, dy: 5 },
        { dx: 0, dy: 0 }
      ];

      const jitterAmp = tempIntensity * 1.5;
      grainPositions.forEach(p => {
        const jitterX = Math.sin(frame.timeMs * 0.1 + p.dx) * jitterAmp;
        const jitterY = Math.cos(frame.timeMs * 0.1 + p.dy) * jitterAmp;

        ctx.beginPath();
        ctx.arc(zoomX + p.dx + jitterX, zoomY + p.dy + jitterY, grainRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // If burning, draw gas particles venting
        if (burnProgress > 0.05 && burnProgress < 0.95) {
          ctx.fillStyle = 'rgba(255, 159, 28, 0.7)';
          ctx.beginPath();
          ctx.arc(zoomX + p.dx + Math.sin(frame.timeMs * 0.02 + p.dx) * 8, zoomY + p.dy + Math.cos(frame.timeMs * 0.02 + p.dy) * 8, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    } else {
      // Loose Meal Powder (solid pile burning from top down)
      const pileHeight = 25 * (1.0 - burnProgress);
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.moveTo(zoomX - zoomR, zoomY + zoomR);
      ctx.quadraticCurveTo(zoomX, zoomY + zoomR - pileHeight * 2, zoomX + zoomR, zoomY + zoomR);
      ctx.closePath();
      ctx.fill();

      // Fire line
      if (burnProgress > 0.05 && burnProgress < 0.95) {
        ctx.strokeStyle = '#ff9f1c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const fireJitter = Math.sin(frame.timeMs * 0.2) * (1.0 + tempIntensity * 2.0);
        ctx.moveTo(zoomX - zoomR + 5, zoomY + zoomR - pileHeight - 2 + fireJitter);
        ctx.quadraticCurveTo(zoomX, zoomY + zoomR - pileHeight * 2 - 2 - fireJitter, zoomX + zoomR - 5, zoomY + zoomR - pileHeight - 2 + fireJitter);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 4. Draw Chemistry Callout text (Right of Zoom Circle)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bca085';
    ctx.font = 'italic 13px Lora, serif';
    ctx.fillText('fig 1b. Alchemical Calcination', zoomX + zoomR + 15, zoomY - 24);
    
    ctx.fillStyle = '#ff9f1c';
    ctx.font = 'normal 11px Share Tech Mono, monospace';
    ctx.fillText(`Tempest: ${frame.temperature.toFixed(0)} K`, zoomX + zoomR + 15, zoomY - 8);

    ctx.fillStyle = '#8c7662';
    ctx.font = 'normal 12px Share Tech Mono, monospace';
    ctx.fillText('2KNO₃ + 3C + S ➜ K₂S + N₂ + 3CO₂', zoomX + zoomR + 15, zoomY + 8);

    // Stats
    const gasYield = refinementLevel * 0.45;
    const ashResidue = 100.0 - gasYield;
    ctx.font = 'normal 11px Share Tech Mono, monospace';
    ctx.fillStyle = '#6e5e4f';
    ctx.fillText(`Unburned Grains: ${unburnedPercent.toFixed(0)}%`, zoomX + zoomR + 15, zoomY + 24);
    ctx.fillText(`Gas Yield: ${gasYield.toFixed(0)}% / Ash: ${ashResidue.toFixed(0)}%`, zoomX + zoomR + 15, zoomY + 38);

    ctx.restore();
  }

  private drawIgnitionZoom(
    ctx: CanvasRenderingContext2D,
    frame: ShotFrame,
    inputs: ShotInput,
    barrelLeft: number,
    centerY: number,
    boreRadiusPx: number
  ) {
    ctx.save();
    
    // Zoom lens coordinates (scaled up and shifted for spacing)
    const zoomX = 200;
    const zoomY = 110;
    const zoomR = 60;
    
    const touchholeX = barrelLeft + 44;
    const touchholeY = centerY - boreRadiusPx - 20;

    // 1. Draw leader lines (optical zoom cone)
    ctx.strokeStyle = 'rgba(140, 118, 98, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(touchholeX - 6, touchholeY);
    ctx.lineTo(zoomX - zoomR, zoomY);
    ctx.moveTo(touchholeX + 6, touchholeY);
    ctx.lineTo(zoomX + zoomR, zoomY);
    ctx.stroke();

    // 2. Draw Zoom circle frame
    ctx.strokeStyle = '#8c7662';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#0c0a09';
    ctx.beginPath();
    ctx.arc(zoomX, zoomY, zoomR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Clip to zoom circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(zoomX, zoomY, zoomR, 0, Math.PI * 2);
    ctx.clip();

    // 3. Draw touchhole channel structure inside zoom
    ctx.strokeStyle = '#3d3228';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(zoomX - 12, zoomY - zoomR);
    ctx.lineTo(zoomX - 12, zoomY + zoomR);
    ctx.moveTo(zoomX + 12, zoomY - zoomR);
    ctx.lineTo(zoomX + 12, zoomY + zoomR);
    ctx.stroke();

    // 4. Draw priming grains at the bottom
    const grainOffsets = [
      { dx: -8, dy: 22 }, { dx: -2, dy: 28 }, { dx: 6, dy: 25 },
      { dx: -6, dy: 16 }, { dx: 0, dy: 20 }, { dx: 8, dy: 15 },
      { dx: -3, dy: 10 }, { dx: 4, dy: 8 }
    ];

    const expectedDelay = 2.0 + (inputs.weatherHumidity / 100.0) * 8.0 + (100.0 - inputs.primingQuality) * 0.15 + (inputs.propellantProfile === 'damp_partial' ? 8.0 : 0.0) + (frame.foulingIndex || 0.0) * 6.0 + 0.75;
    const progress = frame.stage === 'ignition' ? Math.min(1.0, frame.timeMs / expectedDelay) : 0.0;
    
    // Draw descending slow-match tip inside zoom
    const matchY = zoomY - zoomR + progress * 60;
    
    // Draw matches inside zoom
    if (frame.stage === 'ignition') {
      ctx.strokeStyle = '#bca085';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(zoomX, zoomY - zoomR);
      ctx.lineTo(zoomX, matchY);
      ctx.stroke();

      ctx.fillStyle = '#ff4500';
      ctx.beginPath();
      ctx.arc(zoomX, matchY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    grainOffsets.forEach((g) => {
      const gx = zoomX + g.dx;
      const gy = zoomY + g.dy;
      
      // Grains ignite from top down based on progress
      const grainProgress = (gy - (zoomY - zoomR)) / (zoomR * 2);
      const isIgnited = progress > grainProgress * 0.8;
      const isMisfire = frame.warnings.some(w => w.includes("failed") || w.includes("Misfire"));

      if (isIgnited && !isMisfire) {
        // Glowing hot orange grain
        ctx.fillStyle = '#ff8c00';
        ctx.strokeStyle = '#ff3c00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Unignited grey/black grain
        ctx.fillStyle = '#2d2d2d';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, gy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // Fire column if fully ignited
    if (progress > 0.6 && !frame.warnings.some(w => w.includes("failed"))) {
      let fireGrad = ctx.createLinearGradient(zoomX, zoomY - zoomR, zoomX, zoomY + zoomR);
      fireGrad.addColorStop(0, '#ff9f1c');
      fireGrad.addColorStop(0.5, '#d94e34');
      fireGrad.addColorStop(1, '#ff3c00');
      ctx.fillStyle = fireGrad;
      ctx.fillRect(zoomX - 10, zoomY - zoomR, 20, zoomR * 2);
    }

    ctx.restore(); // restore clip

    // 5. Draw callout labels to the left of the zoom lens (ensuring positive bounds)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bca085';
    ctx.font = 'italic 13px Lora, serif';
    ctx.fillText('fig 1a. Touch-hole Priming', 15, zoomY - 24);
    
    ctx.fillStyle = '#8c7662';
    ctx.font = 'normal 11px Share Tech Mono, monospace';
    ctx.fillText(`Priming: ${inputs.primingQuality.toFixed(0)}%`, 15, zoomY - 8);
    
    let weatherPenalty = 0;
    if (inputs.weatherHumidity > 50) weatherPenalty += 2;
    if (inputs.weatherWind > 50) weatherPenalty += 1.5;
    if (inputs.weatherRain > 10) weatherPenalty += 3.5;
    
    ctx.fillText(`Dwell Penalty: +${weatherPenalty.toFixed(1)}ms`, 15, zoomY + 8);
    ctx.fillText(frame.stage === 'ignition' ? 'STATUS: SPARKING' : 'STATUS: READY', 15, zoomY + 24);

    ctx.restore();
  }

  public getTooltipAt(x: number, y: number): string | null {
    if (this.xrayMode) {
      return null;
    }
    // Check Chemistry Lens
    const distChem = Math.sqrt((x - 520) ** 2 + (y - 110) ** 2);
    if (distChem <= 60) {
      return "fig 1b. Alchemical Calcination: Shows active combustion temperature and stoichiometry gas yields.";
    }
    // Check Ignition Lens
    const distIgn = Math.sqrt((x - 200) ** 2 + (y - 110) ** 2);
    if (distIgn <= 60) {
      return "fig 1a. Touch-hole Priming: Displays match-lock ignition delay, powder state, and humidity dwell penalties.";
    }
    return null;
  }

  private drawManuscriptCallouts(
    frame: ShotFrame,
    projectileType: string,
    barrelLeft: number,
    centerY: number,
    boreRadiusPx: number,
    barrelLengthPx: number
  ) {
    const ctx = this.cutawayCtx;
    const wallThickness = this.xrayMode ? 26 : 20;
    ctx.save();
    ctx.strokeStyle = '#8c7662';
    ctx.fillStyle = '#bca085';
    ctx.font = 'italic 13px Lora, serif';
    ctx.lineWidth = 1;

    // Helper to draw leader line with a tiny ring
    const drawLeader = (tx: number, ty: number, ix: number, iy: number, lx: number) => {
      // Draw tiny circle at target
      ctx.beginPath();
      ctx.arc(tx, ty, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#8c7662';
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.lineTo(ix + lx, iy);
      ctx.stroke();
    };

    // 1. Chamber Pressure Callout
    const pressTx = barrelLeft + 55;
    const pressTy = centerY - 5;
    const pressIx = barrelLeft + 30;
    const pressIy = centerY - 55;
    drawLeader(pressTx, pressTy, pressIx, pressIy, -45);
    ctx.fillText(`fig 1c. Pressure (P): ${frame.pressure.toFixed(1)} MPa`, Math.max(10, pressIx - 135), pressIy - 4);

    // 2. Windage Gap & Rattle Deflection (only if projectile is inside the barrel)
    if (frame.stage !== 'flight' && frame.stage !== 'impact' && frame.stage !== 'aftermath') {
      const projX = barrelLeft + (frame.projectileX * (barrelLengthPx - 30));
      
      // Determine windage gap based on projectile type
      let gapSize = '1.0';
      if (projectileType === 'rough_stone') gapSize = '2.5 (loose)';
      else if (projectileType === 'lead_arrow') gapSize = '1.5';
      else if (projectileType === 'pebbles') gapSize = '3.5 (scattered)';
      
      // Draw Windage Callout (dynamic direction to prevent overlapping zoom lens)
      let gapDirection = -1; // left
      if (projX < 150) {
        gapDirection = 1; // right
      }

      const gapTx = projX + 15;
      const gapTy = centerY - boreRadiusPx + 3;
      const gapIx = projX + (gapDirection === -1 ? -15 : 15);
      const gapIy = centerY - boreRadiusPx - 40;
      drawLeader(gapTx, gapTy, gapIx, gapIy, gapDirection * 50);
      
      ctx.save();
      if (gapDirection === -1) {
        ctx.textAlign = 'right';
        ctx.fillText(`fig 1d. Windage Gap: ${gapSize}mm`, gapIx - 50, gapIy - 4);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(`fig 1d. Windage Gap: ${gapSize}mm`, gapIx + 50, gapIy - 4);
      }
      ctx.restore();

      // Draw Rattle / Aim Deflection Callout if it's moving or setup
      if (frame.stage === 'movement' || frame.stage === 'setup' || frame.stage === 'ignition') {
        const rattleTx = projX + 20;
        const rattleTy = centerY + boreRadiusPx - 3;
        const rattleIx = projX + 45;
        const rattleIy = centerY + boreRadiusPx + 40;
        drawLeader(rattleTx, rattleTy, rattleIx, rattleIy, 50);
        ctx.fillText(`fig 1e. Aim Jitter: ${frame.aimOffset.toFixed(1)}°`, rattleIx + 5, rattleIy - 4);
      }
    }

    // 3. Convective Wall Loss Callout (pointing to top wall)
    const lossTx = barrelLeft + 220;
    const lossTy = centerY - boreRadiusPx - wallThickness;
    const lossIx = barrelLeft + 250;
    const lossIy = centerY - boreRadiusPx - wallThickness - 30;
    drawLeader(lossTx, lossTy, lossIx, lossIy, 40);
    ctx.fillText(`fig 1f. Convective Wall Loss: ${frame.wallHeatLoss.toFixed(0)} J`, lossIx + 45, lossIy - 4);

    // 4. Carbonaceous Crust Callout (pointing to top soot layer)
    const sootTx = barrelLeft + 150;
    const sootTy = centerY - boreRadiusPx + 2;
    const sootIx = barrelLeft + 120;
    const sootIy = centerY - boreRadiusPx - wallThickness - 30;
    drawLeader(sootTx, sootTy, sootIx, sootIy, -40);
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillText(`fig 1g. Carbon Crust: ${(frame.foulingIndex * 100).toFixed(0)}% Fouled`, sootIx - 45, sootIy - 4);
    ctx.restore();

    // 5. Fuel Consumption Callout (pointing to powder charge)
    if (frame.stage === 'ignition' || frame.stage === 'pressure' || frame.stage === 'movement' || frame.stage === 'setup') {
      const fuelTx = barrelLeft + 25;
      const fuelTy = centerY + 10;
      const fuelIx = barrelLeft - 10;
      const fuelIy = centerY + boreRadiusPx + 40;
      drawLeader(fuelTx, fuelTy, fuelIx, fuelIy, -35);
      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillText(`fig 1h. Unspent Fuel: ${(frame.unburnedMass * 1000).toFixed(2)}g`, Math.max(10, fuelIx - 35), fuelIy - 4);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, type: string) {
    ctx.save();
    ctx.strokeStyle = '#4e4034';
    ctx.lineWidth = 1.5;

    if (type === 'lead_ball') {
      // Solid lead ball
      ctx.fillStyle = '#646870';
      ctx.beginPath();
      ctx.arc(x + 15, y, r - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ball highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(x + 10, y - 5, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'rough_stone') {
      // Jagged stone circle
      ctx.fillStyle = '#837a71';
      ctx.beginPath();
      const sides = 8;
      for (let i = 0; i < sides; i++) {
        let angle = (i * Math.PI * 2) / sides;
        let offset = ((i % 3) - 1) * 2; 
        let rx = x + 15 + Math.cos(angle) * (r - 5 + offset);
        let ry = y + Math.sin(angle) * (r - 5 + offset);
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (type === 'lead_arrow') {
      // Bolt / arrow shape
      ctx.fillStyle = '#cfa86b';
      ctx.fillRect(x - 10, y - 3, 35, 6);
      
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.moveTo(x + 25, y - 8);
      ctx.lineTo(x + 35, y);
      ctx.lineTo(x + 25, y + 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c5a059';
      ctx.fillRect(x - 15, y - 8, 8, 3);
      ctx.fillRect(x - 15, y + 5, 8, 3);
    } else if (type === 'pebbles') {
      // Cluster of pebbles
      ctx.fillStyle = '#7a7065';
      ctx.beginPath();
      ctx.arc(x + 8, y - 8, 4, 0, Math.PI * 2);
      ctx.arc(x + 20, y - 5, 3, 0, Math.PI * 2);
      ctx.arc(x + 10, y + 6, 4, 0, Math.PI * 2);
      ctx.arc(x + 22, y + 8, 3, 0, Math.PI * 2);
      ctx.arc(x + 16, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawWadding(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, wadding: string) {
    if (wadding === 'none') return;
    
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#221c15';

    if (wadding === 'tow') {
      ctx.fillStyle = '#c5b090';
      ctx.fillRect(x - 6, y - r + 2, 6, r * 2 - 4);
      
      ctx.strokeStyle = '#8c7b64';
      ctx.beginPath();
      for (let i = y - r + 5; i < y + r - 5; i += 4) {
        ctx.moveTo(x - 6, i);
        ctx.lineTo(x, i + 2);
      }
      ctx.stroke();
    } else if (wadding === 'clay') {
      ctx.fillStyle = '#5c5e5b';
      ctx.fillRect(x - 8, y - r + 1, 8, r * 2 - 2);
      ctx.strokeRect(x - 8, y - r + 1, 8, r * 2 - 2);
    }

    ctx.restore();
  }

  private drawTargetRange(
    frame: ShotFrame,
    projectileType: string,
    history: Array<{ inputs: ShotInput; frames: ShotFrame[] }> = [],
    inputs?: ShotInput
  ) {
    const ctx = this.trajectoryCtx;
    const rangeLeft = 40;
    const rangeWidth = 520;
    const groundY = 360;
    const shooterHeightY = groundY - 48; // aligned with 1.2m launch height

    // Draw Weather Overlays on Range (behind the target and curves)
    if (inputs) {
      const humidity = inputs.weatherHumidity;
      const wind = inputs.weatherWind;
      const rain = inputs.weatherRain;

      // 1. Fog / Mist (Humidity)
      if (humidity > 50) {
        ctx.save();
        const mistGrad = ctx.createLinearGradient(0, groundY - 280, 0, groundY);
        const opacity = Math.min(0.35, (humidity - 50) / 100);
        mistGrad.addColorStop(0, `rgba(100, 100, 100, 0.0)`);
        mistGrad.addColorStop(1, `rgba(120, 120, 120, ${opacity})`);
        ctx.fillStyle = mistGrad;
        ctx.fillRect(rangeLeft, groundY - 280, rangeWidth, 280);
        ctx.restore();
      }

      // 2. Wind flows
      if (wind > 10) {
        ctx.save();
        ctx.strokeStyle = `rgba(180, 170, 160, ${Math.min(0.20, wind / 400)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([30, 90]);
        const scrollOffset = (frame.timeMs * 2.0) % 200;
        ctx.beginPath();
        for (let y = groundY - 260; y < groundY; y += 45) {
          ctx.moveTo(rangeLeft - scrollOffset, y);
          ctx.bezierCurveTo(
            rangeLeft + rangeWidth/3 - scrollOffset, y - 8,
            rangeLeft + 2*rangeWidth/3 - scrollOffset, y + 8,
            rangeLeft + rangeWidth - scrollOffset + 150, y
          );
        }
        ctx.stroke();
        ctx.restore();
      }

      // 3. Rain drops (angle scales with wind speed)
      if (rain > 10) {
        ctx.save();
        ctx.strokeStyle = `rgba(100, 120, 150, ${Math.min(0.35, rain / 150)})`;
        ctx.lineWidth = 1;
        const tSeed = Math.round(frame.timeMs * 0.4) % 10;
        const rainAngle = (wind / 100) * 15; // 0 to 15 degrees angle
        ctx.beginPath();
        for (let x = rangeLeft - 50; x < rangeLeft + rangeWidth + 50; x += 18) {
          const yOffset = (tSeed * 12) % 40;
          for (let y = groundY - 280 + yOffset; y < groundY; y += 40) {
            const dx = Math.tan(rainAngle * Math.PI / 180) * 25;
            ctx.moveTo(x + dx, y);
            ctx.lineTo(x, y + 25);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw ground
    ctx.strokeStyle = '#2d241c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rangeLeft, groundY);
    ctx.lineTo(rangeLeft + rangeWidth, groundY);
    ctx.stroke();

    const targetX = rangeLeft + rangeWidth - 40;
    const targetCenterY = groundY - 60;
    const targetArmor = inputs?.targetArmorType || 'silk_lamellar';

    // Draw target stand legs (common to all)
    ctx.strokeStyle = '#6e5e4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(targetX, targetCenterY);
    ctx.lineTo(targetX - 15, groundY);
    ctx.moveTo(targetX, targetCenterY);
    ctx.lineTo(targetX + 15, groundY);
    ctx.stroke();

    ctx.save();
    if (targetArmor === 'woven_bamboo') {
      // Draw Woven Bamboo check patterns target
      ctx.fillStyle = '#bfb37c'; // light bamboo tan
      ctx.strokeStyle = '#6d5a3e';
      ctx.lineWidth = 1.5;
      
      // Draw a square shield for bamboo
      ctx.fillRect(targetX - 20, targetCenterY - 20, 40, 40);
      ctx.strokeRect(targetX - 20, targetCenterY - 20, 40, 40);
      
      // Draw woven grid lines
      ctx.strokeStyle = 'rgba(109, 90, 62, 0.4)';
      ctx.beginPath();
      for (let offset = -15; offset <= 15; offset += 5) {
        ctx.moveTo(targetX + offset, targetCenterY - 20);
        ctx.lineTo(targetX + offset, targetCenterY + 20);
        ctx.moveTo(targetX - 20, targetCenterY + offset);
        ctx.lineTo(targetX + 20, targetCenterY + offset);
      }
      ctx.stroke();

    } else if (targetArmor === 'silk_lamellar') {
      // Draw Silk Lamellar (overlapping small red scales)
      ctx.fillStyle = '#851c1c'; // crimson silk
      ctx.strokeStyle = '#cfa86b'; // gold borders
      ctx.lineWidth = 1.5;
      
      // Oval plate
      ctx.beginPath();
      ctx.ellipse(targetX, targetCenterY, 20, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw overlapping scales rows
      ctx.fillStyle = '#a12b2b';
      ctx.strokeStyle = 'rgba(207, 168, 107, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let yOffset = -15; yOffset <= 15; yOffset += 8) {
        for (let xOffset = -12; xOffset <= 12; xOffset += 6) {
          if (Math.abs(xOffset) < 15 && Math.abs(yOffset) < 20) {
            ctx.rect(targetX + xOffset - 2, targetCenterY + yOffset - 3, 4, 6);
          }
        }
      }
      ctx.fill();
      ctx.stroke();

    } else if (targetArmor === 'oak_wood') {
      // Draw Oak Planks (horizontal planks with grain)
      ctx.fillStyle = '#b07d4e'; // wood tan
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = 2;
      
      // Draw circular thick shield
      ctx.beginPath();
      ctx.arc(targetX, targetCenterY, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw plank horizontal cut lines
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(targetX - 24, targetCenterY - 8);
      ctx.lineTo(targetX + 24, targetCenterY - 8);
      ctx.moveTo(targetX - 24, targetCenterY + 8);
      ctx.lineTo(targetX + 24, targetCenterY + 8);
      ctx.stroke();

      // Draw subtle wood grains
      ctx.strokeStyle = 'rgba(90, 61, 34, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(targetX - 5, targetCenterY, 15, 0, Math.PI, true);
      ctx.stroke();

    } else if (targetArmor === 'wrought_iron') {
      // Draw Wrought Iron Plate (metallic grey with rivets)
      ctx.fillStyle = '#4e5359'; // iron grey
      ctx.strokeStyle = '#1d1f22';
      ctx.lineWidth = 2;
      
      // Heavy square plate
      ctx.fillRect(targetX - 22, targetCenterY - 22, 44, 44);
      ctx.strokeRect(targetX - 22, targetCenterY - 22, 44, 44);

      // Draw shiny reflection line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(targetX - 22, targetCenterY - 22);
      ctx.lineTo(targetX + 5, targetCenterY - 22);
      ctx.lineTo(targetX - 10, targetCenterY + 22);
      ctx.lineTo(targetX - 22, targetCenterY + 22);
      ctx.closePath();
      ctx.fill();

      // Draw corner rivets
      ctx.fillStyle = '#2d3034';
      ctx.beginPath();
      ctx.arc(targetX - 17, targetCenterY - 17, 2, 0, Math.PI * 2);
      ctx.arc(targetX + 17, targetCenterY - 17, 2, 0, Math.PI * 2);
      ctx.arc(targetX - 17, targetCenterY + 17, 2, 0, Math.PI * 2);
      ctx.arc(targetX + 17, targetCenterY + 17, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Cache actual flight height before overloading
    let actualImpactY = frame.projectileY;
    const flightFramesOnly = this.activeFrames.filter(f => f.stage === 'flight');
    if (flightFramesOnly.length > 0) {
      actualImpactY = flightFramesOnly[flightFramesOnly.length - 1].projectileY;
    }

    // --- DRAW PREVIOUS TRAJECTORY (as a faded shadow) ---
    if (history && history.length > 0) {
      history.forEach((histItem, j) => {
        const d = history.length - 1 - j;
        const lineOpacity = Math.max(0.04, 0.35 * Math.pow(0.5, d));
        const dotOpacity = Math.max(0.08, 0.60 * Math.pow(0.5, d));

        ctx.save();
        ctx.strokeStyle = `rgba(140, 118, 98, ${lineOpacity})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);

        const prevFlightOnly = histItem.frames.filter(f => f.stage === 'flight');

        if (prevFlightOnly.length > 0) {
          ctx.beginPath();
          ctx.moveTo(rangeLeft, shooterHeightY);
          
          prevFlightOnly.forEach(f => {
            const prog = Math.min(1.0, f.projectileX / 35.0);
            const px = rangeLeft + (prog * (rangeWidth - 40));
            const py = groundY - (f.projectileY * 40.0);
            ctx.lineTo(px, py);
          });
          ctx.stroke();

          // Draw faded previous impact point
          const lastPrevFrame = prevFlightOnly[prevFlightOnly.length - 1];
          const lastProg = Math.min(1.0, lastPrevFrame.projectileX / 35.0);
          const lastPx = rangeLeft + (lastProg * (rangeWidth - 40));
          const lastPy = groundY - (lastPrevFrame.projectileY * 40.0);

          ctx.fillStyle = `rgba(140, 118, 98, ${dotOpacity})`;
          ctx.beginPath();
          ctx.arc(lastPx, lastPy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    // --- DRAW CURRENT FLIGHT TRAJECTORY ---
    if (frame.stage === 'flight' || frame.stage === 'impact' || frame.stage === 'aftermath') {
      ctx.save();
      ctx.strokeStyle = 'rgba(207, 168, 107, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      
      const currentFlightFrames = this.activeFrames.filter(
        f => f.stage === 'flight' && f.timeMs <= frame.timeMs
      );

      if (currentFlightFrames.length > 0) {
        ctx.beginPath();
        ctx.moveTo(rangeLeft, shooterHeightY);
        currentFlightFrames.forEach(f => {
          const prog = Math.min(1.0, f.projectileX / 35.0);
          const px = rangeLeft + (prog * (rangeWidth - 40));
          const py = groundY - (f.projectileY * 40.0);
          ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Draw dot at current projectile position
        const tipFrame = currentFlightFrames[currentFlightFrames.length - 1];
        const tipProg = Math.min(1.0, tipFrame.projectileX / 35.0);
        const tipPx = rangeLeft + (tipProg * (rangeWidth - 40));
        const tipPy = groundY - (tipFrame.projectileY * 40.0);

        ctx.fillStyle = '#646870';
        ctx.beginPath();
        ctx.arc(tipPx, tipPy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (frame.aimOffset !== 0.0) {
        ctx.fillStyle = '#6e5e4f';
        ctx.font = '10px Share Tech Mono, monospace';
        const flightProgress = Math.min(1.0, frame.projectileX / 35.0);
        const currentFlightX = rangeLeft + (flightProgress * (rangeWidth - 40));
        const currentFlightY = groundY - (frame.stage === 'flight' ? frame.projectileY : actualImpactY) * 40.0;
        ctx.fillText(`Drift: ${frame.aimOffset.toFixed(1)}°`, currentFlightX - 20, currentFlightY - 10);
      }

      ctx.restore();
    }

    // --- DRAW IMPACT AND TARGET DESTRUCTION DEBRIS ---
    if (frame.stage === 'impact' || frame.stage === 'aftermath') {
      const finalProgress = Math.min(1.0, frame.projectileX / 35.0);
      const impactX = rangeLeft + (finalProgress * (rangeWidth - 40));
      const impactY = groundY - (actualImpactY * 40.0);

      const isHit = impactX >= targetX - 10 && Math.abs(impactY - targetCenterY) < 30;

      ctx.save();
      if (isHit) {
        // Draw target fracture cracks
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (targetArmor === 'wrought_iron') {
          ctx.arc(impactX, impactY, 5, 0, Math.PI * 2);
          ctx.arc(impactX, impactY, 12, 0, Math.PI * 2);
        } else {
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            ctx.moveTo(impactX, impactY);
            ctx.lineTo(impactX + Math.cos(angle) * 14, impactY + Math.sin(angle) * 14);
          }
        }
        ctx.stroke();

        // Draw projectile deformation or splinters
        if (projectileType === 'rough_stone' || projectileType === 'pebbles') {
          // Brittle stone fracture
          ctx.fillStyle = '#6d655d';
          ctx.beginPath();
          for (let k = 0; k < 12; k++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 3 + Math.random() * 15;
            const size = 1.5 + Math.random() * 2.5;
            ctx.rect(impactX + Math.cos(angle) * dist - size/2, impactY + Math.sin(angle) * dist - size/2, size, size);
          }
          ctx.fill();
        } else {
          // Lead malleable deformation
          ctx.fillStyle = '#a3a8b0';
          ctx.strokeStyle = '#4e5359';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(impactX, impactY, 6, 3, Math.PI / 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Draw wood/bamboo splinters
        if (targetArmor === 'oak_wood' || targetArmor === 'woven_bamboo') {
          ctx.fillStyle = targetArmor === 'oak_wood' ? '#8e5d34' : '#bfb37c';
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const angle = Math.PI/2 + (Math.random() - 0.5) * Math.PI;
            const dist = 4 + Math.random() * 14;
            ctx.rect(impactX + Math.cos(angle) * dist, impactY + Math.sin(angle) * dist, 1, 4);
          }
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(impactX, impactY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = '#cfa86b';
      ctx.font = 'bold 11px Cinzel, serif';
      if (isHit) {
        ctx.fillStyle = '#8ac926';
        ctx.fillText('HIT!', targetX - 12, targetCenterY - 35);
      } else {
        ctx.fillStyle = '#9e2a2b';
        ctx.fillText('MISS', targetX - 15, targetCenterY - 35);
      }
    }
  }
}
