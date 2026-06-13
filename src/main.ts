import init, { simulate_shot } from './wasm/pkg/sim';
import { ShotInput, ShotResult, DiagnosisEntry } from './types';
import { CutawayRenderer } from './render/CutawayRenderer';
import { ControlsPanel } from './ui/ControlsPanel';
import { Timeline } from './ui/Timeline';

class LaboratoryApp {
  private renderer!: CutawayRenderer;
  private controls!: ControlsPanel;
  private timeline!: Timeline;

  private currentInputs: ShotInput | null = null;

  constructor() {
    this.initApp();
  }

  private async initApp() {
    // 1. Initialize the WebAssembly module
    try {
      await init();
      console.log('Smoke & Tolerance WASM simulator initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize simulation WASM:', err);
      document.getElementById('diag-summary')!.textContent = 
        'Error: WebAssembly module failed to initialize. Please check console logs.';
      return;
    }

    // 2. Instantiate Components
    this.renderer = new CutawayRenderer('sim-canvas');
    this.renderer.clear();

    this.controls = new ControlsPanel((inputs) => this.handleFireShot(inputs));

    this.timeline = new Timeline(
      (frame) => {
        if (this.currentInputs) {
          this.renderer.drawFrame(
            frame,
            this.currentInputs.barrelMaterial,
            this.currentInputs.projectileType,
            this.currentInputs.sealingQuality
          );
        }
      },
      () => {
        // Clean soot callback
        this.renderer.setSootLevel(0);
        // If we have a current shot, re-render the first frame to show clean bore
        this.handleFireShot(this.controls.getInputs());
      }
    );

    // Run an initial blank shot to show the static device in setup
    this.handleFireShot(this.controls.getInputs());
  }

  private handleFireShot(inputs: ShotInput) {
    this.currentInputs = inputs;
    this.controls.setFiringState(true);

    try {
      // Execute simulator in WASM
      const result: ShotResult = simulate_shot(inputs) as any;
      
      // Update timeline with new frames and play
      this.timeline.setFrames(result.frames);
      this.timeline.play();

      // Render diagnosis summary and cards
      this.updateDiagnosisPanel(result);
    } catch (err) {
      console.error('Simulation execution failed:', err);
    } finally {
      this.controls.setFiringState(false);
    }
  }

  private updateDiagnosisPanel(result: ShotResult) {
    const summaryEl = document.getElementById('diag-summary') as HTMLDivElement;
    const cardsEl = document.getElementById('diag-cards') as HTMLDivElement;

    summaryEl.textContent = result.summary;
    cardsEl.innerHTML = ''; // clear previous cards

    if (result.diagnosis.length === 0) {
      cardsEl.innerHTML = '<div style="font-style: italic; color: #a8947b; font-size: 0.85rem;">No warnings or anomalies reported.</div>';
      return;
    }

    result.diagnosis.forEach((card: DiagnosisEntry) => {
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
}

// Start app on load
window.addEventListener('DOMContentLoaded', () => {
  new LaboratoryApp();
});
