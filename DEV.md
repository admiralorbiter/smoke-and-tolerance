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
  │    ├── render/
  │    │    └── CutawayRenderer.ts # Canvas split-screen visual renderer
  │    ├── ui/
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
