import { ShotFrame } from '../types';

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

  public drawFrame(frame: ShotFrame, barrelMaterial: string, projectileType: string, waddingType: string) {
    this.clear();
    const ctx = this.ctx;
    
    const barrelLeft = 100;
    const barrelLengthPx = 320;
    const barrelRight = barrelLeft + barrelLengthPx;
    const centerY = 200;
    const boreRadiusPx = 25; // radius of inside bore in pixels

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

    // Draw wall stress overlays if pressure exists
    const stressFactor = frame.barrelStress / 200.0; // scale stress
    const redGlow = Math.min(1.0, stressFactor);

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

    // Breech plug (left end)
    ctx.fillStyle = wallColor;
    ctx.fillRect(barrelLeft - 15, centerY - boreRadiusPx - 20, 15, boreRadiusPx * 2 + 40);
    ctx.strokeRect(barrelLeft - 15, centerY - boreRadiusPx - 20, 15, boreRadiusPx * 2 + 40);

    // Draw touch-hole channel
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(barrelLeft + 40, centerY - boreRadiusPx - 20, 8, 20);
    ctx.strokeStyle = '#3d3228';
    ctx.strokeRect(barrelLeft + 40, centerY - boreRadiusPx - 20, 8, 20);

    // Draw Bamboo Knots / Iron Seams for flavor
    if (barrelMaterial === 'bamboo') {
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
    } else if (barrelMaterial === 'wrought_iron') {
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

    // Inside bore background
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(barrelLeft, centerY - boreRadiusPx, barrelLengthPx, boreRadiusPx * 2);

    // Draw Soot deposits (Fouling) inside the bore walls
    if (this.sootLevel > 0.02) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.85, this.sootLevel * 0.95)})`;
      ctx.fillRect(barrelLeft, centerY - boreRadiusPx, barrelLengthPx, 4);
      ctx.fillRect(barrelLeft, centerY + boreRadiusPx - 4, barrelLengthPx, 4);
    }

    // --- DRAW PROPULSION SYSTEM (Inside Chamber) ---
    // Calculate unburned powder and flame ratios
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

    // --- DRAW PROJECTILE & WADDING ---
    if (frame.stage !== 'flight' && frame.stage !== 'impact' && frame.stage !== 'aftermath') {
      const projX = barrelLeft + (frame.projectileX * (barrelLengthPx - 30));
      this.drawProjectile(ctx, projX, centerY, boreRadiusPx, projectileType);
      this.drawWadding(ctx, projX, centerY, boreRadiusPx, waddingType);

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
      // Draw irregular circle
      const sides = 8;
      for (let i = 0; i < sides; i++) {
        let angle = (i * Math.PI * 2) / sides;
        // fixed roughness offsets
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
      // Shaft
      ctx.fillRect(x - 10, y - 3, 35, 6);
      
      // Tip
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.moveTo(x + 25, y - 8);
      ctx.lineTo(x + 35, y);
      ctx.lineTo(x + 25, y + 8);
      ctx.closePath();
      ctx.fill();

      // Feathers (fletching)
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
      // Tow packing fibers (rough texture)
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
      // Clay plug (gray block sealing the gap)
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
    const shooterHeightY = 220; // shooter height position on target range

    // Draw ground
    ctx.strokeStyle = '#2d241c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rangeLeft, groundY);
    ctx.lineTo(rangeLeft + rangeWidth, groundY);
    ctx.stroke();

    // Draw target board at x = 1040, center y = 260
    const targetX = rangeLeft + rangeWidth - 40;
    const targetCenterY = groundY - 60; // 60px above ground

    ctx.strokeStyle = '#6e5e4f';
    ctx.lineWidth = 2;
    // Stand
    ctx.beginPath();
    ctx.moveTo(targetX, targetCenterY);
    ctx.lineTo(targetX - 15, groundY);
    ctx.moveTo(targetX, targetCenterY);
    ctx.lineTo(targetX + 15, groundY);
    ctx.stroke();

    // Paper target circles
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

    // Draw trajectory trail if in flight
    if (frame.stage === 'flight' || frame.stage === 'impact') {
      ctx.save();
      ctx.strokeStyle = 'rgba(207, 168, 107, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      
      // We map 35m coordinate to rangeWidth pixels
      const flightProgress = Math.min(1.0, frame.projectileX / 35.0);
      const currentFlightX = rangeLeft + (flightProgress * (rangeWidth - 40));
      
      // Map height (y = 0m is groundY, y = 1.5m is targetCenterY)
      // Height scale: 1m = 40px
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

      // Draw the projectile on the range
      ctx.fillStyle = '#646870';
      ctx.beginPath();
      ctx.arc(currentFlightX, currentFlightY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Show bullet offset or drift text
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

      // Highlight hit/miss status
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
