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
        
        // Extract updated fouling state from final frame (if not initial dummy shot)
        if (!this.isInitialLoad && frames.length > 0) {
          this.persistentFouling = frames[frames.length - 1].foulingIndex;
          this.updateFoulingMeter();
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


    // Initialize with hand_cannon defaults
    this.activeEra = 'hand_cannon';
    const activeConfig = ERA_REGISTRY[this.activeEra];
    this.controls.applyEraRestrictions(activeConfig);
    this.updateCodexPanel(activeConfig);

    // Run an initial blank shot to show the static device in setup
    this.handleInitialState();
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
    inputs.weatherProtection = this.activeWeatherProtection;
    if (this.customMixActive) {
      inputs.customMixActive = true;
      inputs.alchemicalMix = this.customAlchemicalMix;
    }
    this.currentInputs = inputs;
    this.controls.setFiringState(true);
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

  private renderCharts(frames: ShotFrame[], currentIndex: number, history: Array<{ inputs: ShotInput; frames: ShotFrame[] }> = []) {
    const canvas = document.getElementById('chem-charts-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background to match card panel theme
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, w, h);

    if (frames.length === 0) return;

    // Grid coordinates layout
    const paddingLeft = 45;
    const spacing = 35;
    const plotW = 220;
    const plotH = 150;
    const plotY = 50;

    interface ChartPlot {
      title: string;
      color: string;
      valKey?: keyof ShotFrame;
      maxVal: number;
      unit: string;
      isMass: boolean;
    }

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

    const plots: ChartPlot[] = [
      {
        title: 'PRESSURE (MPa)',
        color: '#d94e34',
        valKey: 'pressure',
        maxVal: Math.max(30.0, Math.ceil((maxPressure * 1.1) / 5) * 5),
        unit: 'MPa',
        isMass: false
      },
      {
        title: 'TEMPERATURE (K)',
        color: '#ffb703',
        valKey: 'temperature',
        maxVal: Math.max(2500.0, Math.ceil((maxTemp * 1.05) / 100) * 100),
        unit: 'K',
        isMass: false
      },
      {
        title: 'MASS BUDGET (g)',
        color: '#e6c387',
        maxVal: 15.0,
        unit: 'g',
        isMass: true
      }
    ];

    plots.forEach((plot, pIdx) => {
      const plotX = paddingLeft + pIdx * (plotW + spacing);

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

      // Subplot title
      ctx.fillStyle = '#bca085';
      ctx.font = 'normal 9px Cinzel, serif';
      ctx.fillText(plot.title, plotX, plotY - 8);

      // Subplot boundary readouts
      ctx.fillStyle = '#5c4b3c';
      ctx.font = 'normal 8px Share Tech Mono, monospace';
      ctx.fillText(plot.maxVal.toFixed(0) + plot.unit, plotX - 35, plotY + 6);
      ctx.fillText('0' + plot.unit, plotX - 22, plotY + plotH);

      // If no shot has been fired, skip drawing telemetry lines and scrub bars
      if (!this.hasFiredShot) {
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
          // Scale opacity down for older history entries (decay effect)
          const lineOpacity = Math.max(0.04, 0.45 * Math.pow(0.5, d));
          const gasLineOpacity = Math.max(0.04, 0.45 * Math.pow(0.5, d));

          ctx.save();
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          
          ctx.beginPath();
          histItem.frames.forEach((frame, idx) => {
            const x = plotX + (idx / (histItem.frames.length - 1)) * plotW;
            if (plot.isMass) {
              const mUnburned = frame.unburnedMass * 1000;
              const y = plotY + plotH - (mUnburned / plot.maxVal) * plotH;
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            } else {
              const val = frame[plot.valKey!] as number;
              const y = plotY + plotH - (val / plot.maxVal) * plotH;
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          });
          ctx.strokeStyle = plot.isMass ? `rgba(168, 148, 123, ${lineOpacity})` : `rgba(${colorMap[plot.color] || '140, 118, 98'}, ${lineOpacity})`;
          ctx.stroke();

          // If mass plot, render chamber gas curve on top in muted gold dash
          if (plot.isMass) {
            ctx.beginPath();
            histItem.frames.forEach((frame, idx) => {
              const x = plotX + (idx / (histItem.frames.length - 1)) * plotW;
              const mGas = frame.gasMass * 1000;
              const y = plotY + plotH - (mGas / plot.maxVal) * plotH;
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
        if (plot.isMass) {
          // Draw unburned powder in gray
          const mUnburned = frame.unburnedMass * 1000; // grams
          const y = plotY + plotH - (mUnburned / plot.maxVal) * plotH;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        } else {
          const val = frame[plot.valKey!] as number;
          const y = plotY + plotH - (val / plot.maxVal) * plotH;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = plot.isMass ? '#a8947b' : plot.color;
      ctx.stroke();

      // If mass plot, render chamber gas curve on top in gold
      if (plot.isMass) {
        ctx.beginPath();
        frames.forEach((frame, idx) => {
          const x = plotX + (idx / (frames.length - 1)) * plotW;
          const mGas = frame.gasMass * 1000; // grams
          const y = plotY + plotH - (mGas / plot.maxVal) * plotH;
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

        if (plot.isMass) {
          const curPowder = curFrame.unburnedMass * 1000;
          const curGas = curFrame.gasMass * 1000;
          valText = `Powder: ${curPowder.toFixed(1)}g / Gas: ${curGas.toFixed(1)}g`;
          if (prevFrame) {
            const prevPowder = prevFrame.unburnedMass * 1000;
            const prevGas = prevFrame.gasMass * 1000;
            valText += ` (Prev Powder: ${prevPowder.toFixed(1)}g / Gas: ${prevGas.toFixed(1)}g)`;
          }
        } else {
          const val = curFrame[plot.valKey!] as number;
          valText = val.toFixed(1) + plot.unit;
          if (prevFrame) {
            const prevVal = prevFrame[plot.valKey!] as number;
            valText += ` (Prev: ${prevVal.toFixed(1)}${plot.unit})`;
          }
        }

        ctx.save();
        ctx.fillStyle = 'rgba(207, 168, 107, 0.9)';
        ctx.font = 'normal 8px Share Tech Mono, monospace';
        
        // Adjust alignment depending on right boundary to prevent visual clipping
        let textX = scrubX + 4;
        if (scrubX > plotX + plotW - 80) {
          ctx.textAlign = 'right';
          textX = scrubX - 4;
        } else {
          ctx.textAlign = 'left';
        }
        ctx.fillText(valText, textX, plotY + plotH - 5);
        ctx.restore();
      }
    });

    if (!this.hasFiredShot) {
      // Render centered overlay with awaiting alchemical message
      ctx.fillStyle = 'rgba(12, 10, 9, 0.8)';
      const fullGridWidth = plots.length * plotW + (plots.length - 1) * spacing;
      ctx.fillRect(paddingLeft, plotY, fullGridWidth, plotH);

      ctx.fillStyle = '#bca085';
      ctx.font = 'normal 11px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('🜔 AWAITING TEST FIRE... 🜔', paddingLeft + fullGridWidth / 2, plotY + plotH / 2 - 8);
      
      ctx.fillStyle = '#8f7762';
      ctx.font = 'normal 8px Share Tech Mono, monospace';
      ctx.fillText('LAUNCH THE DEVICE TO CAPTURE AND PLOT ACTIVE COMBUSTION TELEMETRY', paddingLeft + fullGridWidth / 2, plotY + plotH / 2 + 12);
      ctx.textAlign = 'left'; // restore default
      return;
    }

    // Subplot total duration label
    const totalTimeMs = frames[frames.length - 1].timeMs;
    ctx.fillStyle = '#5c4b3c';
    ctx.font = 'normal 9px Share Tech Mono, monospace';
    ctx.fillText(`Duration: ${totalTimeMs.toFixed(1)}ms`, w - 110, plotY + plotH + 15);
  }

  private switchEra(eraId: string) {
    if (this.activeEra === eraId) return;
    this.activeEra = eraId;

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
}

// Start app on load
window.addEventListener('DOMContentLoaded', () => {
  new LaboratoryApp();
});
