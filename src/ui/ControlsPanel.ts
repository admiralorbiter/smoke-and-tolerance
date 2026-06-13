import { ShotInput } from '../types';

export class ControlsPanel {
  private onFireCallback: (inputs: ShotInput) => void;
  
  // Cache DOM elements
  private selectBarrel = document.getElementById('select-barrel') as HTMLSelectElement;
  private selectPropellant = document.getElementById('select-propellant') as HTMLSelectElement;
  private sliderRefinement = document.getElementById('slider-refinement') as HTMLInputElement;
  private valRefinement = document.getElementById('val-refinement') as HTMLSpanElement;
  private selectProjectile = document.getElementById('select-projectile') as HTMLSelectElement;
  private selectSealing = document.getElementById('select-sealing') as HTMLSelectElement;
  private btnFire = document.getElementById('btn-fire') as HTMLButtonElement;

  constructor(onFire: (inputs: ShotInput) => void) {
    this.onFireCallback = onFire;
    this.initEventListeners();
  }

  private initEventListeners() {
    // Sync slider value text readouts
    this.sliderRefinement.addEventListener('input', () => {
      this.valRefinement.textContent = `${this.sliderRefinement.value}%`;
    });

    // Handle Fire click
    this.btnFire.addEventListener('click', () => {
      const inputs = this.getInputs();
      this.onFireCallback(inputs);
    });
  }

  public getInputs(): ShotInput {
    return {
      barrelMaterial: this.selectBarrel.value,
      propellantType: "corned", // legacy placeholder
      refinementLevel: parseFloat(this.sliderRefinement.value),
      projectileType: this.selectProjectile.value,
      sealingQuality: this.selectSealing.value,
      weatherHumidity: 0.0,
      weatherWind: 0.0,
      weatherRain: 0.0,
      primingQuality: 100.0,
      seed: BigInt(Math.floor(Math.random() * 1000000)) as any,
      persistentFouling: 0.0,
      propellantProfile: this.selectPropellant.value,
    };
  }

  public setFiringState(firing: boolean) {
    this.btnFire.disabled = firing;
    this.btnFire.style.opacity = firing ? '0.6' : '1';
    this.btnFire.textContent = firing ? 'SIMULATING...' : '🔥 FIRE TEST SHOT';
  }
}
