# Smoke & Tolerance

*A historical simulation-lab game about early firearm systems, unreliable materials, messy chemistry, and the surprising complexity of making one shot work.*

## Overview

**Smoke & Tolerance** is a proof-of-concept simulation game where players experiment with early firearm-like devices in a safe, abstracted, educational environment.

The goal is not to create a weapon-building tool. The goal is to make invisible systems visible: ignition reliability, barrel quality, projectile fit, fouling, weather, operator steadiness, and material inconsistency.

The first prototype focuses on a simplified early hand-cannon-style device shown in 2D cutaway. Players adjust high-level variables, fire a test shot, watch the internal simulation, and receive a readable diagnosis of what happened.

## Design Pillars

### 1. Make invisible causes visible

The game should help players understand that a shot is the result of many interacting systems:

- ignition timing
- propellant condition
- pressure development
- projectile fit
- barrel imperfections
- material stress
- fouling
- weather
- operator movement

### 2. Historical flavor, not weapon instruction

The game is about historical systems thinking, craft limits, materials, and experimental diagnosis.

### 3. The player is an experimenter

The core fantasy is not “be the best shooter.”

The core fantasy is:

> “Why did this shot behave the way it did?”

Players should learn by changing one variable, running a test, comparing outcomes, and inspecting the simulation timeline.

## Initial Prototype Scope

The first proof of concept should include:

- a 2D cutaway barrel view
- a simple early firearm-inspired test device
- sliders for simulation variables
- a “Fire” button
- a replayable shot timeline
- pressure, leakage, stress, and fouling visualization
- a target impact result
- a diagnosis panel

## Initial Player Controls

The first version should expose only a few high-level variables:

| Variable | Meaning |
|---|---|
| Propellant condition | How reliable and energetic the abstract propellant batch is |
| Projectile fit | How well the projectile seals in the barrel |
| Barrel quality | How straight, smooth, and structurally sound the barrel is |
| Humidity | How environmental moisture affects ignition and reaction quality |
| Operator steadiness | How much human movement affects the shot |

## Core Loop

1. Configure the test device.
2. Fire a shot.
3. Watch the cutaway simulation.
4. Scrub through the shot timeline.
5. Read the diagnosis.
6. Adjust one variable.
7. Try again.

## Simulation Output

The simulation should return a replayable list of frames:

The frontend should render these frames rather than calculating the simulation directly.

## Development Setup

Install JavaScript dependencies:

```bash
npm install
```

Install Rust WASM tools:

```bash
cargo install wasm-pack
cargo install cargo-watch
```

Run the app:

```bash
npm run dev
```

This should start:

- the Rust WASM watcher
- the Vite development server

## Possible Project Structure

```text
smoke-and-tolerance/
  README.md
  DEV.md
  package.json
  index.html
  vite.config.ts
  src/
    main.ts
    ui/
    render/
    state/
    wasm/
  sim/
    Cargo.toml
    src/
      lib.rs
      shot.rs
      barrel.rs
      material.rs
      rng.rs
```

## Early Milestones

### Milestone 1: Static Cutaway

- render a barrel
- render a projectile
- render basic labels
- add simple controls

### Milestone 2: Toy Shot Simulation

- Rust function accepts shot input
- Rust returns shot frames
- TypeScript renders projectile movement
- show pressure and stress values

### Milestone 3: Diagnosis Panel

- detect likely causes of failure
- explain shot behavior in plain language
- show “what changed from last shot”

### Milestone 4: Replay and Scrubbing

- pause shot playback
- scrub through time
- compare two shots side by side
