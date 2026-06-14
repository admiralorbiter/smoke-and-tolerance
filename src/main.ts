import { ShotInput, ShotResultWasm, parseFramesFromBuffer, ShotFrame, ERA_REGISTRY, AlchemicalMix } from './types';
import { AudioManager } from './audio/AudioManager';
import { CutawayRenderer } from './render/CutawayRenderer';
import { ControlsPanel } from './ui/ControlsPanel';
import { Timeline } from './ui/Timeline';
import { ComparisonPanel } from './ui/ComparisonPanel';
import { AlchemicalLabOverlay } from './ui/AlchemicalLabOverlay';

class LaboratoryApp {
  private renderer!: CutawayRenderer;
  private controls!: ControlsPanel;
  private timeline!: Timeline;
  private worker!: Worker;
  private comparisonPanel!: ComparisonPanel;
  private labOverlay!: AlchemicalLabOverlay;

  private currentInputs: ShotInput | null = null;
  private shotHistory: Array<{ inputs: ShotInput; frames: ShotFrame[] }> = [];
  private isInitialLoad: boolean = true;
  private isEraSwitchLoad: boolean = false;
  private hasFiredShot: boolean = false;
  private persistentFouling: number = 0.0;
  private persistentFatigue: number = 0.0;
  private flawSeed: number = Math.floor(Math.random() * 1000000);
  private activeEra: string = 'hand_cannon';

  private activeWeatherProtection: string = 'none';
  private customMixActive: boolean = false;
  private customAlchemicalMix: AlchemicalMix = {
    saltpeterRatio: 75.0,
    charcoalRatio: 15.0,
    sulfurRatio: 10.0,
    charcoalSource: 'alder',
    saltpeterPurity: 50.0,
    weatherProtection: 'none',
  };

  private lastRenderedFrameIndex: number = 0;
  private lastRenderedFrames: any[] = [];


  constructor() {
    this.initApp();
  }

  private initApp() {
    // 1. Initialize Web Worker for background WASM execution
    try {
      this.worker = new Worker(
        new URL('./wasm/sim.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = (e: MessageEvent) => {
        const { success, result, rawBuffer, error } = e.data;
        this.controls.setFiringState(false);
        this.setSimulationActive(false);

        if (!success) {
          console.error('Simulation worker error:', error);
          document.getElementById('diag-summary')!.textContent = 
            `Simulation failed: ${error}`;
          return;
        }

        const wasmResult = result as ShotResultWasm;
        
        // Zero-copy parse of the raw transferred array buffer
        const frames = parseFramesFromBuffer(rawBuffer, 0, wasmResult.frameCount);

        // Update timeline with frames
        this.timeline.setFrames(frames);
        
        // Extract updated fouling and fatigue state from final frame (if not initial dummy shot)
        if (!this.isInitialLoad && frames.length > 0) {
          this.persistentFouling = frames[frames.length - 1].foulingIndex;
          this.updateFoulingMeter();
          
          this.persistentFatigue = frames[frames.length - 1].barrelFatigue;
          this.updateFatigueMeter();
        }
        
        if (this.isInitialLoad) {
          this.isInitialLoad = false;
        } else if (this.isEraSwitchLoad) {
          this.isEraSwitchLoad = false;
          this.comparisonPanel.hide();
        } else {
          // Update comparison panel
          const prev = this.shotHistory[this.shotHistory.length - 1];
          if (prev) {
            this.comparisonPanel.update(
              this.currentInputs!,
              frames,
              prev.inputs,
              prev.frames
            );
          } else {
            this.comparisonPanel.hide();
          }
          this.timeline.play();
        }

        // Render diagnosis
        this.updateDiagnosisPanel(wasmResult);
      };

      console.log('Smoke & Tolerance Web Worker initialized.');
    } catch (err) {
      console.error('Failed to initialize Web Worker:', err);
      document.getElementById('diag-summary')!.textContent = 
        'Error: Web Worker failed to initialize. Please check console logs.';
      return;
    }

    // 2. Instantiate Components
    this.renderer = new CutawayRenderer('sim-cutaway-canvas', 'sim-trajectory-canvas');
    this.renderer.clear();
    this.comparisonPanel = new ComparisonPanel();

    this.controls = new ControlsPanel((inputs) => {
      this.selectTab('charts');
      this.handleFireShot(inputs);
    });

    // Instantiate Alchemical Synthesis Lab
    this.labOverlay = new AlchemicalLabOverlay((mix, material) => {
      // Decouple touch-hole protection from custom mixes
      const ratiosChanged = 
        mix.saltpeterRatio !== this.customAlchemicalMix.saltpeterRatio ||
        mix.charcoalRatio !== this.customAlchemicalMix.charcoalRatio ||
        mix.sulfurRatio !== this.customAlchemicalMix.sulfurRatio ||
        mix.charcoalSource !== this.customAlchemicalMix.charcoalSource ||
        mix.saltpeterPurity !== this.customAlchemicalMix.saltpeterPurity;

      this.customAlchemicalMix = { ...mix };
      this.activeWeatherProtection = mix.weatherProtection || 'none';

      if (ratiosChanged || this.customMixActive) {
        this.customMixActive = true;
        this.controls.setCustomMixActive(true);
        const banner = document.getElementById('custom-batch-indicator');
        if (banner) banner.style.display = 'flex';
      }

      this.controls.setBarrelMaterial(material);
      
      this.shotHistory = [];
      this.comparisonPanel.hide();
      
      this.handleFireShot(this.controls.getInputs());
    });

    this.timeline = new Timeline(
      (frame, index, frames) => {
        this.lastRenderedFrameIndex = index;
        this.lastRenderedFrames = frames;

        if (this.currentInputs) {
          this.renderer.drawFrame(
            frame,
            this.currentInputs,
            !this.timeline.isPlaying,
            this.shotHistory
          );
          this.updateGlowingBorders(frame);
          this.updateChemistryDashboard(frame, this.currentInputs);
          this.renderCharts(frames, index, this.shotHistory);
          AudioManager.getInstance().handleFrame(
            frame,
            index,
            this.timeline.isPlaying,
            this.currentInputs
          );
        }
      },
      () => {
        // Clean soot callback
        this.persistentFouling = 0.0;
        this.updateFoulingMeter();
        this.renderer.setSootLevel(0);
        
        // Reset comparison
        this.shotHistory = [];
        this.comparisonPanel.hide();

        this.selectTab('instruments');
        AudioManager.getInstance().playCleanBore();
        // Refire current settings
        this.handleFireShot(this.controls.getInputs());
      }
    );

    // 3. Tab Navigation Event Listeners
    const tabBtnInstruments = document.getElementById('tab-btn-instruments');
    const tabBtnLedger = document.getElementById('tab-btn-ledger');
    const tabBtnCharts = document.getElementById('tab-btn-charts');
    const tabBtnCodex = document.getElementById('tab-btn-codex');

    tabBtnInstruments?.addEventListener('click', () => this.selectTab('instruments'));
    tabBtnLedger?.addEventListener('click', () => this.selectTab('ledger'));
    tabBtnCharts?.addEventListener('click', () => this.selectTab('charts'));
    tabBtnCodex?.addEventListener('click', () => this.selectTab('codex'));

    // 4. Era Navigation Event Listeners
    const eraButtons = document.querySelectorAll('.era-btn');
    eraButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const eraId = btn.getAttribute('data-era');
        if (eraId && ERA_REGISTRY[eraId]) {
          this.switchEra(eraId);
        }
      });
    });

    // 5. Alchemical Workbench Toggle Listeners
    const btnOpenLab = document.getElementById('btn-open-lab');
    btnOpenLab?.addEventListener('click', () => {
      this.customAlchemicalMix.weatherProtection = this.activeWeatherProtection;
      this.labOverlay.show(this.customAlchemicalMix, this.controls.getInputs().barrelMaterial, this.activeEra);
    });

    const btnResetBatch = document.getElementById('btn-reset-batch');
    btnResetBatch?.addEventListener('click', () => {
      this.resetCustomBatch();
    });

    // 6. X-Ray View & Repair Listeners
    const chkXrayMode = document.getElementById('chk-xray-mode') as HTMLInputElement;
    chkXrayMode?.addEventListener('change', () => {
      const active = chkXrayMode.checked;
      this.renderer.setXrayMode(active);
      
      // Redraw immediately if we have frames loaded
      if (this.currentInputs && this.lastRenderedFrames && this.lastRenderedFrames.length > 0) {
        const frame = this.lastRenderedFrames[this.lastRenderedFrameIndex];
        if (frame) {
          this.renderer.drawFrame(
            frame,
            this.currentInputs,
            !this.timeline.isPlaying,
            this.shotHistory
          );
        }
      }
    });

    const btnRepair = document.getElementById('btn-repair-barrel');
    btnRepair?.addEventListener('click', () => {
      this.repairBarrel();
    });

    // 7. View Layout Toggle Listeners
    const btnViewSplit = document.getElementById('btn-view-split') as HTMLButtonElement;
    const btnViewCutaway = document.getElementById('btn-view-cutaway') as HTMLButtonElement;
    const btnViewTrajectory = document.getElementById('btn-view-trajectory') as HTMLButtonElement;
    
    const cutawayCard = document.querySelector('.cutaway-card') as HTMLDivElement;
    const trajectoryCard = document.querySelector('.trajectory-card') as HTMLDivElement;

    const selectLayout = (layout: 'split' | 'cutaway' | 'trajectory') => {
      btnViewSplit?.classList.toggle('active', layout === 'split');
      btnViewCutaway?.classList.toggle('active', layout === 'cutaway');
      btnViewTrajectory?.classList.toggle('active', layout === 'trajectory');

      if (layout === 'split') {
        if (cutawayCard) cutawayCard.style.display = 'block';
        if (trajectoryCard) trajectoryCard.style.display = 'block';
      } else if (layout === 'cutaway') {
        if (cutawayCard) cutawayCard.style.display = 'block';
        if (trajectoryCard) trajectoryCard.style.display = 'none';
      } else if (layout === 'trajectory') {
        if (cutawayCard) cutawayCard.style.display = 'none';
        if (trajectoryCard) trajectoryCard.style.display = 'block';
      }

      // Redraw immediately so everything is centered and scaled properly
      if (this.currentInputs && this.lastRenderedFrames && this.lastRenderedFrames.length > 0) {
        const frame = this.lastRenderedFrames[this.lastRenderedFrameIndex];
        if (frame) {
          this.renderer.drawFrame(
            frame,
            this.currentInputs,
            !this.timeline.isPlaying,
            this.shotHistory
          );
        }
      }
    };

    btnViewSplit?.addEventListener('click', () => selectLayout('split'));
    btnViewCutaway?.addEventListener('click', () => selectLayout('cutaway'));
    btnViewTrajectory?.addEventListener('click', () => selectLayout('trajectory'));

    // Initialize with hand_cannon defaults
    this.activeEra = 'hand_cannon';
    const activeConfig = ERA_REGISTRY[this.activeEra];
    this.controls.applyEraRestrictions(activeConfig);
    this.updateCodexPanel(activeConfig);
    this.updateFatigueMeter();

    // Bind interactive lens tooltips mouseover
    const cutawayCanvas = document.getElementById('sim-cutaway-canvas') as HTMLCanvasElement;
    cutawayCanvas?.addEventListener('mousemove', (e) => {
      const rect = cutawayCanvas.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * cutawayCanvas.width;
      const mouseY = ((e.clientY - rect.top) / rect.height) * cutawayCanvas.height;
      const tooltip = this.renderer.getTooltipAt(mouseX, mouseY);
      if (tooltip) {
        cutawayCanvas.title = tooltip;
        cutawayCanvas.style.cursor = 'help';
      } else {
        cutawayCanvas.title = '';
        cutawayCanvas.style.cursor = 'default';
      }
    });

    // Run an initial blank shot to show the static device in setup
    this.handleInitialState();

    // Start continuous 60fps animation loop for sparkles and active glows
    this.startAnimationLoop();
  }

  private selectTab(activeTab: 'instruments' | 'ledger' | 'charts' | 'codex') {
    const tabBtnInstruments = document.getElementById('tab-btn-instruments');
    const tabBtnLedger = document.getElementById('tab-btn-ledger');
    const tabBtnCharts = document.getElementById('tab-btn-charts');
    const tabBtnCodex = document.getElementById('tab-btn-codex');

    const tabContentInstruments = document.getElementById('chem-tab-instruments');
    const tabContentLedger = document.getElementById('chem-tab-ledger');
    const tabContentCharts = document.getElementById('chem-tab-charts');
    const tabContentCodex = document.getElementById('chem-tab-codex');

    tabBtnInstruments?.classList.toggle('active', activeTab === 'instruments');
    tabBtnLedger?.classList.toggle('active', activeTab === 'ledger');
    tabBtnCharts?.classList.toggle('active', activeTab === 'charts');
    tabBtnCodex?.classList.toggle('active', activeTab === 'codex');

    tabContentInstruments?.classList.toggle('active', activeTab === 'instruments');
    tabContentLedger?.classList.toggle('active', activeTab === 'ledger');
    tabContentCharts?.classList.toggle('active', activeTab === 'charts');
    tabContentCodex?.classList.toggle('active', activeTab === 'codex');

    if (activeTab === 'charts' && this.lastRenderedFrames.length > 0) {
      this.renderCharts(this.lastRenderedFrames, this.lastRenderedFrameIndex, this.shotHistory);
    }
  }

  private updateFoulingMeter() {
    const bar = document.getElementById('fouling-meter-bar') as HTMLDivElement;
    const text = document.getElementById('fouling-meter-text') as HTMLSpanElement;
    if (bar && text) {
      const percentage = (this.persistentFouling * 100).toFixed(0);
      bar.style.width = `${percentage}%`;
      text.textContent = this.persistentFouling === 0 ? 'CLEAN (0%)' : `${percentage}% FOULED`;
    }
  }

  private handleInitialState() {
    // We send a 100% priming quality dummy input to show static state on load
    const initialInputs = this.controls.getInputs();
    initialInputs.primingQuality = 100.0;
    initialInputs.persistentFouling = this.persistentFouling;
    initialInputs.persistentFatigue = this.persistentFatigue;
    initialInputs.flawSeed = this.flawSeed;
    initialInputs.weatherProtection = this.activeWeatherProtection;
    if (this.customMixActive) {
      initialInputs.customMixActive = true;
      initialInputs.alchemicalMix = this.customAlchemicalMix;
    }
    this.currentInputs = initialInputs;
    AudioManager.getInstance().updateAmbientWind(initialInputs.weatherWind);
    this.worker.postMessage({ input: initialInputs });
  }

  private handleFireShot(inputs: ShotInput) {
    if (this.hasFiredShot && this.currentInputs && this.lastRenderedFrames && this.lastRenderedFrames.length > 0) {
      this.shotHistory.push({
        inputs: { ...this.currentInputs },
        frames: [...this.lastRenderedFrames]
      });
      if (this.shotHistory.length > 4) {
        this.shotHistory.shift();
      }
    }

    this.hasFiredShot = true;
    inputs.persistentFouling = this.persistentFouling;
    inputs.persistentFatigue = this.persistentFatigue;
    inputs.flawSeed = this.flawSeed;
    inputs.weatherProtection = this.activeWeatherProtection;
    if (this.customMixActive) {
      inputs.customMixActive = true;
      inputs.alchemicalMix = this.customAlchemicalMix;
    }
    this.currentInputs = inputs;
    this.controls.setFiringState(true);
    this.setSimulationActive(true);
    inputs.primingQuality = 100.0;
    AudioManager.getInstance().updateAmbientWind(inputs.weatherWind);
    this.worker.postMessage({ input: inputs });
  }

  private resetCustomBatch() {
    this.customMixActive = false;
    this.controls.setCustomMixActive(false);
    
    const banner = document.getElementById('custom-batch-indicator');
    if (banner) banner.style.display = 'none';
    
    this.shotHistory = [];
    this.comparisonPanel.hide();
    
    this.handleFireShot(this.controls.getInputs());
  }


  private updateDiagnosisPanel(result: ShotResultWasm) {
    const summaryEl = document.getElementById('diag-summary') as HTMLDivElement;
    const cardsEl = document.getElementById('diag-cards') as HTMLDivElement;

    summaryEl.textContent = result.summary;
    cardsEl.innerHTML = ''; // clear previous cards

    if (result.diagnosis.length === 0) {
      cardsEl.innerHTML = '<div style="font-style: italic; color: #a8947b; font-size: 0.85rem;">No warnings or anomalies reported.</div>';
      return;
    }

    result.diagnosis.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = `diag-card ${card.severity}`;

      const titleDiv = document.createElement('div');
      titleDiv.className = 'diag-card-title';
      titleDiv.textContent = card.title;

      const explanationDiv = document.createElement('div');
      explanationDiv.className = 'diag-card-explanation';
      explanationDiv.textContent = card.explanation;

      cardDiv.appendChild(titleDiv);
      cardDiv.appendChild(explanationDiv);
      cardsEl.appendChild(cardDiv);
    });
  }

  private updateChemistryDashboard(frame: any, inputs: ShotInput) {
    let saltpeter = inputs.refinementLevel;
    let charcoal = (100 - saltpeter) * 0.6;
    let sulfur = (100 - saltpeter) * 0.4;

    if (inputs.customMixActive && inputs.alchemicalMix) {
      saltpeter = inputs.alchemicalMix.saltpeterRatio;
      charcoal = inputs.alchemicalMix.charcoalRatio;
      sulfur = inputs.alchemicalMix.sulfurRatio;
    }


    // 1. Tria Prima Plot
    const marker = document.getElementById('marker-tria-prima');
    const txtSaltpeter = document.getElementById('txt-ratio-saltpeter');
    const txtCharcoal = document.getElementById('txt-ratio-charcoal');
    const txtSulfur = document.getElementById('txt-ratio-sulfur');

    if (marker && txtSaltpeter && txtCharcoal && txtSulfur) {
      const a = saltpeter / 100;
      const b = sulfur / 100;
      const c = charcoal / 100;
      const cx = a * 80 + b * 20 + c * 140;
      const cy = a * 15 + b * 120 + c * 120;
      
      marker.setAttribute('cx', cx.toFixed(1));
      marker.setAttribute('cy', cy.toFixed(1));

      txtSaltpeter.textContent = `${saltpeter.toFixed(1)}%`;
      txtCharcoal.textContent = `${charcoal.toFixed(1)}%`;
      txtSulfur.textContent = `${sulfur.toFixed(1)}%`;
    }

    // 2. Caloric Pyrometer
    const rectFill = document.getElementById('rect-pyro-fill');
    const txtTemp = document.getElementById('txt-temperature');
    const txtStage = document.getElementById('txt-heat-stage');
    const chemCard = document.querySelector('.chemistry-card');

    if (rectFill && txtTemp && txtStage) {
      const tempMin = 293.15;
      const tempMax = 2500.0;
      const tempRatio = Math.min(1.0, Math.max(0.0, (frame.temperature - tempMin) / (tempMax - tempMin)));
      const fillHeight = tempRatio * 115;
      
      rectFill.setAttribute('y', (140 - fillHeight).toFixed(1));
      rectFill.setAttribute('height', fillHeight.toFixed(1));

      txtTemp.textContent = `${frame.temperature.toFixed(2)} K`;

      let stageLabel = 'IGNIS FATUUS';
      if (frame.temperature >= 2000) {
        stageLabel = 'IGNIS VERTICALIS';
      } else if (frame.temperature >= 1000) {
        stageLabel = 'IGNIS FLAMMAE';
      } else if (frame.temperature >= 400) {
        stageLabel = 'IGNIS SOLIS';
      }
      txtStage.textContent = stageLabel;

      if (chemCard) {
        chemCard.classList.toggle('thermal-pulse', frame.temperature >= 2000);
      }
    }

    // 3. Alembic Flask
    const powderPath = document.getElementById('path-alembic-powder');
    const firePath = document.getElementById('ellipse-alembic-fire');
    const gasPath = document.getElementById('path-alembic-gas');
    const txtMassPowder = document.getElementById('txt-mass-unburned');
    const txtMassGas = document.getElementById('txt-mass-gas');

    const mUnburned = frame.unburnedMass * 1000;
    const mGas = frame.gasMass * 1000;

    if (powderPath && firePath && gasPath && txtMassPowder && txtMassGas) {
      const powderRatio = mUnburned / 15.0;
      powderPath.style.transform = `scaleY(${powderRatio})`;
      powderPath.style.transformOrigin = '60px 143px';

      const peakGas = 15.0 * 0.45;
      const gasRatio = mGas / peakGas;
      gasPath.style.opacity = Math.min(0.9, gasRatio * 1.5).toFixed(2);

      const fireOpacity = (frame.stage === 'ignition' || frame.stage === 'pressure') ? Math.min(1.0, frame.pressure / 5.0) : 0;
      firePath.style.opacity = fireOpacity.toFixed(2);

      txtMassPowder.textContent = `${mUnburned.toFixed(2)} g`;
      txtMassGas.textContent = `${mGas.toFixed(2)} g`;
    }

    // 4. Ledger Table
    const tdUnburned = document.getElementById('td-mass-unburned');
    const tdGas = document.getElementById('td-mass-gas');
    const tdLeaked = document.getElementById('td-mass-leaked');
    const tdFouling = document.getElementById('td-mass-fouling');
    const tdSmoke = document.getElementById('td-mass-smoke');
    const tdTotal = document.getElementById('td-mass-total');

    const tdFracUnburned = document.getElementById('td-frac-unburned');
    const tdFracGas = document.getElementById('td-frac-gas');
    const tdFracLeaked = document.getElementById('td-frac-leaked');
    const tdFracFouling = document.getElementById('td-frac-fouling');
    const tdFracSmoke = document.getElementById('td-frac-smoke');

    const mSoot = (frame.fouling / 500.0) * 1000;
    const mSmoke = mSoot * (0.85 / 0.15);
    const mLeaked = Math.max(0, 15.0 - (mUnburned + mGas + mSoot + mSmoke));
    const mTotal = mUnburned + mGas + mSoot + mSmoke + mLeaked;

    if (tdUnburned && tdGas && tdLeaked && tdFouling && tdSmoke && tdTotal &&
        tdFracUnburned && tdFracGas && tdFracLeaked && tdFracFouling && tdFracSmoke) {
      tdUnburned.textContent = mUnburned.toFixed(2);
      tdGas.textContent = mGas.toFixed(2);
      tdLeaked.textContent = mLeaked.toFixed(2);
      tdFouling.textContent = mSoot.toFixed(2);
      tdSmoke.textContent = mSmoke.toFixed(2);
      tdTotal.textContent = mTotal.toFixed(2);

      tdFracUnburned.textContent = `${(mUnburned / 15.0 * 100).toFixed(1)}%`;
      tdFracGas.textContent = `${(mGas / 15.0 * 100).toFixed(1)}%`;
      tdFracLeaked.textContent = `${(mLeaked / 15.0 * 100).toFixed(1)}%`;
      tdFracFouling.textContent = `${(mSoot / 15.0 * 100).toFixed(1)}%`;
      tdFracSmoke.textContent = `${(mSmoke / 15.0 * 100).toFixed(1)}%`;
    }
  }

  private renderSingleChart(
    canvas: HTMLCanvasElement,
    color: string,
    valKey: keyof ShotFrame | null,
    maxVal: number,
    unit: string,
    isMass: boolean,
    frames: ShotFrame[],
    currentIndex: number,
    history: Array<{ inputs: ShotInput; frames: ShotFrame[] }>
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background to match card panel theme
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, w, h);

    if (frames.length === 0) return;

    // Drawing bounds inside the canvas
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 25;

    const plotX = paddingLeft;
    const plotY = paddingTop;
    const plotW = w - paddingLeft - paddingRight;
    const plotH = h - paddingTop - paddingBottom;

    // Draw bounding box
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Draw dynamic scale lines (dashed horizontal lines)
    ctx.strokeStyle = '#1b1612';
    ctx.beginPath();
    for (let yRatio = 0.25; yRatio < 1.0; yRatio += 0.25) {
      const y = plotY + plotH - yRatio * plotH;
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
    }
    ctx.stroke();

    // Subplot boundary readouts (Y-axis labels)
    ctx.fillStyle = '#5c4b3c';
    ctx.font = 'normal 9px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(maxVal.toFixed(0) + unit, plotX - 6, plotY + 6);
    ctx.fillText('0' + unit, plotX - 6, plotY + plotH);
    ctx.textAlign = 'left'; // reset

    // If no shot has been fired, render centered overlay with awaiting alchemical message
    if (!this.hasFiredShot) {
      ctx.fillStyle = 'rgba(12, 10, 9, 0.8)';
      ctx.fillRect(plotX, plotY, plotW, plotH);

      ctx.fillStyle = '#bca085';
      ctx.font = 'normal 11px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('🜔 AWAITING TEST FIRE... 🜔', plotX + plotW / 2, plotY + plotH / 2 - 6);
      
      ctx.fillStyle = '#8f7762';
      ctx.font = 'normal 8px Share Tech Mono, monospace';
      ctx.fillText('LAUNCH THE DEVICE TO PLOT TELEMETRY', plotX + plotW / 2, plotY + plotH / 2 + 10);
      ctx.textAlign = 'left'; // restore default
      return;
    }

    // Render history curves (if any) with opacity decay
    const colorMap: Record<string, string> = {
      '#d94e34': '217, 78, 52',
      '#ffb703': '255, 183, 3',
      '#a8947b': '168, 148, 123',
      '#e6c387': '230, 195, 135'
    };

    if (history && history.length > 0) {
      history.forEach((histItem, j) => {
        const d = history.length - 1 - j;
        const lineOpacity = Math.max(0.04, 0.45 * Math.pow(0.5, d));
        const gasLineOpacity = Math.max(0.04, 0.45 * Math.pow(0.5, d));

        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        
        ctx.beginPath();
        histItem.frames.forEach((frame, idx) => {
          const x = plotX + (idx / (histItem.frames.length - 1)) * plotW;
          if (isMass) {
            const mUnburned = frame.unburnedMass * 1000;
            const y = plotY + plotH - (mUnburned / maxVal) * plotH;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          } else {
            const val = frame[valKey!] as number;
            const y = plotY + plotH - (val / maxVal) * plotH;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        });
        ctx.strokeStyle = isMass ? `rgba(168, 148, 123, ${lineOpacity})` : `rgba(${colorMap[color] || '140, 118, 98'}, ${lineOpacity})`;
        ctx.stroke();

        // If mass plot, render chamber gas curve on top in muted gold dash
        if (isMass) {
          ctx.beginPath();
          histItem.frames.forEach((frame, idx) => {
            const x = plotX + (idx / (histItem.frames.length - 1)) * plotW;
            const mGas = frame.gasMass * 1000;
            const y = plotY + plotH - (mGas / maxVal) * plotH;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = `rgba(230, 195, 135, ${gasLineOpacity})`;
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // Render current chart data line
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    frames.forEach((frame, idx) => {
      const x = plotX + (idx / (frames.length - 1)) * plotW;
      if (isMass) {
        const mUnburned = frame.unburnedMass * 1000; // grams
        const y = plotY + plotH - (mUnburned / maxVal) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      } else {
        const val = frame[valKey!] as number;
        const y = plotY + plotH - (val / maxVal) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = isMass ? '#a8947b' : color;
    ctx.stroke();

    // If mass plot, render chamber gas curve on top in gold
    if (isMass) {
      ctx.beginPath();
      frames.forEach((frame, idx) => {
        const x = plotX + (idx / (frames.length - 1)) * plotW;
        const mGas = frame.gasMass * 1000; // grams
        const y = plotY + plotH - (mGas / maxVal) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#e6c387';
      ctx.stroke();
    }

    // Draw current scrub timeline indicator line
    const scrubX = plotX + (currentIndex / (frames.length - 1)) * plotW;
    ctx.strokeStyle = 'rgba(207, 168, 107, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scrubX, plotY);
    ctx.lineTo(scrubX, plotY + plotH);
    ctx.stroke();

    // Display telemetry value at the scrub position
    if (currentIndex < frames.length) {
      const curFrame = frames[currentIndex];
      let valText = '';

      // Find corresponding previous frame (immediate last shot in history)
      let prevFrame: ShotFrame | null = null;
      const prevItem = history[history.length - 1];
      if (prevItem && prevItem.frames.length > 0) {
        const ratio = currentIndex / (frames.length - 1);
        const prevIndex = Math.round(ratio * (prevItem.frames.length - 1));
        prevFrame = prevItem.frames[prevIndex] || null;
      }

      if (isMass) {
        const curPowder = curFrame.unburnedMass * 1000;
        const curGas = curFrame.gasMass * 1000;
        valText = `Powder: ${curPowder.toFixed(1)}g / Gas: ${curGas.toFixed(1)}g`;
        if (prevFrame) {
          const prevPowder = prevFrame.unburnedMass * 1000;
          const prevGas = prevFrame.gasMass * 1000;
          valText += ` (Prev Powder: ${prevPowder.toFixed(1)}g / Gas: ${prevGas.toFixed(1)}g)`;
        }
      } else {
        const val = curFrame[valKey!] as number;
        valText = val.toFixed(1) + unit;
        if (prevFrame) {
          const prevVal = prevFrame[valKey!] as number;
          valText += ` (Prev: ${prevVal.toFixed(1)}${unit})`;
        }
      }

      ctx.save();
      ctx.fillStyle = 'rgba(207, 168, 107, 0.9)';
      ctx.font = 'normal 9px Share Tech Mono, monospace';
      
      // Adjust alignment depending on right boundary to prevent visual clipping
      let textX = scrubX + 6;
      if (scrubX > plotX + plotW - 120) {
        ctx.textAlign = 'right';
        textX = scrubX - 6;
      } else {
        ctx.textAlign = 'left';
      }
      ctx.fillText(valText, textX, plotY + plotH - 6);
      ctx.restore();
    }

    // Subplot total duration label
    const totalTimeMs = frames[frames.length - 1].timeMs;
    ctx.fillStyle = '#5c4b3c';
    ctx.font = 'normal 9px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Duration: ${totalTimeMs.toFixed(1)}ms`, plotX + plotW, plotY + plotH + 15);
    ctx.textAlign = 'left';
  }

  private renderCharts(frames: ShotFrame[], currentIndex: number, history: Array<{ inputs: ShotInput; frames: ShotFrame[] }> = []) {
    const canvasPressure = document.getElementById('chart-pressure') as HTMLCanvasElement;
    const canvasTemp = document.getElementById('chart-temp') as HTMLCanvasElement;
    const canvasMass = document.getElementById('chart-mass') as HTMLCanvasElement;

    if (!canvasPressure || !canvasTemp || !canvasMass) return;

    if (frames.length === 0) return;

    const maxPressureCur = Math.max(...frames.map(f => f.pressure));
    const maxTempCur = Math.max(...frames.map(f => f.temperature));
    let maxPressure = maxPressureCur;
    let maxTemp = maxTempCur;

    if (history && history.length > 0) {
      history.forEach(hist => {
        const pMax = Math.max(...hist.frames.map(f => f.pressure));
        const tMax = Math.max(...hist.frames.map(f => f.temperature));
        maxPressure = Math.max(maxPressure, pMax);
        maxTemp = Math.max(maxTemp, tMax);
      });
    }

    const maxPressureVal = Math.max(30.0, Math.ceil((maxPressure * 1.1) / 5) * 5);
    const maxTempVal = Math.max(2500.0, Math.ceil((maxTemp * 1.05) / 100) * 100);

    this.renderSingleChart(canvasPressure, '#d94e34', 'pressure', maxPressureVal, 'MPa', false, frames, currentIndex, history);
    this.renderSingleChart(canvasTemp, '#ffb703', 'temperature', maxTempVal, 'K', false, frames, currentIndex, history);
    this.renderSingleChart(canvasMass, '#e6c387', null, 15.0, 'g', true, frames, currentIndex, history);
  }

  private switchEra(eraId: string) {
    if (this.activeEra === eraId) return;
    this.activeEra = eraId;

    // Era transition animation
    const containers = document.querySelectorAll('.fade-slide-container');
    containers.forEach(el => {
      el.classList.add('fade-slide-enter');
      (el as HTMLElement).offsetHeight; // trigger reflow
    });
    setTimeout(() => {
      containers.forEach(el => {
        el.classList.remove('fade-slide-enter');
      });
    }, 50);

    // Toggle active timeline button
    const eraButtons = document.querySelectorAll('.era-btn');
    eraButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-era') === eraId);
    });

    // Reset custom alchemical batch on Era switch
    if (this.customMixActive) {
      this.customMixActive = false;
      this.controls.setCustomMixActive(false);
      const banner = document.getElementById('custom-batch-indicator');
      if (banner) banner.style.display = 'none';
    }

    // Adapt active protection if restricted in the new era
    if (this.activeWeatherProtection === 'pan_shield' && ['strange_fire', 'fire_delivered', 'directional_blast'].includes(eraId)) {
      this.activeWeatherProtection = 'none';
      this.customAlchemicalMix.weatherProtection = 'none';
    }

    // Apply setting locks
    const config = ERA_REGISTRY[eraId];
    this.controls.applyEraRestrictions(config);
    
    // Update Codex description
    this.updateCodexPanel(config);

    // Purge Run History (Cassandra's Decoupling Rule)
    this.shotHistory = [];
    this.comparisonPanel.hide();
    
    // Switch to Codex tab so the user can read the background
    this.selectTab('codex');

    this.persistentFatigue = 0.0;
    this.flawSeed = Math.floor(Math.random() * 1000000);
    this.updateFatigueMeter();

    // Trigger initial setup simulation to immediately update graphics/instruments
    this.isEraSwitchLoad = true;
    this.handleInitialState();
  }


  private updateCodexPanel(config: any) {
    const title = document.getElementById('codex-title');
    const illustration = document.getElementById('codex-illustration');
    const description = document.getElementById('codex-description');
    const objective = document.getElementById('codex-objective');
    const unreliable = document.getElementById('codex-unreliable');
    const nextStep = document.getElementById('codex-next-step');
    const challenge = document.getElementById('codex-challenge');

    if (title) title.textContent = `${config.name} (${config.dateRange})`;
    if (illustration) illustration.textContent = config.codex.illustration;
    if (description) description.textContent = config.codex.description;
    if (objective) objective.textContent = config.codex.objective;
    if (unreliable) unreliable.textContent = config.codex.unreliable;
    if (nextStep) nextStep.textContent = config.codex.nextStep;
    if (challenge) challenge.textContent = config.codex.challenge;
  }

  private repairBarrel() {
    this.persistentFatigue = 0.0;
    this.updateFatigueMeter();
    
    // Decouple/clear comparison history
    this.shotHistory = [];
    this.comparisonPanel.hide();

    // Re-seed based on material
    const material = this.controls.getInputs().barrelMaterial;
    if (material === 'bamboo') {
      this.flawSeed = Math.floor(Math.random() * 1000000);
    } else {
      // Metal: minor adjustment/perturbation
      this.flawSeed = (this.flawSeed + 37) % 1000000;
    }

    // Play clean bore sound for feedback
    AudioManager.getInstance().playCleanBore();
    
    // Switch to instruments
    this.selectTab('instruments');

    // Refire current settings (initial setup shot) as a static layout update
    this.isEraSwitchLoad = true;
    this.handleInitialState();
  }

  private updateFatigueMeter() {
    const bar = document.getElementById('fatigue-meter-bar') as HTMLDivElement;
    const text = document.getElementById('fatigue-meter-text') as HTMLSpanElement;
    if (bar && text) {
      const percentage = Math.min(100, Math.max(0, this.persistentFatigue * 100));
      bar.style.width = `${percentage}%`;
      
      let statusText = 'PRISTINE (0%)';
      if (percentage >= 100) {
        statusText = '💥 CATASTROPHIC RUPTURE (100%)';
        bar.style.background = '#ff3c00';
      } else if (percentage >= 80) {
        statusText = `CRITICAL DISTRESS (${percentage.toFixed(0)}%)`;
        bar.style.background = '#ff3c00';
      } else if (percentage >= 50) {
        statusText = `HEAVILY FATIGUED (${percentage.toFixed(0)}%)`;
        bar.style.background = '#ff9f1c';
      } else if (percentage >= 20) {
        statusText = `DEFORMED / MICRO-FISSURES (${percentage.toFixed(0)}%)`;
        bar.style.background = '#d94e34';
      } else if (percentage > 0) {
        statusText = `STRESSED (${percentage.toFixed(0)}%)`;
        bar.style.background = '#8c7662';
      } else {
        bar.style.background = 'linear-gradient(90deg, #3a322c 0%, #1c1815 100%)';
      }
      text.textContent = statusText;
    }
  }

  private setSimulationActive(active: boolean) {
    this.controls.setEnabled(!active);
    
    const eraButtons = document.querySelectorAll('.era-btn') as NodeListOf<HTMLButtonElement>;
    eraButtons.forEach(btn => {
      btn.disabled = active;
      btn.style.opacity = active ? '0.6' : '1.0';
      btn.style.pointerEvents = active ? 'none' : 'auto';
    });

    const btnClean = document.getElementById('btn-clear-soot') as HTMLButtonElement;
    if (btnClean) {
      btnClean.disabled = active;
      btnClean.style.opacity = active ? '0.6' : '1.0';
    }

    const btnRepair = document.getElementById('btn-repair-barrel') as HTMLButtonElement;
    if (btnRepair) {
      btnRepair.disabled = active;
      btnRepair.style.opacity = active ? '0.6' : '1.0';
    }

    const btnOpenLab = document.getElementById('btn-open-lab') as HTMLButtonElement;
    if (btnOpenLab) {
      btnOpenLab.disabled = active;
      btnOpenLab.style.opacity = active ? '0.6' : '1.0';
    }

    const btnResetBatch = document.getElementById('btn-reset-batch') as HTMLButtonElement;
    if (btnResetBatch) {
      btnResetBatch.disabled = active;
      btnResetBatch.style.opacity = active ? '0.6' : '1.0';
    }

    const viewButtons = ['btn-view-split', 'btn-view-cutaway', 'btn-view-trajectory'].map(id => document.getElementById(id) as HTMLButtonElement);
    viewButtons.forEach(btn => {
      if (btn) {
        btn.disabled = active;
        btn.style.opacity = active ? '0.6' : '1.0';
      }
    });
  }

  private startAnimationLoop() {
    const loop = () => {
      if (this.currentInputs && this.lastRenderedFrames && this.lastRenderedFrames.length > 0) {
        const frame = this.lastRenderedFrames[this.lastRenderedFrameIndex];
        if (frame) {
          const isPlayOrSetup = this.timeline.isPlaying || frame.stage === 'setup' || frame.stage === 'ignition';
          if (isPlayOrSetup) {
            this.renderer.drawFrame(
              frame,
              this.currentInputs,
              !this.timeline.isPlaying,
              this.shotHistory
            );
          }
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private updateGlowingBorders(frame: ShotFrame) {
    const cutawayCard = document.querySelector('.cutaway-card') as HTMLDivElement;
    const trajectoryCard = document.querySelector('.trajectory-card') as HTMLDivElement;
    if (!cutawayCard || !trajectoryCard) return;

    cutawayCard.classList.remove('glow-setup', 'glow-pressure', 'glow-rupture');
    trajectoryCard.classList.remove('glow-setup', 'glow-pressure', 'glow-rupture');

    const stage = frame.stage;
    const isRuptured = frame.warnings.some(w => w.toLowerCase().includes('failed') || w.toLowerCase().includes('rupture'));

    if (isRuptured) {
      cutawayCard.classList.add('glow-rupture');
      trajectoryCard.classList.add('glow-rupture');
    } else if (stage === 'setup' || stage === 'ignition') {
      cutawayCard.classList.add('glow-setup');
      trajectoryCard.classList.add('glow-setup');
    } else if (stage === 'pressure' || stage === 'movement' || stage === 'flight') {
      cutawayCard.classList.add('glow-pressure');
      trajectoryCard.classList.add('glow-pressure');
    }
  }
}

// Start app on load
window.addEventListener('DOMContentLoaded', () => {
  new LaboratoryApp();
});
