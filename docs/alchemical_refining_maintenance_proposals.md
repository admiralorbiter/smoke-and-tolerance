# Future Feature Designs: Alchemical Refining & Interactive Maintenance

This document outlines the detailed specifications for two proposed modules to be integrated into **Smoke & Tolerance** in future updates.

---

## Module I: Interactive Alchemical Refining & Distillation

### 1. Conceptual Framework
In early gunpowder history, the quality of energetic materials was highly dependent on raw chemical purity. Instead of selecting predefined saltpeter refinement levels via a slider, players will run a thermodynamic crystallization and distillation process in the lab to yield high-purity **Nitrum** (Saltpeter) and distilled **Spirits of Wine** (Alcohol/Binder).

### 2. Mechanics & Chemistry Integration
* **Furnace Heat Balance:** The player manages a wood-fired furnace beneath an alembic or crucible. Bellows increase air flow (spiking temperature), vents release hot air (lowering temperature), and adding wood provides steady thermal energy.
* **The Purity Pyrometer:** The player must keep the temperature within the optimal alchemical range:
  * **Nitrum (Saltpeter) Crystallization:** Requires maintaining the temperature in the *Ignis Solis* range ($100^\circ\text{C}$ to $120^\circ\text{C}$ / ~373 K to 393 K). If it exceeds this range, calcium/sodium impurities re-dissolve into the mother liquor; if below, crystallization stalls.
  * **Spirits of Wine Distillation:** Distilling alcohol for powder corning requires maintaining a precise vapor temperature around $78^\circ\text{C}$ to $82^\circ\text{C}$ (~351 K to 355 K) to isolate the volatile spirits from water.
* **Stoichiometric Output:** The accuracy of the player's run yields a batch-specific purity coefficient ($P_{salt}$ from 0.5 to 1.0) and binder quality. These feed directly into the Rust solver's combustion burn rate ($M_{burn}$) and residue fraction ($F_{soot}$).

---

## Module II: Systemic Maintenance Trade-offs & Re-boring

### 1. Conceptual Framework
This module shifts cleaning and repairs from simple instant-reset buttons into strategic choices with physical consequences. Repairing one tolerance constraint (cracks) compromises another (windage gap).

### 2. Maintenance Actions & Mechanics
* **Water vs. Vinegar vs. Spirits Swabbing:**
  * **Water Swab:** Removes carbon fouling easily but leaves behind residual moisture. If fired immediately, it dampens the powder (adding 10–20 ms ignition delay or misfires).
  * **Vinegar Swab:** Highly effective at neutralizing alkaline sulfur deposits ($K_2S$), reducing corrosion fatigue, but accelerated chemical residue must be wiped dry to prevent barrel pitting.
  * **Spirits Swab:** Evaporates instantly (no moisture residue), but is expensive and has a minor flash risk if the barrel is hot.
* **Mechanical Re-boring (Lapping):**
  * Repeated shots cause micro-cracks and corrosion pitting, represented by `persistent_fatigue`. 
  * In the workshop, the player can bore out the barrel to scrape away these surface cracks, resetting fatigue to 0%.
  * **The Bore Expansion:** Re-boring increases the inner bore radius $r_i$ by a discrete increment (e.g., $+0.1\text{ mm}$).
  * **The Windage Windfall:** An increased $r_i$ widens the windage clearance gap:
    $$A_{gap} = \pi \left(r_i^2 - r_p^2\right)$$
    This causes severe gas blow-by (pressure drop, low velocity) *unless* the player goes to the casting furnace and casts new projectiles of matching larger radius ($r_p$) to fit the re-bored barrel.
