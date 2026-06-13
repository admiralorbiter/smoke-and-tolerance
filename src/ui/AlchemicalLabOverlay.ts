import { AlchemicalMix } from '../types';

interface MaterialProps {
  name: string;
  yield: number;
  ultimate: number;
  modulus: number; // GPa
  color: string;
}

const COUPON_REGISTRY: Record<string, MaterialProps> = {
  bamboo: { name: 'Bamboo fiber', yield: 30.0, ultimate: 45.0, modulus: 15.0, color: '#8c805c' },
  wrought_iron: { name: 'Wrought Iron coupon', yield: 130.0, ultimate: 220.0, modulus: 190.0, color: '#685e58' },
  cast_bronze: { name: 'Cast Bronze rod', yield: 160.0, ultimate: 280.0, modulus: 100.0, color: '#a68058' },
};

export class AlchemicalLabOverlay {
  private overlayContainer: HTMLDivElement;
  private onLockCallback: (mix: AlchemicalMix, material: string) => void;

  // Active lab state variables
  private activeMix: AlchemicalMix = {
    saltpeterRatio: 75.0,
    charcoalRatio: 15.0,
    sulfurRatio: 10.0,
    charcoalSource: 'alder',
    saltpeterPurity: 50.0, // starts at 50%
  };
  private selectedMaterial: string = 'wrought_iron';

  // Ternary plot vertices
  private readonly V_SALT = { x: 80, y: 15 };
  private readonly V_SULF = { x: 20, y: 120 };
  private readonly V_CARB = { x: 140, y: 120 };

  // DOM Elements
  private btnClose = document.getElementById('btn-close-lab') as HTMLButtonElement;
  private btnLock = document.getElementById('btn-lock-batch') as HTMLButtonElement;
  private tabButtons = document.querySelectorAll('.lab-tab-btn');
  private tabPanels = document.querySelectorAll('.lab-tab-panel');

  // Tab 1 Elements
  private svgTernary = document.getElementById('svg-lab-ternary') as unknown as SVGSVGElement;
  private ternaryMarker = document.getElementById('lab-ternary-marker') as unknown as SVGGeometryElement;
  private txtSaltpeter = document.getElementById('readout-saltpeter') as HTMLSpanElement;
  private txtSulfur = document.getElementById('readout-sulfur') as HTMLSpanElement;
  private txtCharcoal = document.getElementById('readout-charcoal') as HTMLSpanElement;
  private charcoalCards = document.querySelectorAll('.charcoal-card');
  private protectionCards = document.querySelectorAll('.protection-card');
  private btnCrystallize = document.getElementById('btn-crystallize') as HTMLButtonElement;
  private barCrystallize = document.getElementById('crystallization-bar') as HTMLDivElement;
  private txtCrystallize = document.getElementById('crystallization-text') as HTMLSpanElement;
  private svgCrystallizer = document.getElementById('svg-crystallizer') as unknown as SVGSVGElement;
  private lblFooterSummary = document.getElementById('lbl-active-mix') as HTMLSpanElement;

  // Tab 2 Elements
  private canvasDish = document.getElementById('canvas-dish-burn') as HTMLCanvasElement;
  private ctxDish = this.canvasDish.getContext('2d') as CanvasRenderingContext2D;
  private btnTestBurn = document.getElementById('btn-test-burn') as HTMLButtonElement;
  private txtBurnVel = document.getElementById('readout-burn-velocity') as HTMLSpanElement;
  private txtBurnSmoke = document.getElementById('readout-burn-smoke') as HTMLSpanElement;
  
  private btnTestCal = document.getElementById('btn-test-calorimeter') as HTMLButtonElement;
  private txtCalPressure = document.getElementById('gauge-pressure') as HTMLSpanElement;
  private txtCalTemp = document.getElementById('gauge-temp') as HTMLSpanElement;
  private pathCalPressure = document.getElementById('path-cal-pressure') as unknown as SVGPathElement;
  private pathCalTemp = document.getElementById('path-cal-temp') as unknown as SVGPathElement;

  // Tab 3 Elements
  private couponButtons = document.querySelectorAll('.material-coupon-btn');
  private canvasTensile = document.getElementById('canvas-tensile') as HTMLCanvasElement;
  private ctxTensile = this.canvasTensile.getContext('2d') as CanvasRenderingContext2D;
  private sliderTensile = document.getElementById('slider-tensile-lever') as HTMLInputElement;
  private pathTensileCurve = document.getElementById('path-tensile-curve') as unknown as SVGPathElement;
  private markerTensile = document.getElementById('marker-tensile-current') as unknown as SVGGeometryElement;
  private txtTensileLoad = document.getElementById('readout-tensile-load') as HTMLSpanElement;
  private txtTensileYield = document.getElementById('readout-tensile-yield') as HTMLSpanElement;
  private txtTensileUltimate = document.getElementById('readout-tensile-ultimate') as HTMLSpanElement;
  private txtTensileStatus = document.getElementById('readout-tensile-status') as HTMLSpanElement;

  // Animation Handles
  private dishAnimId: number | null = null;
  private calAnimTimer: number | null = null;
  private tensilePermanentStrain: number = 0.0;
  private tensileIsBroken: boolean = false;

  constructor(onLock: (mix: AlchemicalMix, material: string) => void) {
    this.overlayContainer = document.getElementById('alchemical-lab-overlay') as HTMLDivElement;
    this.onLockCallback = onLock;

    this.initEventListeners();
    this.drawCrystallizerCrystals();
    this.drawStaticDish();
    this.drawTensileMachine();
    this.drawTensileChart();
  }

  public show(mix: AlchemicalMix, material: string, activeEra: string) {
    this.activeMix = { ...mix };
    if (!this.activeMix.weatherProtection) {
      this.activeMix.weatherProtection = 'none';
    }
    this.selectedMaterial = material;

    // Lock pan cover in early Eras (strange_fire, fire_delivered, directional_blast)
    const panCoverCard = Array.from(this.protectionCards).find(card => card.getAttribute('data-protection') === 'pan_shield');
    if (panCoverCard) {
      const isLocked = ['strange_fire', 'fire_delivered', 'directional_blast'].includes(activeEra);
      panCoverCard.classList.toggle('disabled', isLocked);
      if (isLocked) {
        const desc = panCoverCard.querySelector('.description');
        if (desc) desc.textContent = '🔒 Pivoting metal pan cover. Restricted in early Eras (Era IV+ only).';
        if (this.activeMix.weatherProtection === 'pan_shield') {
          this.activeMix.weatherProtection = 'none';
        }
      } else {
        const desc = panCoverCard.querySelector('.description');
        if (desc) desc.textContent = 'Pivoting metal shield. Reduces rain and wind risk by 80%. Slight weight offset (+1.0° aim bias). Era IV+ only.';
      }
    }
    
    // Sync UI elements to active state
    this.updateTernaryMarkerFromRatios();
    this.syncCharcoalCards();
    this.syncProtectionCards();
    this.updateCrystallizationUI();
    this.syncMaterialCouponUI();
    this.updateFooterLabel();
    
    // Reset test displays
    this.txtBurnVel.textContent = '-';
    this.txtBurnSmoke.textContent = '-';
    this.txtCalPressure.textContent = '0.0 MPa';
    this.txtCalTemp.textContent = '293.1 K';
    this.pathCalPressure.setAttribute('d', '');
    this.pathCalTemp.setAttribute('d', '');
    
    this.tensilePermanentStrain = 0.0;
    this.tensileIsBroken = false;
    this.sliderTensile.value = '0';
    this.updateTensileTest(0);

    this.overlayContainer.style.display = 'flex';
  }

  public hide() {
    this.overlayContainer.style.display = 'none';
    this.cancelAnimations();
  }

  private cancelAnimations() {
    if (this.dishAnimId) {
      cancelAnimationFrame(this.dishAnimId);
      this.dishAnimId = null;
    }
    if (this.calAnimTimer) {
      clearInterval(this.calAnimTimer);
      this.calAnimTimer = null;
    }
  }

  private initEventListeners() {
    // Close & Lock
    this.btnClose.addEventListener('click', () => this.hide());
    this.btnLock.addEventListener('click', () => {
      this.onLockCallback(this.activeMix, this.selectedMaterial);
      this.hide();
    });

    // Tab transitions
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.tabButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.tabPanels.forEach(panel => {
          panel.classList.toggle('active', panel.id === `lab-tab-${tab}`);
        });
      });
    });

    // Ternary drag event handlers
    const handleTernaryInput = (e: MouseEvent) => {
      const rect = this.svgTernary.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 160;
      const clickY = ((e.clientY - rect.top) / rect.height) * 140;
      this.updateRatiosFromCoordinates(clickX, clickY);
    };

    let isDraggingTernary = false;
    this.svgTernary.addEventListener('mousedown', (e) => {
      isDraggingTernary = true;
      handleTernaryInput(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDraggingTernary) {
        handleTernaryInput(e);
      }
    });

    window.addEventListener('mouseup', () => {
      isDraggingTernary = false;
    });

    // Charcoal selection
    this.charcoalCards.forEach(card => {
      card.addEventListener('click', () => {
        const source = card.getAttribute('data-source') as 'willow' | 'alder' | 'oak';
        this.activeMix.charcoalSource = source;
        this.syncCharcoalCards();
        this.updateFooterLabel();
      });
    });

    // Touch-hole protection selection
    this.protectionCards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        const protection = card.getAttribute('data-protection') || 'none';
        this.activeMix.weatherProtection = protection;
        this.syncProtectionCards();
        this.updateFooterLabel();
      });
    });

    // Saltpeter crystallization
    this.btnCrystallize.addEventListener('click', () => {
      this.activeMix.saltpeterPurity = Math.min(95.0, this.activeMix.saltpeterPurity + 15.0);
      this.updateCrystallizationUI();
      this.drawCrystallizerCrystals();
    });

    // Open dish burn test
    this.btnTestBurn.addEventListener('click', () => this.runDishBurnTest());

    // Calorimeter test
    this.btnTestCal.addEventListener('click', () => this.runCalorimeterTest());

    // Coupon Material selector
    this.couponButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMaterial = btn.getAttribute('data-material') || 'wrought_iron';
        this.syncMaterialCouponUI();
        this.tensilePermanentStrain = 0.0;
        this.tensileIsBroken = false;
        this.sliderTensile.value = '0';
        this.updateTensileTest(0);
      });
    });

    // Tensile loading slider
    this.sliderTensile.addEventListener('input', () => {
      const load = parseFloat(this.sliderTensile.value);
      this.updateTensileTest(load);
    });
  }

  // --- TRIA PRIMA TERNARY MIXER MATH & BARYCENTRIC MAPPING ---
  private updateRatiosFromCoordinates(px: number, py: number) {
    const xa = this.V_SALT.x, ya = this.V_SALT.y;
    const xb = this.V_SULF.x, yb = this.V_SULF.y;
    const xc = this.V_CARB.x, yc = this.V_CARB.y;

    const denom = (yb - yc) * (xa - xc) + (xc - xb) * (ya - yc);
    let lambdaA = ((yb - yc) * (px - xc) + (xc - xb) * (py - yc)) / denom;
    let lambdaB = ((yc - ya) * (px - xc) + (xa - xc) * (py - yc)) / denom;
    let lambdaC = 1.0 - lambdaA - lambdaB;

    // Clamp coordinates to inside the triangle bounds
    lambdaA = Math.max(0.0, Math.min(1.0, lambdaA));
    lambdaB = Math.max(0.0, Math.min(1.0, lambdaB));
    lambdaC = Math.max(0.0, Math.min(1.0, lambdaC));

    const total = lambdaA + lambdaB + lambdaC;
    if (total > 0.0001) {
      lambdaA /= total;
      lambdaB /= total;
      lambdaC /= total;
    } else {
      lambdaA = 0.75;
      lambdaB = 0.10;
      lambdaC = 0.15;
    }

    // Set active values
    this.activeMix.saltpeterRatio = lambdaA * 100;
    this.activeMix.sulfurRatio = lambdaB * 100;
    this.activeMix.charcoalRatio = lambdaC * 100;

    // Update markers and text values
    this.updateTernaryMarkerFromRatios();
    this.updateFooterLabel();
  }

  private updateTernaryMarkerFromRatios() {
    const la = this.activeMix.saltpeterRatio / 100;
    const lb = this.activeMix.sulfurRatio / 100;
    const lc = this.activeMix.charcoalRatio / 100;

    const cx = la * this.V_SALT.x + lb * this.V_SULF.x + lc * this.V_CARB.x;
    const cy = la * this.V_SALT.y + lb * this.V_SULF.y + lc * this.V_CARB.y;

    this.ternaryMarker.setAttribute('cx', cx.toFixed(1));
    this.ternaryMarker.setAttribute('cy', cy.toFixed(1));

    this.txtSaltpeter.textContent = `${this.activeMix.saltpeterRatio.toFixed(1)}%`;
    this.txtSulfur.textContent = `${this.activeMix.sulfurRatio.toFixed(1)}%`;
    this.txtCharcoal.textContent = `${this.activeMix.charcoalRatio.toFixed(1)}%`;
  }

  private syncCharcoalCards() {
    this.charcoalCards.forEach(card => {
      const source = card.getAttribute('data-source');
      card.classList.toggle('active', source === this.activeMix.charcoalSource);
    });
  }

  private updateCrystallizationUI() {
    const purity = this.activeMix.saltpeterPurity.toFixed(0);
    this.barCrystallize.style.width = `${purity}%`;
    const cycles = Math.max(1, Math.round((this.activeMix.saltpeterPurity - 35) / 12));
    this.txtCrystallize.textContent = `${purity}% Purity (${cycles} crystallization cycles)`;
  }

  private drawCrystallizerCrystals() {
    this.svgCrystallizer.innerHTML = '';
    const crystalCount = Math.round((this.activeMix.saltpeterPurity - 35) * 0.4);
    
    let seed = 12345;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < crystalCount; i++) {
      const cx = 15 + lcg() * 130;
      const cy = 15 + lcg() * 50;
      const size = 3 + lcg() * 8;
      const rot = lcg() * Math.PI;

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      
      const pts = [];
      for (let j = 0; j < 6; j++) {
        const ang = rot + (j * Math.PI) / 3;
        const rx = cx + Math.cos(ang) * size * (j % 2 === 0 ? 1.0 : 0.6);
        const ry = cy + Math.sin(ang) * size * 0.7;
        pts.push(`${rx.toFixed(1)},${ry.toFixed(1)}`);
      }
      
      poly.setAttribute('points', pts.join(' '));
      poly.setAttribute('class', 'crystal-element');
      poly.style.animationDelay = `${i * 0.03}s`;
      this.svgCrystallizer.appendChild(poly);
    }
  }

  // --- TAB 2: DISH BURN CANVAS PARTICLE SIMULATION ---
  private runDishBurnTest() {
    if (this.dishAnimId) cancelAnimationFrame(this.dishAnimId);
    
    const w = this.canvasDish.width;
    const h = this.canvasDish.height;
    
    const dev = Math.abs(this.activeMix.saltpeterRatio - 75) + Math.abs(this.activeMix.charcoalRatio - 15) + Math.abs(this.activeMix.sulfurRatio - 10);
    const stoichiometryFactor = Math.max(0.15, 1.0 - dev / 80.0);
    const purityFactor = this.activeMix.saltpeterPurity / 100.0;
    
    const woodMult = this.activeMix.charcoalSource === 'willow' ? 1.35 : this.activeMix.charcoalSource === 'alder' ? 1.0 : 0.65;
    const burnSpeed = woodMult * purityFactor * stoichiometryFactor;

    this.txtBurnVel.textContent = burnSpeed > 1.0 ? 'Rapid Flash' : burnSpeed > 0.6 ? 'Moderate Burn' : burnSpeed > 0.25 ? 'Sluggish Smolder' : 'Cold Fizzle';
    this.txtBurnSmoke.textContent = this.activeMix.charcoalSource === 'oak' ? 'Heavy Oily soot' : this.activeMix.charcoalSource === 'alder' ? 'Medium cloud' : 'Sparse white smoke';

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      isSmoke: boolean;
    }

    let particles: Particle[] = [];
    let powderAmount = 1.0;
    let matchY = 0;
    let matchActive = true;
    let flameActive = false;

    const loop = () => {
      this.ctxDish.clearRect(0, 0, w, h);
      this.drawStaticDish();

      if (powderAmount > 0.02) {
        this.ctxDish.fillStyle = '#2d2620';
        this.ctxDish.beginPath();
        this.ctxDish.moveTo(w / 2 - 40 * powderAmount, h - 35);
        this.ctxDish.quadraticCurveTo(w / 2, h - 35 - 20 * powderAmount, w / 2 + 40 * powderAmount, h - 35);
        this.ctxDish.closePath();
        this.ctxDish.fill();
      }

      if (matchActive) {
        matchY += 3;
        this.ctxDish.fillStyle = '#8c7662';
        this.ctxDish.fillRect(w / 2 - 2, matchY - 30, 4, 20);
        this.ctxDish.fillStyle = '#9e2a2b';
        this.ctxDish.fillRect(w / 2 - 3, matchY - 10, 6, 10);
        
        if (matchY >= h - 45) {
          matchActive = false;
          flameActive = true;
        }
      }

      if (flameActive && powderAmount > 0.0) {
        const rate = Math.round(4 + burnSpeed * 12);
        powderAmount -= 0.008 * burnSpeed;
        
        for (let i = 0; i < rate; i++) {
          const vx = (Math.random() - 0.5) * (2 + burnSpeed * 4);
          const vy = -1 * (Math.random() * (3 + burnSpeed * 6) + 1);
          const life = Math.random() * 20 + 8;
          
          const redVal = Math.round(210 + Math.random() * 45);
          const greenVal = Math.round(80 + Math.random() * 155 * (this.activeMix.sulfurRatio > 25 ? 0.3 : 1.0));
          const blueVal = Math.round(this.activeMix.sulfurRatio > 20 ? 160 + Math.random() * 95 : 0);
          
          particles.push({
            x: w / 2 + (Math.random() - 0.5) * 60 * powderAmount,
            y: h - 35 - (Math.random() * 5),
            vx,
            vy,
            life,
            maxLife: life,
            size: Math.random() * 4 + 2,
            color: `rgba(${redVal}, ${greenVal}, ${blueVal}, 0.8)`,
            isSmoke: false,
          });

          if (Math.random() < (this.activeMix.charcoalSource === 'oak' ? 0.85 : 0.4)) {
            particles.push({
              x: w / 2 + (Math.random() - 0.5) * 60 * powderAmount,
              y: h - 35,
              vx: vx * 0.6,
              vy: vy * 0.4,
              life: life * 1.8,
              maxLife: life * 1.8,
              size: Math.random() * 10 + 5,
              color: this.activeMix.charcoalSource === 'oak' ? 'rgba(25, 22, 20, 0.45)' : 'rgba(85, 78, 72, 0.35)',
              isSmoke: true,
            });
          }
        }
      }

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        const ageRatio = p.life / p.maxLife;
        this.ctxDish.fillStyle = p.color;
        this.ctxDish.beginPath();
        
        if (p.isSmoke) {
          const s = p.size * (2.0 - ageRatio);
          this.ctxDish.arc(p.x, p.y, s, 0, Math.PI * 2);
          this.ctxDish.fill();
        } else {
          const s = p.size * ageRatio;
          this.ctxDish.arc(p.x, p.y, s, 0, Math.PI * 2);
          this.ctxDish.fill();
        }
      });

      particles = particles.filter(p => p.life > 0);

      if (flameActive && powderAmount <= 0.0 && particles.length === 0) {
        flameActive = false;
        this.drawDishResidue();
      } else {
        this.dishAnimId = requestAnimationFrame(loop);
      }
    };

    loop();
  }

  private drawStaticDish() {
    const w = this.canvasDish.width;
    const h = this.canvasDish.height;
    
    this.ctxDish.fillStyle = '#080706';
    this.ctxDish.fillRect(0, 0, w, h);
    
    this.ctxDish.fillStyle = '#8c7662';
    this.ctxDish.fillRect(w / 2 - 10, h - 30, 20, 10);
    this.ctxDish.fillStyle = '#3a322a';
    this.ctxDish.beginPath();
    this.ctxDish.ellipse(w / 2, h - 32, 50, 8, 0, 0, Math.PI * 2);
    this.ctxDish.fill();
    this.ctxDish.fillStyle = '#211b15';
    this.ctxDish.beginPath();
    this.ctxDish.ellipse(w / 2, h - 33, 46, 6, 0, 0, Math.PI * 2);
    this.ctxDish.fill();
  }

  private drawDishResidue() {
    const w = this.canvasDish.width;
    const h = this.canvasDish.height;
    this.ctxDish.save();

    let residueColor = 'rgba(20, 18, 15, 0.7)';
    if (this.activeMix.charcoalSource === 'oak') {
      residueColor = 'rgba(5, 4, 3, 0.9)';
    } else if (this.activeMix.charcoalSource === 'willow') {
      residueColor = 'rgba(50, 44, 38, 0.45)';
    }

    this.ctxDish.fillStyle = residueColor;
    this.ctxDish.beginPath();
    this.ctxDish.ellipse(w / 2, h - 33, 26, 4, 0, 0, Math.PI * 2);
    this.ctxDish.fill();

    if (this.activeMix.sulfurRatio > 20.0) {
      this.ctxDish.fillStyle = 'rgba(195, 178, 90, 0.6)';
      this.ctxDish.beginPath();
      this.ctxDish.ellipse(w / 2 - 8, h - 34, 10, 2, 0, 0, Math.PI * 2);
      this.ctxDish.ellipse(w / 2 + 10, h - 33, 6, 1.5, 0, 0, Math.PI * 2);
      this.ctxDish.fill();
    }
    this.ctxDish.restore();
  }

  // --- CLOSED CRUCIBLE CALORIMETER SIMULATION ---
  private runCalorimeterTest() {
    this.cancelAnimations();

    const dev = Math.abs(this.activeMix.saltpeterRatio - 75) + Math.abs(this.activeMix.charcoalRatio - 15) + Math.abs(this.activeMix.sulfurRatio - 10);
    const stoichiometryFactor = Math.max(0.15, 1.0 - dev / 80.0);
    const purityFactor = this.activeMix.saltpeterPurity / 100.0;
    const woodMult = this.activeMix.charcoalSource === 'willow' ? 1.25 : this.activeMix.charcoalSource === 'alder' ? 1.0 : 0.8;

    const peakP = 12.0 * stoichiometryFactor * purityFactor * woodMult;
    const peakT = 293.15 + 2100.0 * stoichiometryFactor * purityFactor;

    let t = 0;
    const pressurePoints: [number, number][] = [];
    const tempPoints: [number, number][] = [];

    this.calAnimTimer = window.setInterval(() => {
      t += 0.05;
      
      const riseFactor = 1.0 - Math.exp(-6 * t);
      const decayFactor = Math.exp(-0.25 * t);
      
      const pNow = peakP * riseFactor * decayFactor;
      const tNow = 293.15 + (peakT - 293.15) * riseFactor * Math.exp(-0.05 * t);

      this.txtCalPressure.textContent = `${pNow.toFixed(2)} MPa`;
      this.txtCalTemp.textContent = `${tNow.toFixed(1)} K`;

      const x = 20 + t * 40;
      const yP = 90 - (pNow / 15.0) * 80;
      const yT = 90 - ((tNow - 293.15) / 2500.0) * 80;

      if (x <= 230) {
        pressurePoints.push([x, yP]);
        tempPoints.push([x, yT]);
        
        const dP = 'M ' + pressurePoints.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
        const dT = 'M ' + tempPoints.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
        
        this.pathCalPressure.setAttribute('d', dP);
        this.pathCalTemp.setAttribute('d', dT);
      } else {
        clearInterval(this.calAnimTimer!);
        this.calAnimTimer = null;
      }
    }, 40);
  }

  // --- TAB 3: COUPON TENSILE STRESS MACHINE ---
  private syncMaterialCouponUI() {
    this.couponButtons.forEach(btn => {
      const mat = btn.getAttribute('data-material');
      btn.classList.toggle('active', mat === this.selectedMaterial);
    });

    const matProps = COUPON_REGISTRY[this.selectedMaterial];
    this.txtTensileYield.textContent = `${matProps.yield.toFixed(1)} MPa`;
    this.txtTensileUltimate.textContent = `${matProps.ultimate.toFixed(1)} MPa`;
    this.drawTensileChart();
  }

  private updateTensileTest(sliderVal: number) {
    const matProps = COUPON_REGISTRY[this.selectedMaterial];
    
    const maxStress = matProps.ultimate * 1.28;
    let stress = (sliderVal / 100) * maxStress;

    let elasticStrain = stress / (matProps.modulus * 10.0);
    let plasticStrain = 0.0;

    if (this.tensileIsBroken) {
      stress = 0.0;
      elasticStrain = 0.0;
    } else {
      if (stress >= matProps.ultimate) {
        this.tensileIsBroken = true;
        this.tensilePermanentStrain = 0.15;
        this.txtTensileStatus.textContent = 'RUPTURED (SNAP)';
        this.txtTensileStatus.style.color = '#9e2a2b';
      } else if (stress >= matProps.yield) {
        plasticStrain = ((stress - matProps.yield) / (matProps.ultimate - matProps.yield)) * 0.08;
        this.tensilePermanentStrain = Math.max(this.tensilePermanentStrain, plasticStrain);
        this.txtTensileStatus.textContent = 'PLASTIC DEFORMATION';
        this.txtTensileStatus.style.color = '#ff9f1c';
      } else {
        this.txtTensileStatus.textContent = stress > 2.0 ? 'ELASTIC TENSION' : 'UNLOADED';
        this.txtTensileStatus.style.color = '#6e5e4f';
      }
    }

    const totalStrain = elasticStrain + this.tensilePermanentStrain;

    this.txtTensileLoad.textContent = `${stress.toFixed(1)} MPa`;
    this.drawTensileMachineSpecimen(totalStrain, stress);
    this.updateTensileChartMarker(totalStrain, stress);
  }

  private drawTensileMachine() {
    this.drawTensileMachineSpecimen(0, 0);
  }

  private drawTensileMachineSpecimen(strain: number, stress: number) {
    const ctx = this.ctxTensile;
    const w = this.canvasTensile.width;
    const h = this.canvasTensile.height;
    const matProps = COUPON_REGISTRY[this.selectedMaterial];

    ctx.fillStyle = '#080706';
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2b241e';
    ctx.strokeRect(30, 15, w - 60, h - 30);

    ctx.fillStyle = '#1e1a15';
    ctx.fillRect(w / 2 - 24, 20, 48, 15);
    
    const strokeDelta = strain * 100;
    ctx.fillRect(w / 2 - 24, h - 35 + strokeDelta, 48, 15);

    const specTop = 35;
    const specBottom = h - 35 + strokeDelta;
    const specCenterY = (specTop + specBottom) / 2;

    ctx.fillStyle = matProps.color;
    
    if (this.tensileIsBroken) {
      const gap = 12;
      
      ctx.beginPath();
      ctx.moveTo(w / 2 - 10, specTop);
      ctx.lineTo(w / 2 + 10, specTop);
      ctx.lineTo(w / 2 + 5, specCenterY - gap / 2);
      ctx.lineTo(w / 2 - 5, specCenterY - gap / 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(w / 2 - 5, specCenterY + gap / 2);
      ctx.lineTo(w / 2 + 5, specCenterY + gap / 2);
      ctx.lineTo(w / 2 + 10, specBottom);
      ctx.lineTo(w / 2 - 10, specBottom);
      ctx.closePath();
      ctx.fill();
    } else {
      const stressRatio = stress / matProps.ultimate;
      const neckWidth = Math.max(2.5, 8.0 * (1.0 - stressRatio * 0.35));

      ctx.beginPath();
      ctx.moveTo(w / 2 - 10, specTop);
      ctx.lineTo(w / 2 + 10, specTop);
      
      ctx.bezierCurveTo(w / 2 + 8, specCenterY - 12, w / 2 + neckWidth, specCenterY - 4, w / 2 + neckWidth, specCenterY);
      ctx.bezierCurveTo(w / 2 + neckWidth, specCenterY + 4, w / 2 + 8, specCenterY + 12, w / 2 + 10, specBottom);
      
      ctx.lineTo(w / 2 - 10, specBottom);
      
      ctx.bezierCurveTo(w / 2 - 8, specCenterY + 12, w / 2 - neckWidth, specCenterY + 4, w / 2 - neckWidth, specCenterY);
      ctx.bezierCurveTo(w / 2 - neckWidth, specCenterY - 4, w / 2 - 8, specCenterY - 12, w / 2 - 10, specTop);
      
      ctx.closePath();
      ctx.fill();

      if (stress > matProps.yield) {
        const yieldRatio = (stress - matProps.yield) / (matProps.ultimate - matProps.yield);
        ctx.fillStyle = `rgba(217, 78, 52, ${yieldRatio * 0.7})`;
        ctx.beginPath();
        ctx.arc(w / 2, specCenterY, neckWidth + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawTensileChart() {
    const matProps = COUPON_REGISTRY[this.selectedMaterial];
    
    // Draw template curve based on material limits
    const pts = [];
    
    // Elastic region (linear line)
    pts.push('20,140');
    
    // Yield coordinates
    const stressScale = 300.0;
    const yYield = 140 - (matProps.yield / stressScale) * 120;
    const xYield = 20 + 30;
    pts.push(`${xYield.toFixed(1)},${yYield.toFixed(1)}`);
    
    // Ultimate coordinates
    const yUlt = 140 - (matProps.ultimate / stressScale) * 120;
    const xUlt = xYield + 70;
    pts.push(`${xUlt.toFixed(1)},${yUlt.toFixed(1)}`);
    
    // Rupture coordinates
    const xRup = xUlt + 30;
    const yRup = yUlt + 15;
    pts.push(`${xRup.toFixed(1)},${yRup.toFixed(1)}`);

    const pathD = `M ${pts[0]} L ${pts[1]} Q ${(xYield + 35).toFixed(1)},${(yUlt - 5).toFixed(1)} ${pts[2]} L ${pts[3]}`;
    this.pathTensileCurve.setAttribute('d', pathD);
  }

  private updateTensileChartMarker(strain: number, stress: number) {
    const xMaxStrain = 0.20;
    const x = 20 + (strain / xMaxStrain) * 200;
    const y = 140 - (stress / 300.0) * 120;

    this.markerTensile.setAttribute('cx', x.toFixed(1));
    this.markerTensile.setAttribute('cy', y.toFixed(1));
    this.markerTensile.setAttribute('opacity', this.tensileIsBroken ? '0.2' : '1.0');
    if (this.tensileIsBroken || stress > 1.0) {
      this.markerTensile.setAttribute('opacity', '1.0');
    }
  }

  // --- UTILS ---
  private getFriendlyWoodName(key: string): string {
    const map: Record<string, string> = { willow: 'Willow Wood', alder: 'Alder Wood', oak: 'Oak Wood' };
    return map[key] || key;
  }

  private updateFooterLabel() {
    const protText = this.activeMix.weatherProtection && this.activeMix.weatherProtection !== 'none'
      ? ` [Protected: ${this.getFriendlyProtectionName(this.activeMix.weatherProtection)}]`
      : '';
    this.lblFooterSummary.textContent = `${this.activeMix.saltpeterRatio.toFixed(1)}% Nitrum / ${this.activeMix.charcoalRatio.toFixed(1)}% Carbo / ${this.activeMix.sulfurRatio.toFixed(1)}% Sulphur (${this.getFriendlyWoodName(this.activeMix.charcoalSource)})${protText}`;
  }

  private syncProtectionCards() {
    const activeProt = this.activeMix.weatherProtection || 'none';
    this.protectionCards.forEach(card => {
      const prot = card.getAttribute('data-protection');
      card.classList.toggle('active', prot === activeProt);
    });
  }

  private getFriendlyProtectionName(key: string): string {
    const map: Record<string, string> = {
      none: 'None',
      parchment: 'Oiled Parchment',
      pan_shield: 'Pan Shield',
      operator_cowl: 'Operator Cowl'
    };
    return map[key] || key;
  }
}
