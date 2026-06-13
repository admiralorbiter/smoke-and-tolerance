import { ShotInput, ShotResultWasm, parseFramesFromBuffer, ShotFrame } from './types';
import { CutawayRenderer } from './render/CutawayRenderer';
import { ControlsPanel } from './ui/ControlsPanel';
import { Timeline } from './ui/Timeline';

class LaboratoryApp {
  private renderer!: CutawayRenderer;
  private controls!: ControlsPanel;
  private timeline!: Timeline;
  private worker!: Worker;

  private currentInputs: ShotInput | null = null;
  private isInitialLoad: boolean = true;
  private hasFiredShot: boolean = false;

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
        
        if (this.isInitialLoad) {
          this.isInitialLoad = false;
        } else {
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
    this.renderer = new CutawayRenderer('sim-canvas');
    this.renderer.clear();

    this.controls = new ControlsPanel((inputs) => this.handleFireShot(inputs));

    this.timeline = new Timeline(
      (frame, index, frames) => {
        this.lastRenderedFrameIndex = index;
        this.lastRenderedFrames = frames;

        if (this.currentInputs) {
          this.renderer.drawFrame(
            frame,
            this.currentInputs,
            !this.timeline.isPlaying
          );
          this.updateChemistryDashboard(frame, this.currentInputs);
          this.renderCharts(frames, index);
        }
      },
      () => {
        // Clean soot callback
        this.renderer.setSootLevel(0);
        // Refire current settings
        this.handleFireShot(this.controls.getInputs());
      }
    );

    // 3. Tab Navigation Event Listeners
    const tabBtnInstruments = document.getElementById('tab-btn-instruments');
    const tabBtnLedger = document.getElementById('tab-btn-ledger');
    const tabBtnCharts = document.getElementById('tab-btn-charts');

    const tabContentInstruments = document.getElementById('chem-tab-instruments');
    const tabContentLedger = document.getElementById('chem-tab-ledger');
    const tabContentCharts = document.getElementById('chem-tab-charts');

    const selectTab = (activeTab: 'instruments' | 'ledger' | 'charts') => {
      tabBtnInstruments?.classList.toggle('active', activeTab === 'instruments');
      tabBtnLedger?.classList.toggle('active', activeTab === 'ledger');
      tabBtnCharts?.classList.toggle('active', activeTab === 'charts');

      tabContentInstruments?.classList.toggle('active', activeTab === 'instruments');
      tabContentLedger?.classList.toggle('active', activeTab === 'ledger');
      tabContentCharts?.classList.toggle('active', activeTab === 'charts');

      if (activeTab === 'charts' && this.lastRenderedFrames.length > 0) {
        this.renderCharts(this.lastRenderedFrames, this.lastRenderedFrameIndex);
      }
    };

    tabBtnInstruments?.addEventListener('click', () => selectTab('instruments'));
    tabBtnLedger?.addEventListener('click', () => selectTab('ledger'));
    tabBtnCharts?.addEventListener('click', () => selectTab('charts'));

    // Run an initial blank shot to show the static device in setup
    this.handleInitialState();
  }

  private handleInitialState() {
    // We send a 100% priming quality dummy input to show static state on load
    const initialInputs = this.controls.getInputs();
    initialInputs.primingQuality = 100.0;
    this.currentInputs = initialInputs;
    this.worker.postMessage({ input: initialInputs });
  }

  private handleFireShot(inputs: ShotInput) {
    this.hasFiredShot = true;
    this.currentInputs = inputs;
    this.controls.setFiringState(true);
    inputs.primingQuality = 100.0;
    this.worker.postMessage({ input: inputs });
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
    const saltpeter = inputs.refinementLevel;
    const remaining = 100 - saltpeter;
    const charcoal = remaining * 0.6;
    const sulfur = remaining * 0.4;

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

  private renderCharts(frames: ShotFrame[], currentIndex: number) {
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

    const maxPressure = Math.max(...frames.map(f => f.pressure));
    const maxTemp = Math.max(...frames.map(f => f.temperature));

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

      // Render chart data line
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
        if (plot.isMass) {
          valText = `Powder: ${(curFrame.unburnedMass * 1000).toFixed(1)}g / Gas: ${(curFrame.gasMass * 1000).toFixed(1)}g`;
        } else {
          const val = curFrame[plot.valKey!] as number;
          valText = val.toFixed(1) + plot.unit;
        }
        ctx.fillStyle = 'rgba(207, 168, 107, 0.9)';
        ctx.font = 'normal 8px Share Tech Mono, monospace';
        ctx.fillText(valText, scrubX + 4, plotY + plotH - 5);
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
}

// Start app on load
window.addEventListener('DOMContentLoaded', () => {
  new LaboratoryApp();
});
