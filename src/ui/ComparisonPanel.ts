import { ShotInput, ShotFrame } from '../types';

export class ComparisonPanel {
  private container = document.getElementById('comparison-card') as HTMLDivElement;
  private summaryEl = document.getElementById('comp-summary') as HTMLDivElement;
  private inputsList = document.getElementById('comp-inputs-list') as HTMLUListElement;
  private outputsList = document.getElementById('comp-outputs-list') as HTMLUListElement;

  private formatMap: Record<string, string> = {
    // Barrel Metallurgy
    bamboo: 'Bamboo Tube',
    wrought_iron: 'Wrought Iron Staves',
    cast_bronze: 'Cast Bronze',
    
    // Propellant Profile
    uneven: 'Uneven Serpentine Mix',
    fast_then_weak: 'Quick-Burning Granular',
    steady: 'Purified Alchemical Spirit',
    slow_smoky: 'Charcoal-Heavy Smut',
    damp_partial: 'Damp Spoiled Batch',

    // Projectile Type
    lead_ball: 'Lead Ball',
    rough_stone: 'Rough Stone Sphere',
    lead_arrow: 'Lead Arrow-Bolt',
    pebbles: 'Pebble/Gravel Spray',

    // Sealing / Bore Packing
    none: 'None',
    tow: 'Tow Packing',
    clay: 'Clay Plug'
  };

  public hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  private getFriendlyName(key: string): string {
    return this.formatMap[key] || key;
  }

  public update(
    currentInput: ShotInput,
    currentFrames: ShotFrame[],
    prevInput: ShotInput | null,
    prevFrames: ShotFrame[] | null
  ) {
    if (!currentInput || !prevInput || currentFrames.length === 0 || !prevFrames || prevFrames.length === 0) {
      this.hide();
      return;
    }

    this.show();

    // 1. Generate alchemical summary description
    let summaryText = 'Analyzing alchemical changes against the previous laboratory run. ';
    const changedInputs: string[] = [];

    if (currentInput.barrelMaterial !== prevInput.barrelMaterial) {
      changedInputs.push('metallurgy');
    }
    if (currentInput.propellantProfile !== prevInput.propellantProfile) {
      changedInputs.push('propellant composition');
    }
    if (currentInput.refinementLevel !== prevInput.refinementLevel) {
      changedInputs.push('saltpeter purity');
    }
    if (currentInput.projectileType !== prevInput.projectileType) {
      changedInputs.push('projectile design');
    }
    if (currentInput.sealingQuality !== prevInput.sealingQuality) {
      changedInputs.push('bore seal tightness');
    }

    if (changedInputs.length > 0) {
      summaryText += `Altering the ${changedInputs.join(', ')} has shifted the physical equilibrium of the device.`;
    } else {
      summaryText += 'With identical inputs, the differences emerge purely from alchemical random fluctuations (RNG seed variance) and residual barrel soot.';
    }
    this.summaryEl.textContent = summaryText;

    // 2. Generate Input alterations list
    this.inputsList.innerHTML = '';
    
    this.addInputDiff('Barrel Metallurgy', prevInput.barrelMaterial, currentInput.barrelMaterial, true);
    this.addInputDiff('Propellant Profile', prevInput.propellantProfile, currentInput.propellantProfile, true);
    this.addInputDiff('Saltpeter Refinement', prevInput.refinementLevel, currentInput.refinementLevel, false, '%');
    this.addInputDiff('Projectile Type', prevInput.projectileType, currentInput.projectileType, true);
    this.addInputDiff('Bore Packing (Wadding)', prevInput.sealingQuality, currentInput.sealingQuality, true);

    if (this.inputsList.children.length === 0) {
      this.inputsList.innerHTML = '<li class="comp-item" style="color: var(--text-dim); font-style: italic;">No configurations changed.</li>';
    }

    // 3. Compute output peaks and deltas
    this.outputsList.innerHTML = '';

    const getPeak = (frames: ShotFrame[], key: 'pressure' | 'barrelStress' | 'projectileVelocity') => 
      frames.reduce((max, f) => Math.max(max, f[key]), 0);

    const getFinalFouling = (frames: ShotFrame[]) => 
      frames.length > 0 ? frames[frames.length - 1].foulingIndex : 0;

    const curPressure = getPeak(currentFrames, 'pressure');
    const prevPressure = getPeak(prevFrames, 'pressure');

    const curStress = getPeak(currentFrames, 'barrelStress');
    const prevStress = getPeak(prevFrames, 'barrelStress');

    const curVel = getPeak(currentFrames, 'projectileVelocity');
    const prevVel = getPeak(prevFrames, 'projectileVelocity');

    const curFouling = getFinalFouling(currentFrames);
    const prevFouling = getFinalFouling(prevFrames);

    // Add Output rows
    // Muzzle Velocity
    this.addOutputDiff(
      'Peak Muzzle Velocity',
      prevVel,
      curVel,
      ' m/s',
      (val) => val > 0, // positive direction is good (green)
      '▲', '▼'
    );

    // Chamber Pressure
    this.addOutputDiff(
      'Peak Chamber Pressure',
      prevPressure,
      curPressure,
      ' MPa',
      null, // neutral (grey)
      '▲', '▼'
    );

    // Hoop Stress
    this.addOutputDiff(
      'Peak Hoop Stress',
      prevStress,
      curStress,
      ' MPa',
      (val) => val < 0, // negative direction (decrease) is good (green)
      '▲', '▼'
    );

    // Bore Fouling
    this.addOutputDiff(
      'Persistent Fouling',
      prevFouling * 100,
      curFouling * 100,
      '%',
      (val) => val < 0, // negative direction (decrease) is good (green)
      '▲', '▼'
    );
  }

  private addInputDiff(label: string, prevVal: any, curVal: any, isFriendlyString: boolean, unit = '') {
    if (prevVal === curVal) return;

    const li = document.createElement('li');
    li.className = 'comp-item';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'comp-label';
    labelSpan.textContent = label;

    const valSpan = document.createElement('span');
    valSpan.className = 'comp-vals';

    const prevStr = isFriendlyString ? this.getFriendlyName(prevVal) : `${prevVal}${unit}`;
    const curStr = isFriendlyString ? this.getFriendlyName(curVal) : `${curVal}${unit}`;

    valSpan.innerHTML = `<span style="color: var(--text-dim);">${prevStr}</span> <span class="comp-val-change">➔</span> <span style="color: var(--text-ink); font-weight: bold;">${curStr}</span>`;

    li.appendChild(labelSpan);
    li.appendChild(valSpan);
    this.inputsList.appendChild(li);
  }

  private addOutputDiff(
    label: string,
    prevVal: number,
    curVal: number,
    unit: string,
    goodPredicate: ((delta: number) => boolean) | null,
    upArrow = '▲',
    downArrow = '▼'
  ) {
    const li = document.createElement('li');
    li.className = 'comp-item';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'comp-label';
    labelSpan.textContent = label;

    const valSpan = document.createElement('span');
    valSpan.className = 'comp-vals';

    const delta = curVal - prevVal;
    let pctText = '';
    let deltaClass = 'neutral';
    let arrow = '';

    if (Math.abs(prevVal) > 0.0001) {
      const pct = (delta / prevVal) * 100;
      pctText = ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
    }

    if (delta > 0.001) {
      arrow = `${upArrow} `;
      if (goodPredicate !== null) {
        deltaClass = goodPredicate(delta) ? 'plus' : 'minus';
      }
    } else if (delta < -0.001) {
      arrow = `${downArrow} `;
      if (goodPredicate !== null) {
        deltaClass = goodPredicate(delta) ? 'plus' : 'minus';
      }
    } else {
      arrow = '';
      deltaClass = 'neutral';
    }

    const curFormatted = curVal.toFixed(1);
    const prevFormatted = prevVal.toFixed(1);

    valSpan.innerHTML = `
      <span style="color: var(--text-dim);">${prevFormatted}${unit}</span>
      <span class="comp-val-change">➔</span>
      <span style="color: var(--text-ink); font-weight: bold;">${curFormatted}${unit}</span>
      <span class="delta-val ${deltaClass}">${arrow}${pctText}</span>
    `;

    li.appendChild(labelSpan);
    li.appendChild(valSpan);
    this.outputsList.appendChild(li);
  }
}
