# Smoke & Tolerance: Developer Guide

This document covers the technical structure, compilation pipeline, physical equations, and development workflows for the **Smoke & Tolerance** historical laboratory simulation.

---

## 🛠️ Prerequisites & Installation

Before running the application, make sure you have the following toolchains installed:

1.  **Node.js** (v18 or higher recommended)
2.  **Rust & Cargo** (v1.70 or higher recommended)
3.  **wasm-pack** (for compiling Rust to WebAssembly)
    ```bash
    cargo install wasm-pack
    ```

### Local Setup
1.  Clone the repository:
    ```bash
    git clone https://github.com/admiralorbiter/smoke-and-tolerance.git
    cd smoke-and-tolerance
    ```
2.  Install JavaScript dependencies:
    ```bash
    npm install
    ```

---

## 🚀 Running the App Locally

### 1. Compile the WASM simulator
Run the build script to compile the Rust library under `sim/` into JS/WASM bindings located at `src/wasm/pkg/`:
```bash
npm run build:wasm
```

### 2. Start the Vite Dev Server
```bash
npm run dev
```
By default, this launches Vite on:
🔗 **[http://localhost:3000/](http://localhost:3000/)** (or the next available port if port 3000 is occupied).

### 3. Production Build
To generate optimized production assets (under `dist/`):
```bash
npm run build
```

---

## 📁 Project Structure

```text
smoke-and-tolerance/
  ├── docs/                  # Historical brief and design notes
  ├── sim/                   # Rust Simulation Project
  │    ├── Cargo.toml        # Rust dependencies & package info
  │    └── src/
  │         ├── lib.rs       # WASM API entry point
  │         ├── shot.rs      # Main simulation time-step integration
  │         ├── barrel.rs    # Metallurgy & thick-walled stress equations
  │         └── diagnosis.rs # Diagnostic reporting cards
  ├── src/                   # TypeScript Frontend
  │    ├── audio/
  │    │    └── AudioManager.ts  # Web Audio dynamic sound synthesizer
  │    ├── render/
  │    │    └── CutawayRenderer.ts # Canvas split-screen visual renderer
  │    ├── ui/
  │    │    ├── ComparisonPanel.ts # Comparative diff calculations & HTML rendering
  │    │    ├── ControlsPanel.ts   # Input panel handlers
  │    │    └── Timeline.ts        # Playback & scrub stats manager
  │    ├── types.ts          # Shared TypeScript type definitions
  │    ├── index.css         # Parchment styling & dark color tokens
  │    └── main.ts           # App lifecycle entry point
  ├── index.html             # Entry HTML document
  ├── tsconfig.json          # TypeScript configuration
  ├── vite.config.ts         # Vite bundler server properties
  └── DEV.md                 # This file
```

---

## 🔬 Physics & Mathematics Reference

The Rust simulation uses discrete numerical integrations in `dt = 0.05` ms increments. Key physical laws implemented include:

### 1. Vieille's Law (Propellant Burning)
Granulated (corned) black powder burns faster under pressure:
$$r = a \cdot P^n$$
Where:
*   $r$: Burning rate in kg/ms.
*   $a$: Base rate scaled by saltpeter refinement purity.
*   $P$: Current chamber pressure.
*   $n = 0.5$ (pressure sensitivity coefficient).

### 2. Gas Leakage (Windage Clearance)
Gas escape velocity is calculated based on the clearance area gap between the projectile radius $r_p$ and the inner bore radius $r_i$:
$$\frac{dm_{leak}}{dt} = C_d \cdot A_{gap} \cdot \sqrt{P_{chamber}}$$
Where $C_d \approx 0.62$ is the gas discharge coefficient.

### 3. Nobel-Abel Equation of State
Gas pressure is computed by adjusting the volume for the molecular co-volume ($\eta \approx 0.001\text{ m}^3\text{/kg}$):
$$P_{chamber} = \frac{m_{gas} \cdot R \cdot T}{V_{chamber} - \eta \cdot m_{gas}}$$

### 4. Thick-Walled Hoop Stress (Lamé Equations)
Max stress at the inner radius of the barrel is calculated to check for plastic deformation and rupture thresholds:
$$\sigma_{\theta,max} = P_{chamber} \cdot \frac{r_o^2 + r_i^2}{r_o^2 - r_i^2} \cdot K_{flaw}$$
Where $K_{flaw}$ is a stress concentration multiplier determined by material voids (casting bubbles in bronze) or weld seams (wrought iron staves).

### 5. Thermodynamic Energy Solver
The temperature of the gas chamber is computed dynamically based on the conservation of internal energy:
$$E_{new} = E_{old} + dE_{added} - dE_{leak} - dW$$
Where:
*   $dE_{added} = dm_{generated} \cdot C_v \cdot T_{ignition}$ (energy added from powder combustion)
*   $dE_{leak} = dm_{leak} \cdot C_p \cdot T$ (enthalpy carried away by venting gas)
*   $dW = P \cdot A \cdot dx$ (work done moving the projectile)
*   $dQ_{lost} = h \cdot A_{bore} \cdot (T - 293.15) \cdot dt$ (convective heat loss to the barrel walls, where $h$ is Bronze > Iron > Bamboo)
*   $T_{new} = \frac{E_{new}}{m_{gas} \cdot C_v}$ (resulting chamber temperature)
*   $C_v \approx 718\text{ J/(kg}\cdot\text{K)}$, $C_p \approx 1005\text{ J/(kg}\cdot\text{K)}$, and $R = 287\text{ J/(kg}\cdot\text{K)}$.

### 6. Propellant Mass Conservation Ledger
The total charge ($m_{total} = 15.00\text{ g}$) is conserved perfectly across all phases of simulation:
$$m_{total} = m_{unburned} + m_{gas\_chamber} + m_{gas\_leaked} + m_{soot\_fouling} + m_{smoke\_ejected}$$
Where:
*   $m_{unburned}$: Remaining unburned solid powder.
*   $m_{gas\_chamber}$: Hot combustion gas trapped in the chamber.
*   $m_{gas\_leaked}$: Gas leaked out of windage gap and touch-hole.
*   $m_{soot\_fouling}$: Heavy solid ash residue adhering to the bore.
*   $m_{smoke\_ejected}$: Suspended carbon soot particles ejected into the air.

### 7. Custom Alchemical Formulation Mixer (Stoichiometry Overrides)
When the user locks in a custom batch, the standard propellant profiles are overridden in the Rust integrator using barycentric composition coordinates for Saltpeter ($S_p$), Charcoal ($C_c$), and Sulfur ($S_s$) summing to 100%:

*   **Burn Rate Multiplier ($M_{burn}$):**
    $$M_{burn} = M_{wood} \cdot P_{salt} \cdot S_{burn}$$
    Where $M_{wood}$ is the wood source scaling (Willow: 1.35, Alder: 1.0, Oak: 0.65), $P_{salt}$ is the Saltpeter purity fraction, and $S_{burn}$ scales with the absolute deviation ($\text{dev}$) from the ideal 75% / 15% / 10% ratio:
    $$S_{burn} = \max\left(0.15, 1.0 - 1.5 \cdot \text{dev}\right)$$
    *Note: If $S_p > 85\%$ or $S_p < 50\%$, $S_{burn}$ is further penalized due to oxygen imbalance.*

*   **Chemical Gas Yield ($Y_{gas}$):**
    $$Y_{gas} = 0.45 \cdot \min\left(1.0, \frac{S_p}{0.75}\right) \cdot \min\left(1.0, \frac{C_c}{0.15}\right) \cdot \max\left(0.2, 1.0 - 0.5 \cdot \text{dev}\right)$$

*   **Ignition Temperature ($T_{ignition}$):**
    $$T_{ignition} = \left[ 2400 \cdot \text{clamp}\left(0.5, 1.15, \frac{S_p}{0.75}\right) \cdot \max\left(0.3, 1.0 - 0.4 \cdot \text{dev}\right) \right] \cdot \left(1.0 - H_{hum} \cdot 0.15\right)$$
    Where $H_{hum}$ is the normalized ambient weather humidity.

*   **Soot Residue Fraction ($F_{soot}$):**
    $$F_{soot} = \text{clamp}\left(0.05, 0.60, 0.15 \cdot \frac{C_c}{0.15} \cdot W_{soot}\right)$$
    Where $W_{soot}$ is the wood soot factor (Willow: 0.4, Alder: 1.0, Oak: 2.0).

---


## 🜔 WASM Shared Memory Layout

To achieve zero-copy transfer speeds, the simulation results are packed into a flat `Float64Array` shared buffer. Each frame uses a stride of exactly **`STRIDE_COUNT = 20`** floats (160 bytes per frame).

The layout of the elements within the stride is:

| Index | Name | Type | Description |
| :---: | :--- | :--- | :--- |
| `0` | `t` | `f64` | Normalized step timer |
| `1` | `time_ms` | `f64` | Elapsed time in milliseconds |
| `2` | `projectile_x` | `f64` | Projectile position down the barrel (m) |
| `3` | `projectile_y` | `f64` | Projectile vertical drift/deviation (m) |
| `4` | `projectile_v` | `f64` | Projectile velocity (m/s) |
| `5` | `pressure` | `f64` | Chamber pressure (MPa) |
| `6` | `leakage` | `f64` | Instantaneous venting rate (kg/ms) |
| `7` | `barrel_stress` | `f64` | Maximum hoop stress on barrel walls (MPa) |
| `8` | `smoke` | `f64` | Cumulative smoke particles |
| `9` | `fouling` | `f64` | Bore soot buildup |
| `10` | `aim_offset` | `f64` | Projectile deviation at muzzle exit |
| `11` | `stage_code` | `f64` | Enum integer representation of current stage |
| `12` | `unburned_mass` | `f64` | Unburned solid powder mass (kg) |
| `13` | `gas_mass` | `f64` | Active gas mass in chamber (kg) |
| `14` | `temperature` | `f64` | Gas chamber temperature (K) |
| `15` | `grain_radius` | `f64` | Average powder grain radius (m) |
| `16` | `wall_heat_loss` | `f64` | Convective energy lost to barrel walls (J) |
| `17` | `fouling_index` | `f64` | Persistent fouling index (0-1) |
| `18` | `burn_profile_code` | `f64` | Burn profile ID code |
| `19` | `padding` | `f64` | Padding float for 64-bit boundary alignment |


---

## 🔬 Dynamic Audio Synthesis Reference

The frontend uses the **Web Audio API** to synthesize all laboratory sound effects dynamically in real-time, mapping physical simulation telemetry to audio nodes.

### 1. Ambient Wind (Weather Conditions)
Ambient wind is generated using white noise passed through a bandpass filter swept slowly by an LFO to model natural gusts:
*   **Filter Type:** Bandpass, \(Q = 1.5\)
*   **Cutoff Modulation:** \(350\text{ Hz} \pm 100\text{ Hz}\) (modulated by a \(0.15\text{ Hz}\) LFO)
*   **Gain Mapping:** \(G_{wind} = \frac{S_{wind}}{100} \cdot 0.15\), where \(S_{wind}\) is the weather wind slider speed.

### 2. Gas Leakage (Touch-hole & Windage Hiss)
Escaping gas produces a high-frequency whistle/hiss during the pressure build-up and projectile movement stages:
*   **Filter Type:** Bandpass, \(Q = 3.0\)
*   **Gain Automation:** \(G_{leak} = \min(0.25, L_{leak} \cdot 8.0)\)
*   **Frequency Automation:** \(f_c = 3000\text{ Hz} + \min(4000\text{ Hz}, L_{leak} \cdot 80000)\), where \(L_{leak}\) is the instantaneous venting leakage rate in kg/ms.

### 3. Bore Friction (Projectile Scraping)
Friction is synthesized dynamically during the projectile movement stage, blending triangle wave metal oscillations with low-pass filtered noise:
*   **Oscillator Pitch:** \(f_{osc} = 90\text{ Hz} + \min\left(1.0, \frac{v}{100.0}\right) \cdot 250\text{ Hz}\), where \(v\) is the projectile velocity.
*   **Resonance Jitter:** For rough stone projectiles, frequency is frequency-modulated by \(\pm 40\text{ Hz}\) to simulate rattling inside the bore.
*   **Gain Automation:** \(G_{scrape} = 0.05 + \min\left(1.0, \frac{v}{100.0}\right) \cdot 0.18\)

### 4. Muzzle Exit Blast
At muzzle exit, a low-frequency pressure sweep is mixed with a short crack of high-frequency white noise and saturation clipping:
*   **Boom Sweep:** Sine wave swept from \(140\text{ Hz} \cdot \text{scale}\) down to \(10\text{ Hz}\) over \(350\text{ ms}\) using an exponential ramp.
*   **Crack Burst:** White noise bandpass-filtered at \(1000\text{ Hz}\) decaying over \(90\text{ ms}\).
*   **Pressure Scaling:** \(\text{scale} = \min(1.5, \max(0.2, P_{peak} / 15.0))\) based on peak chamber pressure.

### 5. Metallurgical Resonances
Each barrel material rings at distinct modal frequencies:
*   **Cast Bronze:** Bank of 4 parallel sine oscillators (\(380\text{ Hz}\), \(570\text{ Hz}\), \(850\text{ Hz}\), \(1280\text{ Hz}\)) simulating bell harmonics with slow exponential decays.
*   **Wrought Iron:** Flat metallic thud using a \(180\text{ Hz}\) triangle wave decaying in \(250\text{ ms}\).
*   **Bamboo:** Short, high-gain wood snap using a \(260\text{ Hz}\) sine wave decaying in \(100\text{ ms}\).

### 6. Catastrophic Ruptures & Tinnitus
*   **Explosion:** Distorted white noise low-pass filtered at \(300\text{ Hz}\) decaying in \(1.2\text{ s}\).
*   **Tinnitus Tone:** Continuous \(4000\text{ Hz}\) sine wave fading out linearly over \(4\text{ seconds}\).


