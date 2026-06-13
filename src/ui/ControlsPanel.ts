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
  private sliderHumidity = document.getElementById('slider-humidity') as HTMLInputElement;
  private valHumidity = document.getElementById('val-humidity') as HTMLSpanElement;
  private sliderWind = document.getElementById('slider-wind') as HTMLInputElement;
  private valWind = document.getElementById('val-wind') as HTMLSpanElement;
  private sliderRain = document.getElementById('slider-rain') as HTMLInputElement;
  private valRain = document.getElementById('val-rain') as HTMLSpanElement;
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

    this.sliderHumidity.addEventListener('input', () => {
      this.valHumidity.textContent = `${this.sliderHumidity.value}%`;
    });

    this.sliderWind.addEventListener('input', () => {
      this.valWind.textContent = `${this.sliderWind.value}%`;
    });

    this.sliderRain.addEventListener('input', () => {
      this.valRain.textContent = `${this.sliderRain.value}%`;
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
      propellantType: this.selectPropellant.value,
      refinementLevel: parseFloat(this.sliderRefinement.value),
      projectileType: this.selectProjectile.value,
      sealingQuality: this.selectSealing.value,
      weatherHumidity: parseFloat(this.sliderHumidity.value),
      weatherWind: parseFloat(this.sliderWind.value),
      weatherRain: parseFloat(this.sliderRain.value),
      seed: BigInt(Math.floor(Math.random() * 1000000)) as any, // wasm-bindgen handles u64 seed as BigInt
    };
  }

  public setFiringState(firing: boolean) {
    this.btnFire.disabled = firing;
    this.btnFire.textContent = firing ? 'SIMULATING...' : '🔥 FIRE TEST SHOT';
    this.btnFire.style.opacity = firing ? '0.6' : '1';
  }
}
