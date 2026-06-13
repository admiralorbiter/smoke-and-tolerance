import { ShotInput } from '../types';
import { AudioManager } from '../audio/AudioManager';

export class ControlsPanel {
  private onFireCallback: (inputs: ShotInput) => void;
  private activeConfig: any = null;
  private isCustomMixActive: boolean = false;
  
  // Cache DOM elements
  private selectBarrel = document.getElementById('select-barrel') as HTMLSelectElement;
  private selectPropellant = document.getElementById('select-propellant') as HTMLSelectElement;
  private sliderRefinement = document.getElementById('slider-refinement') as HTMLInputElement;
  private valRefinement = document.getElementById('val-refinement') as HTMLSpanElement;
  private selectProjectile = document.getElementById('select-projectile') as HTMLSelectElement;
  private selectSealing = document.getElementById('select-sealing') as HTMLSelectElement;
  private btnFire = document.getElementById('btn-fire') as HTMLButtonElement;

  private sliderHumidity = document.getElementById('slider-humidity') as HTMLInputElement;
  private valHumidity = document.getElementById('val-humidity') as HTMLSpanElement;
  private sliderWind = document.getElementById('slider-wind') as HTMLInputElement;
  private valWind = document.getElementById('val-wind') as HTMLSpanElement;
  private sliderRain = document.getElementById('slider-rain') as HTMLInputElement;
  private valRain = document.getElementById('val-rain') as HTMLSpanElement;

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
      AudioManager.getInstance().updateAmbientWind(parseFloat(this.sliderWind.value));
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
      propellantType: "corned", // legacy placeholder
      refinementLevel: parseFloat(this.sliderRefinement.value),
      projectileType: this.selectProjectile.value,
      sealingQuality: this.selectSealing.value,
      weatherHumidity: parseFloat(this.sliderHumidity.value),
      weatherWind: parseFloat(this.sliderWind.value),
      weatherRain: parseFloat(this.sliderRain.value),
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

  public applyEraRestrictions(config: any) {
    this.activeConfig = config;

    // 1. Barrel Material
    this.restrictSelect(this.selectBarrel, config.allowedMetallurgies, config.defaultInputs.barrelMaterial);
    
    // 2. Propellant Profile
    this.restrictSelect(this.selectPropellant, config.allowedPropellants, config.defaultInputs.propellantProfile);
    
    // 3. Projectile Type
    this.restrictSelect(this.selectProjectile, config.allowedProjectiles, config.defaultInputs.projectileType);
    
    // 4. Sealing / Bore Packing
    this.restrictSelect(this.selectSealing, config.allowedWaddings, config.defaultInputs.sealingQuality);
    
    // 5. Refinement Slider
    const maxRef = config.maxSaltpeterRefinement;
    this.sliderRefinement.max = maxRef.toString();
    const curVal = parseFloat(this.sliderRefinement.value);
    if (curVal > maxRef) {
      this.sliderRefinement.value = maxRef.toString();
      this.valRefinement.textContent = `${maxRef}%`;
    }
    
    // Add/remove a lock message for the refinement slider
    const container = this.sliderRefinement.closest('.control-group');
    if (container) {
      let info = container.querySelector('.control-locked-info');
      if (maxRef < 100) {
        if (!info) {
          info = document.createElement('span');
          info.className = 'control-locked-info';
          container.appendChild(info);
        }
        info.textContent = `🜂 Max refinement limited to ${maxRef}% in this Era`;
      } else if (info) {
        info.remove();
      }
    }

    this.updateWeatherLocks();
  }

  private updateWeatherLocks() {
    if (!this.activeConfig) return;

    // 6. Weather locks (Option C) - unlock in custom mix (free-play)
    const hasLocks = this.activeConfig.lockedHumidity !== undefined && !this.isCustomMixActive;
    [
      { slider: this.sliderHumidity, valText: this.valHumidity, value: this.activeConfig.lockedHumidity },
      { slider: this.sliderWind, valText: this.valWind, value: this.activeConfig.lockedWind },
      { slider: this.sliderRain, valText: this.valRain, value: this.activeConfig.lockedRain }
    ].forEach(({ slider, valText, value }) => {
      if (hasLocks && value !== undefined) {
        slider.disabled = true;
        slider.value = value.toString();
        valText.textContent = `${value}%`;
        
        const container = slider.closest('.control-group');
        if (container && !container.querySelector('.control-locked-info')) {
          const info = document.createElement('span');
          info.className = 'control-locked-info';
          container.appendChild(info);
        }
        if (container) {
          const info = container.querySelector('.control-locked-info');
          if (info) info.textContent = `🜂 Locked for Codex Challenge`;
        }
      } else {
        slider.disabled = false;
        const container = slider.closest('.control-group');
        container?.querySelector('.control-locked-info')?.remove();
      }
    });
  }

  private restrictSelect(select: HTMLSelectElement, allowed: string[], defaultValue: string) {
    let anyDisabled = false;
    Array.from(select.options).forEach((opt: HTMLOptionElement) => {
      const isAllowed = allowed.includes(opt.value);
      opt.disabled = !isAllowed;
      if (!isAllowed) {
        anyDisabled = true;
      }
    });

    // If active selection is disabled, fallback to default value
    if (select.selectedOptions.length > 0 && select.selectedOptions[0].disabled) {
      select.value = defaultValue;
    }

    // Add lock note if options are fully locked down to exactly 1 choice
    const container = select.closest('.control-group');
    if (container) {
      let info = container.querySelector('.control-locked-info');
      if (anyDisabled && allowed.length === 1) {
        if (!info) {
          info = document.createElement('span');
          info.className = 'control-locked-info';
          container.appendChild(info);
        }
        info.textContent = `🜂 Locked option: ${this.getFriendlyName(defaultValue)}`;
      } else if (info) {
        info.remove();
      }
    }
  }

  private getFriendlyName(key: string): string {
    const map: Record<string, string> = {
      bamboo: 'Bamboo Tube',
      wrought_iron: 'Wrought Iron Staves',
      cast_bronze: 'Cast Bronze',
      uneven: 'Uneven Serpentine Mix',
      fast_then_weak: 'Quick-Burning Granular',
      steady: 'Purified Alchemical Spirit',
      slow_smoky: 'Charcoal Heavy Smut',
      damp_partial: 'Damp Spoiled Batch',
      none: 'None / Open Burn',
      lead_arrow: 'Lead Arrow-Bolt',
      pebbles: 'Pebble Spray',
      rough_stone: 'Rough Stone Sphere',
      lead_ball: 'Lead Ball',
      tow: 'Tow Packing',
      clay: 'Clay Plug'
    };
    return map[key] || key;
  }

  public setCustomMixActive(active: boolean) {
    this.isCustomMixActive = active;
    this.selectPropellant.disabled = active;
    this.sliderRefinement.disabled = active;
    
    const propContainer = this.selectPropellant.closest('.control-group');
    const refContainer = this.sliderRefinement.closest('.control-group');

    if (active) {
      if (propContainer && !propContainer.querySelector('.control-custom-warning')) {
        const warn = document.createElement('span');
        warn.className = 'control-custom-warning';
        warn.textContent = '🧪 Custom alchemical mix active';
        propContainer.appendChild(warn);
      }
      if (refContainer && !refContainer.querySelector('.control-custom-warning')) {
        const warn = document.createElement('span');
        warn.className = 'control-custom-warning';
        warn.textContent = '🧪 Custom alchemical mix active';
        refContainer.appendChild(warn);
      }
    } else {
      propContainer?.querySelector('.control-custom-warning')?.remove();
      refContainer?.querySelector('.control-custom-warning')?.remove();
    }

    this.updateWeatherLocks();
  }

  public setBarrelMaterial(material: string) {
    this.selectBarrel.value = material;
    this.selectBarrel.dispatchEvent(new Event('change'));
  }
}

