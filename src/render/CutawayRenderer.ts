import { ShotFrame, ShotInput } from '../types';

const BARREL_LIMITS: Record<string, { yield: number; ultimate: number }> = {
  bamboo: { yield: 30.0, ultimate: 45.0 },
  wrought_iron: { yield: 130.0, ultimate: 220.0 },
  cast_bronze: { yield: 160.0, ultimate: 280.0 },
};

export class CutawayRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sootLevel: number = 0; // accumulated fouling level

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  public setSootLevel(level: number) {
    this.sootLevel = level;
  }

  public clear() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Draw parchment paper background texture
    ctx.fillStyle = '#181512';
    ctx.fillRect(0, 0, w, h);

    // Subtle Leonardo parchment grid lines
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1;
    
    // Horizontal rule
    ctx.beginPath();
    ctx.moveTo(50, h / 2);
    ctx.lineTo(w - 50, h / 2);
    ctx.stroke();

    // Center divider
    ctx.beginPath();
    ctx.moveTo(550, 30);
    ctx.lineTo(550, h - 30);
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw alchemical notebook labels
    ctx.fillStyle = '#6e5e4f';
    ctx.font = 'italic 12px Lora, serif';
    ctx.fillText('fig 1. Barrel Cutaway (Scale 1:1)', 70, 45);
    ctx.fillText('fig 2. Range & Target Projection (35m)', 580, 45);
  }

  public drawFrame(
    frame: ShotFrame,
    inputs: ShotInput,
    isPaused: boolean = false
  ) {
    this.clear();
    const ctx = this.ctx;
    
    const barrelLeft = 100;
    const barrelLengthPx = 320;
    const barrelRight = barrelLeft + barrelLengthPx;
    const centerY = 200;
    const boreRadiusPx = 25; // radius of inside bore in pixels

    const barrelMaterial = inputs.barrelMaterial;
    const projectileType = inputs.projectileType;
    const waddingType = inputs.sealingQuality;
    const propellantType = inputs.propellantType;
    const refinementLevel = inputs.refinementLevel;

    // Update soot level
    if (frame.fouling > this.sootLevel) {
      this.sootLevel = frame.fouling;
    }

    // --- DRAW TARGET RANGE (Right Side) ---
    this.drawTargetRange(frame, projectileType);

    // --- DRAW BARREL METALLURGY (Left Side) ---
    ctx.save();
    
    // Draw barrel block based on material
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3d3228';
    
    // Determine metal color based on material
    let wallColor = '#2d241c'; // default iron
    if (barrelMaterial === 'bamboo') {
      wallColor = '#4a422a';
    } else if (barrelMaterial === 'cast_bronze') {
      wallColor = '#5c4832';
    }

    // Evaluate failure states using physical limits
    const limits = BARREL_LIMITS[barrelMaterial] || BARREL_LIMITS.cast_bronze;
    const isDeformed = frame.barrelStress >= limits.yield;
    const isRuptured = frame.barrelStress >= limits.ultimate;

    const stressFactor = frame.barrelStress / limits.ultimate;
    const redGlow = Math.min(1.0, stressFactor);

    // Inside bore background
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(barrelLeft, centerY - boreRadiusPx, barrelLengthPx, boreRadiusPx * 2);

    // Draw Soot deposits (Fouling) inside the bore walls
    if (this.sootLevel > 0.02) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, this.sootLevel * 0.95)})`;
      ctx.fillRect(barrelLeft, centerY - boreRadiusPx, barrelLengthPx, 4);
      ctx.fillRect(barrelLeft, centerY + boreRadiusPx - 4, barrelLengthPx, 4);
    }

    if (isRuptured) {
      // Material-specific ruptured animations
      if (barrelMaterial === 'bamboo') {
        ctx.fillStyle = wallColor;
        // Top wall split left
        ctx.save();
        ctx.translate(barrelLeft, centerY - boreRadiusPx - 20);
        ctx.rotate(-0.08);
        ctx.fillRect(0, -10, barrelLengthPx / 2, 20);
        ctx.strokeRect(0, -10, barrelLengthPx / 2, 20);
        ctx.restore();

        // Top wall split right
        ctx.save();
        ctx.translate(barrelLeft + barrelLengthPx / 2, centerY - boreRadiusPx - 20);
        ctx.rotate(0.08);
        ctx.fillRect(0, -10, barrelLengthPx / 2, 20);
        ctx.strokeRect(0, -10, barrelLengthPx / 2, 20);
        ctx.restore();

        // Bottom wall split left
        ctx.save();
        ctx.translate(barrelLeft, centerY + boreRadiusPx);
        ctx.rotate(0.08);
        ctx.fillRect(0, 10, barrelLengthPx / 2, 20);
        ctx.strokeRect(0, 10, barrelLengthPx / 2, 20);
        ctx.restore();

        // Bottom wall split right
        ctx.save();
        ctx.translate(barrelLeft + barrelLengthPx / 2, centerY + boreRadiusPx);
        ctx.rotate(-0.08);
        ctx.fillRect(0, 10, barrelLengthPx / 2, 20);
        ctx.strokeRect(0, 10, barrelLengthPx / 2, 20);
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
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx - 20, 140, 20);
        ctx.strokeRect(barrelLeft, centerY - boreRadiusPx - 20, 140, 20);
        ctx.fillRect(barrelLeft, centerY + boreRadiusPx, 140, 20);
        ctx.strokeRect(barrelLeft, centerY + boreRadiusPx, 140, 20);

        // Split right half of walls
        ctx.fillRect(barrelLeft + 160, centerY - boreRadiusPx - 20, barrelLengthPx - 160, 20);
        ctx.strokeRect(barrelLeft + 160, centerY - boreRadiusPx - 20, barrelLengthPx - 160, 20);
        ctx.fillRect(barrelLeft + 160, centerY + boreRadiusPx, barrelLengthPx - 160, 20);
        ctx.strokeRect(barrelLeft + 160, centerY + boreRadiusPx, barrelLengthPx - 160, 20);

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
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx - 20, 110, 20);
        ctx.strokeRect(barrelLeft, centerY - boreRadiusPx - 20, 110, 20);
        ctx.fillRect(barrelLeft, centerY + boreRadiusPx, 110, 20);
        ctx.strokeRect(barrelLeft, centerY + boreRadiusPx, 110, 20);

        ctx.fillRect(barrelLeft + 190, centerY - boreRadiusPx - 20, barrelLengthPx - 190, 20);
        ctx.strokeRect(barrelLeft + 190, centerY - boreRadiusPx - 20, barrelLengthPx - 190, 20);
        ctx.fillRect(barrelLeft + 190, centerY + boreRadiusPx, barrelLengthPx - 190, 20);
        ctx.strokeRect(barrelLeft + 190, centerY + boreRadiusPx, barrelLengthPx - 190, 20);

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
      ctx.fillRect(barrelLeft, centerY - boreRadiusPx - 20, barrelLengthPx, 20);
      if (redGlow > 0.01) {
        ctx.fillStyle = `rgba(158, 42, 43, ${redGlow * 0.75})`;
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx - 20, barrelLengthPx, 20);
      }
      ctx.strokeRect(barrelLeft, centerY - boreRadiusPx - 20, barrelLengthPx, 20);

      // Bottom wall
      ctx.fillStyle = wallColor;
      ctx.fillRect(barrelLeft, centerY + boreRadiusPx, barrelLengthPx, 20);
      if (redGlow > 0.01) {
        ctx.fillStyle = `rgba(158, 42, 43, ${redGlow * 0.75})`;
        ctx.fillRect(barrelLeft, centerY + boreRadiusPx, barrelLengthPx, 20);
      }
      ctx.strokeRect(barrelLeft, centerY + boreRadiusPx, barrelLengthPx, 20);
    }

    // Breech plug (left end)
    ctx.fillStyle = wallColor;
    ctx.fillRect(barrelLeft - 15, centerY - boreRadiusPx - 20, 15, boreRadiusPx * 2 + 40);
    ctx.strokeRect(barrelLeft - 15, centerY - boreRadiusPx - 20, 15, boreRadiusPx * 2 + 40);

    // Draw touch-hole channel
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(barrelLeft + 40, centerY - boreRadiusPx - 20, 8, 20);
    ctx.strokeStyle = '#3d3228';
    ctx.strokeRect(barrelLeft + 40, centerY - boreRadiusPx - 20, 8, 20);

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
      
      const veinCount = 6;
      for (let i = 0; i < veinCount; i++) {
        let vx = barrelLeft + 60 + i * 50;
        // Don't draw veins in the gaps if ruptured
        if (isRuptured && barrelMaterial === 'wrought_iron' && vx >= barrelLeft + 140 && vx <= barrelLeft + 160) continue;
        if (isRuptured && barrelMaterial === 'cast_bronze' && vx >= barrelLeft + 110 && vx <= barrelLeft + 190) continue;

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
      ctx.restore();
    }

    // --- DRAW PROPULSION SYSTEM (Inside Chamber) ---
    let pressureGlow = Math.min(1.0, frame.pressure / 12.0); // scale max pressure

    if (frame.stage === 'ignition' || frame.stage === 'pressure' || frame.stage === 'movement') {
      const projPosPx = barrelLeft + (frame.projectileX * barrelLengthPx);

      if (pressureGlow > 0.05) {
        // Red/Orange fire gas glow behind projectile
        let grad = ctx.createLinearGradient(barrelLeft, centerY, projPosPx, centerY);
        grad.addColorStop(0, '#ff9f1c');
        grad.addColorStop(0.5, '#d94e34');
        grad.addColorStop(1, `rgba(158, 42, 43, ${pressureGlow})`);
        ctx.fillStyle = grad;
        ctx.fillRect(barrelLeft, centerY - boreRadiusPx, projPosPx - barrelLeft, boreRadiusPx * 2);

        // draw pressure expansion circles
        ctx.strokeStyle = `rgba(255, 159, 28, ${pressureGlow})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 20; r < (projPosPx - barrelLeft); r += 40) {
          ctx.arc(barrelLeft + r, centerY, boreRadiusPx - 5, 0, Math.PI * 2);
        }
        ctx.stroke();
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

      // Draw touch-hole spark or fuse match
      if (frame.stage === 'ignition') {
        ctx.fillStyle = '#e6c387';
        ctx.beginPath();
        ctx.arc(barrelLeft + 44, centerY - boreRadiusPx - 20, 5, 0, Math.PI * 2);
        ctx.fill();

        // Little sparks
        ctx.strokeStyle = '#d94e34';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          let angle = (i * Math.PI) / 3;
          let rx = Math.cos(angle) * 12;
          let ry = Math.sin(angle) * 12;
          ctx.beginPath();
          ctx.moveTo(barrelLeft + 44, centerY - boreRadiusPx - 20);
          ctx.lineTo(barrelLeft + 44 + rx, centerY - boreRadiusPx - 20 + ry);
          ctx.stroke();
        }
      }
    }

    // --- DRAW PROJECTILE & WADDING with Rattling ---
    if (frame.stage !== 'flight' && frame.stage !== 'impact' && frame.stage !== 'aftermath') {
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
    if (frame.stage === 'movement' && waddingType === 'none' && frame.projectileX > 0.1 && frame.projectileX < 0.9) {
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
      const tSeed = Date.now() * 0.05;
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

    // --- DRAW CHEMISTRY ZOOM LENS (First half of simulation - ignition and pressure build-up) ---
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

    ctx.restore();

    // --- DRAW MANUSCRIPT OVERLAYS (When paused/scrubbing) ---
    if (isPaused) {
      this.drawManuscriptCallouts(
        frame,
        projectileType,
        barrelLeft,
        centerY,
        boreRadiusPx,
        barrelLengthPx
      );
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
    
    // Zoom lens coordinates
    const zoomX = 310;
    const zoomY = 90;
    const zoomR = 35;
    const targetX = barrelLeft + 50; // chamber center
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
        const jitterX = Math.sin(Date.now() * 0.05 + p.dx) * jitterAmp;
        const jitterY = Math.cos(Date.now() * 0.05 + p.dy) * jitterAmp;

        ctx.beginPath();
        ctx.arc(zoomX + p.dx + jitterX, zoomY + p.dy + jitterY, grainRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // If burning, draw gas particles venting
        if (burnProgress > 0.05 && burnProgress < 0.95) {
          ctx.fillStyle = 'rgba(255, 159, 28, 0.7)';
          ctx.beginPath();
          ctx.arc(zoomX + p.dx + Math.sin(Date.now() * 0.01 + p.dx) * 8, zoomY + p.dy + Math.cos(Date.now() * 0.01 + p.dy) * 8, 1.5, 0, Math.PI * 2);
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
        const fireJitter = Math.sin(Date.now() * 0.1) * (1.0 + tempIntensity * 2.0);
        ctx.moveTo(zoomX - zoomR + 5, zoomY + zoomR - pileHeight - 2 + fireJitter);
        ctx.quadraticCurveTo(zoomX, zoomY + zoomR - pileHeight * 2 - 2 - fireJitter, zoomX + zoomR - 5, zoomY + zoomR - pileHeight - 2 + fireJitter);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 4. Draw Chemistry Callout text (Right of Zoom Circle)
    ctx.fillStyle = '#bca085';
    ctx.font = 'italic 11px Lora, serif';
    ctx.fillText('fig 1b. Alchemical Calcination', zoomX + zoomR + 15, zoomY - 18);
    
    ctx.fillStyle = '#ff9f1c';
    ctx.font = 'normal 10px Share Tech Mono, monospace';
    ctx.fillText(`Tempest: ${frame.temperature.toFixed(0)} K`, zoomX + zoomR + 15, zoomY - 6);

    ctx.fillStyle = '#8c7662';
    ctx.font = 'normal 11px Share Tech Mono, monospace';
    ctx.fillText('2KNO₃ + 3C + S ➜ K₂S + N₂ + 3CO₂', zoomX + zoomR + 15, zoomY + 6);

    // Stats
    const gasYield = refinementLevel * 0.45;
    const ashResidue = 100.0 - gasYield;
    ctx.font = 'normal 10px Share Tech Mono, monospace';
    ctx.fillStyle = '#6e5e4f';
    ctx.fillText(`Unburned Grains: ${unburnedPercent.toFixed(0)}%`, zoomX + zoomR + 15, zoomY + 18);
    ctx.fillText(`Gas Yield: ${gasYield.toFixed(0)}% / Ash: ${ashResidue.toFixed(0)}%`, zoomX + zoomR + 15, zoomY + 28);

    ctx.restore();
  }

  private drawManuscriptCallouts(
    frame: ShotFrame,
    projectileType: string,
    barrelLeft: number,
    centerY: number,
    boreRadiusPx: number,
    barrelLengthPx: number
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#8c7662';
    ctx.fillStyle = '#bca085';
    ctx.font = 'italic 11px Lora, serif';
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
    ctx.fillText(`Chamber Press: ${frame.pressure.toFixed(1)} MPa`, pressIx - 135, pressIy - 4);

    // 2. Windage Gap & Rattle Deflection (only if projectile is inside the barrel)
    if (frame.stage !== 'flight' && frame.stage !== 'impact' && frame.stage !== 'aftermath') {
      const projX = barrelLeft + (frame.projectileX * (barrelLengthPx - 30));
      
      // Determine windage gap based on projectile type
      let gapSize = '1.0';
      if (projectileType === 'rough_stone') gapSize = '2.5 (loose)';
      else if (projectileType === 'lead_arrow') gapSize = '1.5';
      else if (projectileType === 'pebbles') gapSize = '3.5 (scattered)';
      
      // Draw Windage Callout
      const gapTx = projX + 15;
      const gapTy = centerY - boreRadiusPx + 3;
      const gapIx = projX - 15;
      const gapIy = centerY - boreRadiusPx - 40;
      drawLeader(gapTx, gapTy, gapIx, gapIy, -50);
      ctx.fillText(`Windage Gap: ${gapSize}mm`, gapIx - 110, gapIy - 4);

      // Draw Rattle / Aim Deflection Callout if it's moving or setup
      if (frame.stage === 'movement' || frame.stage === 'setup' || frame.stage === 'ignition') {
        const rattleTx = projX + 20;
        const rattleTy = centerY + boreRadiusPx - 3;
        const rattleIx = projX + 45;
        const rattleIy = centerY + boreRadiusPx + 40;
        drawLeader(rattleTx, rattleTy, rattleIx, rattleIy, 50);
        ctx.fillText(`Aim Deflect: ${frame.aimOffset.toFixed(1)}°`, rattleIx + 5, rattleIy - 4);
      }
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

  private drawTargetRange(frame: ShotFrame, _projectileType: string) {
    const ctx = this.ctx;
    const rangeLeft = 580;
    const rangeWidth = 500;
    const groundY = 320;
    const shooterHeightY = 220;

    // Draw ground
    ctx.strokeStyle = '#2d241c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rangeLeft, groundY);
    ctx.lineTo(rangeLeft + rangeWidth, groundY);
    ctx.stroke();

    const targetX = rangeLeft + rangeWidth - 40;
    const targetCenterY = groundY - 60;

    ctx.strokeStyle = '#6e5e4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(targetX, targetCenterY);
    ctx.lineTo(targetX - 15, groundY);
    ctx.moveTo(targetX, targetCenterY);
    ctx.lineTo(targetX + 15, groundY);
    ctx.stroke();

    ctx.fillStyle = '#dfd3c3';
    ctx.beginPath();
    ctx.arc(targetX, targetCenterY, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d3228';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetCenterY, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#9e2a2b';
    ctx.beginPath();
    ctx.arc(targetX, targetCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    if (frame.stage === 'flight' || frame.stage === 'impact') {
      ctx.save();
      ctx.strokeStyle = 'rgba(207, 168, 107, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      
      const flightProgress = Math.min(1.0, frame.projectileX / 35.0);
      const currentFlightX = rangeLeft + (flightProgress * (rangeWidth - 40));
      const currentFlightY = groundY - (frame.projectileY * 40.0);

      ctx.beginPath();
      ctx.moveTo(rangeLeft, shooterHeightY);
      ctx.quadraticCurveTo(
        (rangeLeft + currentFlightX) / 2, 
        Math.min(shooterHeightY, currentFlightY) - 10,
        currentFlightX, 
        currentFlightY
      );
      ctx.stroke();

      ctx.fillStyle = '#646870';
      ctx.beginPath();
      ctx.arc(currentFlightX, currentFlightY, 3, 0, Math.PI * 2);
      ctx.fill();

      if (frame.aimOffset !== 0.0) {
        ctx.fillStyle = '#6e5e4f';
        ctx.font = '10px Share Tech Mono, monospace';
        ctx.fillText(`Drift: ${frame.aimOffset.toFixed(1)}°`, currentFlightX - 20, currentFlightY - 10);
      }

      ctx.restore();
    }

    if (frame.stage === 'impact' || frame.stage === 'aftermath') {
      const finalProgress = Math.min(1.0, frame.projectileX / 35.0);
      const impactX = rangeLeft + (finalProgress * (rangeWidth - 40));
      const impactY = groundY - (frame.projectileY * 40.0);

      ctx.fillStyle = '#d94e34';
      ctx.beginPath();
      ctx.arc(impactX, impactY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cfa86b';
      ctx.font = 'bold 11px Cinzel, serif';
      if (impactX >= targetX - 5 && Math.abs(impactY - targetCenterY) < 12) {
        ctx.fillStyle = '#8ac926';
        ctx.fillText('HIT!', targetX - 12, targetCenterY - 35);
      } else {
        ctx.fillStyle = '#9e2a2b';
        ctx.fillText('MISS', targetX - 15, targetCenterY - 35);
      }
    }
  }
}
