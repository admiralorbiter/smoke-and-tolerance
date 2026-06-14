# Smoke & Tolerance

*A historical simulation-lab game about early firearm systems, unreliable materials, messy chemistry, and the surprising complexity of making one shot work.*

Version: 0.1 research/design brief  
Scope: 800s–1300s, from early gunpowder mixtures to early hand cannons and cannon depictions  
Safety rule: This document uses abstracted educational variables only. It avoids usable propellant formulas, dimensions, charges, loading procedures, or construction instructions.

---

## 1. Overview

**Smoke & Tolerance** is a proof-of-concept educational simulation game about the first centuries of gunpowder devices. It treats early firearms not as “finished weapons,” but as unstable systems made from imperfect materials, inconsistent craft methods, environmental uncertainty, and experimental trial-and-error.

The player is not trying to build a working weapon. The player is trying to understand why a historical gunpowder device behaved unpredictably.

The first prototype centers on a simplified early hand-cannon-inspired test device shown in 2D cutaway. Players adjust high-level variables, fire a test shot, watch an abstract internal simulation, and receive a readable diagnosis.

The core question is:

> Why did this shot behave the way it did?

---

## 2. Historical Thesis

Early firearms did not appear suddenly as recognizable guns. They developed through a sequence of experiments:

1. **Gunpowder as a strange energetic material**
2. **Gunpowder as an incendiary**
3. **Gunpowder attached to arrows or used in bombs**
4. **Gunpowder directed through tubes**
5. **Gunpowder used to expel flame, smoke, pellets, or debris**
6. **Gunpowder used inside stronger metal tubes to launch projectiles**
7. **Gunpowder artillery becoming a European and Eurasian military technology**

The game should help players feel this transition: early devices were part chemistry, part craft, part siege technology, part intimidation, and part dangerous experiment.

The key historical insight for gameplay is that early gunpowder systems were limited by **tolerance**:

- inconsistent energetic material
- inconsistent ignition
- poor seals around projectiles
- rough or flawed barrels
- weak or irregular metallurgy
- moisture sensitivity
- fouling after use
- operator uncertainty
- limited theory of pressure, recoil, and trajectory

The title **Smoke & Tolerance** points to both visible smoke and invisible manufacturing tolerances.

---

## 3. Historical Timeline: 800s–1300s

This timeline is intended for educational framing, level structure, flavor text, and unlockable simulation modules. Dates are approximate where the evidence is uncertain.

| Period | Development | Game interpretation |
|---|---|---|
| 800s | Early gunpowder-like mixtures emerge in China from alchemical experimentation. | “Energetic material” exists, but it is not yet a gun technology. Use it as a dangerous, unstable discovery. |
| 900s–1000s | Gunpowder is used mainly for fire, smoke, shock, and siege effects. | Introduce burn quality, ignition reliability, smoke, and fear effects before projectile physics. |
| 1044 | The *Wujing zongyao* records early military gunpowder knowledge and describes incendiary uses such as fire arrows and bombs. | Establish the first “documented lab manual” moment, but keep formulas abstracted. |
| 1000s–1100s | Fire arrows, bombs, mines, and fire-spurting lances appear in Song military contexts. | Add devices that are closer to fireworks, incendiaries, and siege tools than modern guns. |
| 1100s–1200s | Fire lances become important proto-firearms: tubes attached to spear-like weapons, producing flame and sometimes ejecting pellets or debris. | Introduce the tube as a directional energy system. |
| 1200s | Fire-lance and tube technologies evolve toward stronger barrels and projectile-emitting devices. Gunpowder weapons spread through warfare and exchange across Eurasia. | Introduce “barrel quality,” “leakage,” and “projectile fit.” |
| Late 1200s | Metal-barreled hand-cannon-like devices appear in China. The Heilongjiang hand cannon, dated no later than 1288, is often cited as the oldest confirmed surviving firearm. | Prototype focus: a simple tube, touch-hole ignition, variable pressure, and unreliable projectile behavior. |
| Early 1300s | European cannon references and illustrations appear, including the 1326–1327 Walter de Milemete manuscript image and 1326 Florentine records. | Expand from handheld/pole-mounted devices to artillery, bronze casting, recoil, and crew risk. |
| Mid-1300s | Cannon and bombards become more visible in European siege and battlefield contexts, though expensive, inaccurate, and dangerous. | Add logistics, cost, crew training, transport, and foundry quality. |

---

## 4. Device Family Tree

The game can present early firearms as a family tree rather than a single invention.

### 4.1 Alchemical and incendiary mixtures

**What they were:** Early energetic mixtures used for fire, smoke, and spectacle.

**What they looked like:** Powders or pastes stored in containers, packets, or prepared devices.

**Simulation role:** These introduce ignition reliability, humidity sensitivity, inconsistent burn quality, and danger from poorly understood materials.

---

### 4.2 Fire arrows

**What they were:** Arrows with attached incendiary packets or tubes.

**What they looked like:** Conventional arrows modified with a small burning package, wrapper, or tube near the arrowhead.

**Simulation role:** Fire arrows show that early gunpowder weapons were first about fire delivery, not ballistic power.

**Useful game mechanics:**

- ignition before launch
- burn duration
- chance of going out in damp weather
- arrow stability penalty from attached packet
- target ignition chance
- intimidation/smoke effect

**Educational message:** The first military uses of gunpowder were not “guns.” They were fire technologies.

---

### 4.3 Bombs, grenades, and mines

**What they were:** Containers of gunpowder mixtures used for incendiary, smoke, noise, or explosive effects in siege warfare.

**What they looked like:** Paper, bamboo, ceramic, or metal containers depending on period and design. Some were hurled by catapults or placed as mines.

**Simulation role:** Bomb devices introduce confinement, casing strength, fragmentation risk, and timing uncertainty.

**Useful game mechanics:**

- casing strength
- fuse reliability
- delay uncertainty
- scatter radius, represented abstractly
- intimidation effect
- malfunction or dud chance

---

### 4.4 Fire lances

**What they were:** Spear or polearm weapons with a gunpowder tube attached. Early versions blasted flame and smoke; later versions could eject pellets or debris.

**What they looked like:** A long spear or pole with a short tube fastened near the head. The tube might be bamboo, paper, or later metal.

**Simulation role:** Fire lances are the bridge between “burning device” and “firearm.” They introduce the idea of directing energy through a tube.

**Useful game mechanics:**

- tube integrity
- short effective range
- blast cone visualization
- pellet scatter, represented abstractly
- one-shot limitation
- melee fallback

**Educational message:** A firearm begins when the tube becomes more important than the spear.

---

### 4.5 Eruptors and early metal tubes

**What they were:** Transitional tube weapons using stronger barrels to direct blast and eject projectiles.

**What they looked like:** Short, thick tubes, sometimes lashed to poles or mounted on simple supports.

**Simulation role:** This is where the player starts to care about pressure, leakage, projectile fit, and tube strength.

**Useful game mechanics:**

- pressure rises unevenly
- loose projectile wastes energy through leakage
- tight projectile raises stress
- rough bore increases friction
- poor metal creates stress hotspots
- fouling changes later shots

**Educational message:** Stronger tubes allowed more force, but they also made failures more dangerous.

---

### 4.6 Hand cannons

**What they were:** Simple metal-barreled firearms, generally without triggers or lock mechanisms. Ignition came from a touch-hole using an external flame source.

**What they looked like:** Short, heavy bronze or iron tubes with a closed rear, open front, and a small ignition point. Some had sockets for poles or handles.

**Simulation role:** This is the ideal prototype device because it is mechanically simple but systemically rich.

**Useful game mechanics:**

- delayed ignition
- partial burn
- projectile seal
- barrel stress
- smoke and residue
- recoil disturbance
- aim instability
- target impact uncertainty

**Educational message:** Even one apparently simple shot involves many interacting systems.

---

### 4.7 Early cannon and bombards

**What they were:** Larger artillery pieces that appeared in Europe by the early 1300s and became increasingly important in siege warfare.

**What they looked like:** Short bronze or iron guns, often mounted on wooden stands, frames, cradles, or later carriages. Early manuscript images often show vase-like cannon firing large bolts or stones.

**Simulation role:** Larger cannon shift the problem from “can one person fire this?” to “can a workshop, crew, and logistics system make artillery reliable?”

**Useful game mechanics:**

- foundry quality
- transport difficulty
- crew coordination
- ammunition fit
- recoil management
- reload delay, represented abstractly
- cost and supply chain

**Educational message:** Early artillery was as much an industrial and logistical system as a battlefield device.

---

## 5. Design Pillars

### 5.1 Make invisible causes visible

The game should reveal hidden variables:

- ignition timing
- propellant condition
- pressure development
- projectile fit
- barrel imperfections
- material stress
- fouling
- weather
- operator movement

The player should be able to say:

> “The shot failed because humidity slowed ignition, the propellant reacted weakly, and the loose projectile leaked pressure.”

---

### 5.3 The player is an experimenter

The core fantasy is not:

> “I am a master shooter.”

The core fantasy is:

> “I am trying to understand a messy historical system.”

Players should learn by:

1. Changing one variable.
2. Running a test.
3. Comparing the shot timeline.
4. Reading the diagnosis.
5. Forming a hypothesis.
6. Trying again.

---

## 6. Prototype Scope

The first prototype should include:

- 2D cutaway barrel view
- simplified early hand-cannon-inspired test device
- high-level sliders
- “Fire” button
- replayable shot timeline
- pressure, leakage, stress, smoke, and fouling visualization
- target impact result
- diagnosis panel
- comparison against previous shot

The frontend should render frames returned from the Rust/WASM simulation rather than calculating the simulation directly.

---

## 7. Initial Player Controls & Discrete Selections

To support deeper historical modeling and eventual material sourcing mechanics, the controls represent discrete craft choices rather than generic 0-100 sliders.

### 7.1 Barrel Material
*   **Bamboo Tube:** High elasticity but very low absolute strength. Splitting occurs along fiber lines, venting pressure safely but ruining the device.
*   **Wrought Iron Staves:** Roll-welded staves bound with heated iron hoops. Prone to seam leakage and welds bursting under rapid pressure spikes.
*   **Cast Bronze:** Heavy and expensive, but structurally sound. Susceptible to casting voids (air pockets) that cause unexpected failure.

### 7.2 Propellant Formula & Processing
*   **Meal / Serpentine Powder:** Raw dry mix of charcoal, sulfur, and saltpeter. Highly inconsistent, burns slowly line-by-line, and components separate during travel.
*   **Corned / Granulated Powder:** Damp-pressed, dried, and crushed cakes. Burns almost instantly due to inter-grain spacing, raising chamber pressure dramatically.
*   **Refinement Level:** Abstract purity of saltpeter. Determines burn speed and residue accumulation.

### 7.3 Projectile Type
*   **Lead Arrow-Bolt:** Fitted with a rear leather wrap or tow packing. Aerodynamic, predictable trajectory, and good gas seal.
*   **Pebble / Gravel Blast:** High scatter, low velocity, extreme muzzle spread. Renders as a blast cone of debris.
*   **Rough Stone Sphere:** Medium weight, irregular shape, and rough surface. High windage (gas leakage) and rattles inside the barrel.
*   **Lead Ball:** Heavy and malleable, creating a tighter seal (low windage) and high range.

### 7.4 Sealing / Bore Packing (Wadding)
*   **None:** High windage leakage. Weak velocity, massive soot blow-by, but very safe low peak pressure.
*   **Tow Packing:** Coarse flax/hemp fibers packed behind the projectile. Moderate gas seal, moderate starting friction.
*   **Clay Plug / Wood Wad:** Excellent gas seal. Spikes peak chamber pressure and starting friction, raising burst risks.

### 7.5 Environmental Weather
*   **Dry & Warm:** Ideal conditions. Consistent ignition and minimal fouling moisture.
*   **Humid / Foggy:** Introduces moisture to the powder charge, causing delayed ignition and incomplete combustion.
*   **Rainy:** High risk of priming powder wash-out or slow-match extinguishment.
*   **Windy:** Blows away loose priming powder, introducing ignition delay and shaking operator aim.

---

## 8. Simulation Stages

A shot can be modeled as a short sequence of stages.

### Stage 1: Setup

The simulation reads the player’s normalized inputs and seeds a random number generator.

Possible derived values:

- batch consistency
- spark acceptance
- initial bore friction
- seal quality
- hidden barrel flaw
- operator aim jitter
- humidity penalty

### Stage 2: Ignition attempt

Possible outcomes:

- clean ignition
- delayed ignition
- weak ignition
- failed ignition

Visualization:

- spark at touch-hole
- small glow spreading inward
- delay meter
- “uncertain ignition” warning

### Stage 3: Pressure development

Possible outcomes:

- pressure builds smoothly
- pressure builds too slowly
- pressure escapes around projectile
- pressure spikes early
- pressure collapses due to leakage or weak reaction

Visualization:

- pressure glow behind projectile
- smoke opacity
- pressure graph
- leakage wisps around projectile

### Stage 4: Projectile movement

Possible outcomes:

- projectile accelerates
- projectile moves sluggishly
- projectile rattles due to poor fit
- projectile sticks briefly
- projectile exits unstable

Visualization:

- projectile position
- velocity trail
- friction sparks or drag marks
- wobble indicator

### Stage 5: Barrel stress

Possible outcomes:

- normal stress
- stress concentration
- dangerous stress warning
- simulated rupture event, represented symbolically and non-instructively

Visualization:

- stress heatmap
- pulsing crack warning
- “test device damaged” state

### Stage 6: Muzzle exit

Possible outcomes:

- clean exit
- weak exit
- smoke-heavy exit
- unstable projectile exit
- no exit

Visualization:

- muzzle flash symbol
- smoke cloud
- projectile tumble icon
- timeline marker

### Stage 7: Flight and impact

Possible outcomes:

- impact near aim point
- low energy impact
- wide miss
- unstable impact
- no target impact

Visualization:

- abstract target
- impact marker
- confidence ring
- comparison to previous shot

### Stage 8: Fouling and aftermath

Possible outcomes:

- light fouling
- heavy fouling
- residue buildup
- device damage
- operator confidence loss

Visualization:

- residue inside barrel
- “next shot affected” warning
- post-shot diagnosis

---

## 9. Frame Data Model

The Rust simulation can return a replayable list of frames. The frontend renders these frames without recalculating physics.

```ts
export type ShotOutcome =
  | "misfire"
  | "delayed_ignition"
  | "weak_discharge"
  | "leakage_heavy"
  | "stress_warning"
  | "barrel_failure_symbolic"
  | "clean_exit"
  | "unstable_exit"
  | "target_hit"
  | "target_miss";

export interface AlchemicalMix {
  saltpeterRatio: number; // 0 - 100
  charcoalRatio: number;  // 0 - 100
  sulfurRatio: number;    // 0 - 100
  charcoalSource: 'willow' | 'alder' | 'oak';
  saltpeterPurity: number; // 0 - 100
  weatherProtection?: string;
}

export interface ShotInput {
  barrelMaterial: string;
  propellantType: string;
  refinementLevel: number;
  projectileType: string;
  sealingQuality: string;
  weatherHumidity: number;
  weatherWind: number;
  weatherRain: number;
  primingQuality: number;
  seed: bigint;
  weatherProtection?: string;
  persistentFouling: number;
  propellantProfile: string;
  customMixActive?: boolean;
  alchemicalMix?: AlchemicalMix;
  persistentFatigue: number;
  flawSeed: number;
  targetArmorType?: string;
  persistentTemperature?: number; // Kelvin
  isSwabbedWet?: boolean;
  touchholeErosion?: number;
}

export interface ShotFrame {
  t: number;
  timeMs: number;
  stage: string;
  projectileX: number;
  projectileY: number;
  projectileVelocity: number;
  pressure: number;
  leakage: number;
  barrelStress: number;
  smoke: number;
  fouling: number;
  aimOffset: number;
  warnings: string[];
  unburnedMass: number;
  gasMass: number;
  temperature: number;
  grainRadius: number;
  wallHeatLoss: number;
  foulingIndex: number;
  burnProfileCode: number;
  barrelFatigue: number;
  barrelTemperature: number;
  structuralStrengthPercent: number;
  touchholeRadiusCurrent: number;
}

export interface ShotResult {
  input: ShotInput;
  frames: ShotFrame[];
  outcomes: string[];
  diagnosis: DiagnosisEntry[];
  summary: string;
}

export interface DiagnosisEntry {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  explanation: string;
}
```

---

## 10. Diagnosis System

The diagnosis panel should explain outcomes in plain language.

### Example: Misfire

**Title:** Ignition failed  
**Likely causes:** High humidity, poor propellant condition  
**Explanation:** The ignition source did not reliably start the reaction. In early gunpowder systems, moisture and inconsistent material preparation could make ignition unreliable.

### Example: Delayed ignition

**Title:** Delayed ignition  
**Likely causes:** Humidity, weak propellant condition  
**Explanation:** The reaction started late. This creates uncertainty for the operator and can make the shot feel unpredictable.

### Example: Heavy leakage

**Title:** Pressure leaked around the projectile  
**Likely causes:** Loose projectile fit, rough barrel  
**Explanation:** A poor seal allowed energy to escape around the projectile instead of pushing it efficiently forward.

### Example: Stress warning

**Title:** Barrel stress exceeded the safe test threshold  
**Likely causes:** Tight projectile fit, barrel flaw, sudden pressure rise  
**Explanation:** Stronger tubes made more powerful shots possible, but they also concentrated force inside the barrel. Early metallurgy and casting flaws made this especially dangerous.

### Example: Unstable exit

**Title:** Projectile left the barrel unstably  
**Likely causes:** Barrel roughness, poor projectile fit, operator movement  
**Explanation:** The projectile exited with wobble, reducing accuracy and making the impact unpredictable.

---

## 11. Educational “Cause Cards”

After each shot, the game can show one or more cause cards.

### Cause Card: Humidity

Moisture makes ignition less reliable and can reduce the apparent strength of a propellant batch. In the simulation, humidity increases ignition delay, misfire chance, smoke, and residue.

### Cause Card: Leakage

Early firearms relied on a useful but difficult balance: the projectile needed to fit well enough to capture pressure, but not so tightly that it became stuck or overstressed the barrel.

### Cause Card: Barrel flaws

Early barrels could be rough, uneven, poorly welded, or imperfectly cast. Small flaws could create stress concentrations or unpredictable projectile motion.

### Cause Card: Fouling

A shot leaves residue behind. Even if the first shot works well, the next shot may behave differently because the barrel is no longer in the same condition.

### Cause Card: Human factors

Early gunpowder devices lacked modern triggers, sights, stocks, and standardized procedures. Operator movement and timing could strongly affect the shot.

---

## 12. Visual Design Notes

### 12.1 Overall look

The visual language should feel like a cross between:

- manuscript diagram
- workshop notebook
- cutaway science exhibit
- early engineering sketch

Avoid glamorizing weapons. The device should look like an experimental artifact, not a power fantasy object.

### 12.2 Cutaway barrel

The first prototype should render:

- barrel wall
- projectile
- rear chamber area, abstracted
- ignition point, abstracted
- pressure glow
- smoke
- leakage wisps
- stress coloration
- fouling residue

### 12.3 Timeline UI

The shot timeline can include markers:

- ignition attempt
- pressure rise
- first projectile movement
- peak stress
- muzzle exit
- target impact
- aftermath

Players should be able to scrub the timeline and see the barrel state at each moment.

### 12.4 Historical panel

Each device or era can include a short historical sidebar:

- “What historians think this looked like”
- “What problem this device tried to solve”
- “What was unreliable about it”
- “What changed in the next stage”

---

## 13. Era Modules

The full game could be structured as five educational modules.

### Module 1: Strange Fire, 800s–1000s

**Theme:** Gunpowder before guns  
**Player question:** Why is this material hard to control?  
**Mechanics:** ignition, smoke, burn consistency, humidity  
**Device focus:** abstract incendiary packet

### Module 2: Fire Delivered, 1000s–1100s

**Theme:** Arrows, bombs, and siege fire  
**Player question:** How do you deliver fire to a target?  
**Mechanics:** burn duration, carrier stability, fuse uncertainty  
**Device focus:** fire arrows and abstract siege devices

### Module 3: Directional Blast, 1100s–1200s

**Theme:** Fire lances and tubes  
**Player question:** What changes when blast is directed through a tube?  
**Mechanics:** cone effects, tube integrity, short range, one-shot behavior  
**Device focus:** fire lance

### Module 4: The Difficult Shot, late 1200s

**Theme:** Early hand-cannon-like devices  
**Player question:** Why is one shot so complicated?  
**Mechanics:** pressure, leakage, barrel stress, projectile fit, fouling  
**Device focus:** early hand cannon

### Module 5: Foundry and Siege, 1300s

**Theme:** Cannon as workshop and logistics system  
**Player question:** Why did cannon require more than battlefield courage?  
**Mechanics:** foundry quality, transport, crew timing, projectile fit, cost  
**Device focus:** early cannon and bombards

---

## 14. Initial Milestones

### Milestone 1: Static Cutaway

- render a simple barrel
- render a projectile
- render labels
- add sliders
- add a disabled timeline panel
- add historical sidebar placeholder

### Milestone 2: Toy Shot Simulation

- Rust/WASM function accepts `ShotInput`
- simulation returns `ShotResult`
- frontend renders projectile movement
- show pressure, leakage, and stress values
- support deterministic replay by seed

### Milestone 3: Diagnosis Panel

- detect likely causes of failure
- explain shot behavior in plain language
- list top 2–3 contributing factors
- show “what changed from last shot”

### Milestone 4: Replay and Scrubbing

- pause playback
- scrub through shot frames
- show stage markers
- compare current and previous shot

### Milestone 5: Historical Timeline Mode

- add selectable device era
- unlock historical sidebars
- show non-technical visual references
- compare “fire arrow,” “fire lance,” and “hand cannon” systems at a high level

---

## 15. Possible Project Structure

```text
smoke-and-tolerance/
  README.md
  DEV.md
  REFERENCES.md
  package.json
  index.html
  vite.config.ts

  src/
    main.ts
    ui/
      ControlsPanel.ts
      DiagnosisPanel.ts
      Timeline.ts
      HistoricalSidebar.ts
    render/
      CutawayRenderer.ts
      PressureLayer.ts
      StressLayer.ts
      SmokeLayer.ts
      TargetRenderer.ts
    state/
      shotStore.ts
      comparisonStore.ts
    wasm/
      index.ts

  sim/
    Cargo.toml
    src/
      lib.rs
      shot.rs
      barrel.rs
      material.rs
      diagnosis.rs
      rng.rs
```

---

## 16. README Draft

```md
# Smoke & Tolerance

Smoke & Tolerance is a historical simulation-lab game about early gunpowder devices and the surprising complexity of making one shot work.

The project focuses on systems thinking rather than weapon construction. Players adjust abstract variables such as propellant condition, projectile fit, barrel quality, humidity, and operator steadiness. The simulation returns a replayable shot timeline showing ignition, pressure, leakage, stress, fouling, and impact behavior.

## Safety and Scope

This project does not teach how to build or operate firearms, explosives, or propellants. All variables are normalized and fictionalized. The simulation is designed for historical education, not real-world performance.

## Prototype Goal

The first prototype renders a simplified early hand-cannon-inspired cutaway. Players fire test shots, scrub through a timeline, and read a diagnosis explaining what happened.

## Development

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
```

---

## 17. Reference Notes for the Game

Use these sources to guide historical flavor, visual references, and educational copy.

### Strong starting sources

1. **Asia for Educators / Columbia University — “Gunpowder” in Song Dynasty China**  
   Useful for: Wujing zongyao, fire arrows, bombs, mines, fire-spurting lances, Song military context.

2. **Walter de Milemete manuscript, Christ Church MS. 92, Oxford**  
   Useful for: 1326–1327 European cannon illustration, visual reference for early European artillery.

3. **Oxford Cabinet — “Firearms: the earliest European image, 1326–7”**  
   Useful for: early cannon image context, recoil, casting flaws, and danger to crews.

4. **The Metropolitan Museum of Art — Hand Cannon (Chong), China, 1424**  
   Useful for: later but visually clear example of the early hand-cannon family: simple tube, metal body, no modern mechanism.

5. **World History Encyclopedia — “Artillery in Medieval Europe”**  
   Useful for: early European cannon chronology, Florence 1326, Tower of London 1338, Crécy 1346, and early artillery limitations.

6. **Stephen Turnbull, The Medieval Cannon 1326–1494**  
   Useful for: early European cannon development, Milemete image, bronze vase-shaped guns, Loshult gun, and early manufacturing interpretation.

### Scholarly and book-length sources to consult

7. **Joseph Needham, Science and Civilisation in China, Vol. 5, Part 7: Military Technology: The Gunpowder Epic**  
   Useful for: deep history of Chinese gunpowder weapons, terminology, and evidence.

8. **Tonio Andrade, The Gunpowder Age: China, Military Innovation, and the Rise of the West in World History**  
   Useful for: broad Eurasian comparison and the military innovation context.

9. **Kenneth Chase, Firearms: A Global History to 1700**  
   Useful for: global spread and early firearms in China, the Islamic world, and Europe.

10. **Jack Kelly, Gunpowder: Alchemy, Bombards, and Pyrotechnics**  
    Useful for: readable narrative history of gunpowder’s movement from alchemy to artillery.

---

## 18. Research Findings & Historical Modeling

### 18.1 Weather and Priming Protection
For early hand cannons, priming was exposed at the top touch-hole, making rain, wind, and operator timing major factors:
*   **Evolution:** Top touch-hole (exposed) -> Side touch-hole with simple pan -> Matchlock with pan cover -> Wheellock/Flintlock.
*   **Game Model:** "Exposure window" mechanic. The longer the ignition sequence takes (due to player timing or damp slow-match), the more opportunity wind and rain have to blow away or ruin the priming powder.

### 18.2 Projectile Irregularity & Windage
Stone shot was rarely perfectly spherical, causing severe windage (gas blowing past the ball):
*   **Effects:** A loose-fitting stone leaks gas, lowering muzzle velocity. It also rattles down the bore, exiting at a random angle (aim jitter). Rough stones cause localized friction scrapes.
*   **Game Model:** Separate *surface roughness*, *bore fit*, and *shape regularity* variables. Irregular stones have fluctuating drag in flight and unpredictable exit angles.

### 18.3 Sealing (Wadding)
 sealiing aids were essential to prevent gas blow-by:
*   **Evolution:** Early arrow cannons used leather sleeves around the bolt. Large siege artillery used packed clay/wood plugs. Later small arms used paper patches/cloth wads.
*   **Game Model:** "Bore Packing Quality". No packing leads to heavy smoke/soot leakage and low speed. Clay or tight wood seals pressure efficiently but raises starting friction and stress levels.

---

## 19. Future Feature Concepts (Post-Prototype)

These four premium features have been identified as high-value extensions for future development cycles:

### 19.1 Web Audio API Dynamic Sound Synthesizer
Early gunpowder devices were notorious not just for their power, but for their terrifying acoustic presence. Instead of playing static audio files, this system dynamically synthesizes blast sounds in the browser based on simulation telemetry:
*   **The Blast Boom:** Audio wave shape, volume, and low-frequency resonance scale with peak chamber pressure ($P$) and gas mass ($m_{gas}$).
*   **The Material Resonance Ring:** Bronze barrels ring like cast bells (sine waves at metal resonant frequencies with slow decay); iron barrels produce clashing metallic thuds; bamboo produces sharp, wood-splintering cracks.
*   **The Leakage Hiss:** Escape of gas past the projectile (windage clearance) and out the touch-hole creates a high-frequency white-noise hiss proportional to the venting leakage rate.
*   **The Structural Failure Snap:** Yield failures and explosive ruptures trigger a sudden transient spike followed by ripping acoustic noise.

### 19.2 Interactive Metallurgical X-Ray & Degradation View
Introduces physical barrel fatigue and micro-fractures to simulate the short operational lifespan of early cast and forged barrels:
*   **Fatigue Accumulation:** Every shot inflicts structural damage based on how close the peak hoop stress got to the material's yield strength.
*   **Degradation Overlay:** A structural cross-section overlay in the UI dynamically renders internal cracks forming inside the metal or bamboo walls.
*   **Gameplay Loop:** Players must decide whether to continue firing a stressed, micro-fractured barrel or clean/retire/re-forge it.

### 19.3 Target Impact Physics & Historical Armor Testing
Expands the target range visualizer into a full ballistic testing environment evaluating the mechanical efficiency of early projectile systems:
*   **Historical Target Materials:** Unlocks armor testing targets such as *Silk Lamellar*, *Woven Bamboo Shields*, *Oak Wood Planks*, or *Wrought Iron Plates*.
*   **Penetration Mechanics:** Computes projectile kinetic energy ($E_k = \frac{1}{2}mv^2$), sectional density, and impact energy transfer to calculate damage, fracture, and penetration depth.
*   **Deformation Animation:** Renders projectiles flattening (lead balls), shattering (stone pebbles), or penetrating and splintering the selected targets.

### 19.4 Alchemical Notebook & Manuscript Log (Progression)
Unifies player progression under an in-game alchemical manuscript log, rewarding exploration of safety limits and historical discoveries:
*   **Discovery Triggers:** Achievements unlock based on extreme simulation states (e.g., *Misfire under wet powder*, *Rupture of a bamboo tube*, *Muzzle velocity exceeding 150m/s*).
*   **Visual Manuscript Pages:** Features hand-drawn alchemical illustrations, woodcut aesthetic designs, and qualitative historical commentary from period treatises (e.g., *Wujing zongyao*).

---

## 20. Design Red Lines

To keep the project educational and safe, do not include:

- real propellant recipes
- ingredient proportions
- charge weights
- barrel dimensions intended for real use
- firing or loading instructions
- fuse construction
- explosive casing design
- real ballistic optimization
- troubleshooting advice for real devices

Use instead:

- fictionalized material labels
- normalized 0–100 inputs
- abstract pressure values
- symbolic stress visualization
- qualitative historical commentary
- non-realistic toy physics

---

## 21. One-Sentence Pitch

**Smoke & Tolerance** is a historical systems game where players discover that early firearms were not simple inventions, but fragile negotiations between chemistry, weather, craft, metallurgy, human timing, and chance.

