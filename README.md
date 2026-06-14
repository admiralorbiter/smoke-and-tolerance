# Smoke & Tolerance

*A historical simulation-lab game about early firearm systems, unreliable materials, messy chemistry, and the surprising complexity of making one shot work.*

---

## Overview

**Smoke & Tolerance** is an educational simulation game where players experiment with early gunpowder devices in a safe, abstracted laboratory environment. 

Rather than treating early firearms as finished weapons, this game explores them as unstable systems made from imperfect materials and limited by manufacturing tolerances:
*   **Imperfect Metallurgy:** Explore how bamboo splits, welded wrought iron staves leak along welds, and bronze castings trap air bubbles.
*   **Cumulative Fatigue & Maintenance:** Track persistent elastic wear, plastic deformation, and moisture/acidic soot corrosion. Clean the bore and restore the structural integrity of your barrel in the workshop to avoid catastrophic ruptures.
*   **Interactive X-Ray Mode:** Toggle the alchemical lens overlay to inspect microscopic structural fissures, seams, and casting defects in real-time under stress.
*   **Variable Chemistry:** Contrast raw, slow-burning meal powder against granulated corned powder.
*   **Windage Clearance:** Observe how gas escapes around rough, hand-carved stone projectiles.
*   **Environmental Sensitivity:** Experience how wind, rain, and humidity delay ignition and foul the barrel.
*   **Alchemical Chemistry Ledger (Tabula Alchimica):** Monitor real-time reaction thermodynamics, Tria Prima proportions, and strict conservation of mass.
*   **Dynamic Audio Synthesis:** Hear telemetry-driven soundscapes in real-time, mapping weather wind, touch-hole sizzles, pressure leakage, and barrel stresses directly to custom Web Audio synthesis nodes.

---

## Core Loop

1.  **Select an Era:** Navigate the timeline bar at the top of the interface to choose a historical era from the 800s to the 1300s. Open the **Codex** tab to read the historical challenges, alchemical constraints, and progression milestones.
2.  **Configure the Lab:** Experiment with metallurgical barrel types, waddings, projectile types, and propellant profiles (restricted to historically authentic selections based on the active era).
3.  **Fire a Test Shot:** Run the physics-integrated Rust simulator.
4.  **Inspect the Cutaway:** Watch the 2D cutaway animation showing pressure glows, stress coloration, and gas leakage streams (or enable X-Ray view to analyze internal micro-fissures and cracks).
5.  **Scrub the Timeline:** Step frame-by-frame through ignition, pressure buildup, projectile movement, muzzle flash, and flight ballistics.
6.  **Examine the Alchemical Ledger:** Toggle between **Instruments** (a Tria Prima ternary marker, Roman caloric pyrometer, and distillation alembic), **Ledger** (a conservation-of-mass balance table), and **Telemetry Charts** (interactive pressure, temperature, and mass plots synced with the timeline scrub).
7.  **Read the Diagnosis:** Learn from post-shot analysis cards describing the historical causes of misfires, jams, and ruptures.
8.  **Maintain the Barrel:** Clear soot residue via the clean bore tool to halt corrosion, and forge, re-cast, or splice the barrel in the workshop to repair persistent fatigue.

---

## Safety and Scope

This project is designed solely for historical education. All variables are normalized, abstracted, and qualitative. It does **not** teach real-world weapon construction, usable propellant recipes, load quantities, or instructions for operating explosives.

---

## Technical Guides

*   For local setup, compilation, project file structures, and physics/metallurgical equations, see the developer guide:
    👉 **[DEV.md](file:///c:/Users/admir/Github/smoke-and-tolerance/DEV.md)**
*   For specific simulation slider configurations to test happy paths, explosions, and jams:
    👉 **[docs/smoke_and_tolerance_research_design_brief.md](file:///c:/Users/admir/Github/smoke-and-tolerance/docs/smoke_and_tolerance_research_design_brief.md)**
