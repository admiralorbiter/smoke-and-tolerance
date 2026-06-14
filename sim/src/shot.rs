use crate::{ShotInput, ShotFrame, ShotResult};
use crate::barrel::BarrelProperties;
use crate::diagnosis;
use rand::prelude::*;
use rand_chacha::ChaCha8Rng;

pub fn run_simulation(input: ShotInput) -> ShotResult {
    // Initialize deterministic random number generator from seed
    let mut rng = ChaCha8Rng::seed_from_u64(input.seed);

    let barrel = BarrelProperties::get_by_name(&input.barrel_material, input.flaw_seed);

    let mut frames = Vec::new();
    let mut outcomes = Vec::new();
    let dt: f64 = 0.05; // ms step size

    // Physical dimensions & constants
    let barrel_length = 0.30; // 30 cm barrel length
    let bore_radius = barrel.r_inner;
    let bore_area = std::f64::consts::PI * bore_radius * bore_radius;
    let touchhole_radius = 0.001; // 1mm radius = 2mm diameter touchhole
    let touchhole_area = std::f64::consts::PI * touchhole_radius * touchhole_radius;

    // Projectile Setup
    let (proj_mass, proj_radius, drag_coeff, _is_arrow, _is_gravel, shape_regularity) = match input.projectile_type.as_str() {
        "none" => (0.001, 0.0, 1.0, false, false, 0.0),
        "lead_arrow" => (0.050, bore_radius - 0.0002, 0.15, true, false, 0.95),
        "pebbles" => (0.035, bore_radius - 0.0010, 1.10, false, true, 0.20),
        "rough_stone" => (0.080, bore_radius - 0.0015, 0.85, false, false, 0.40),
        "lead_ball" | _ => (0.120, bore_radius - 0.0003, 0.45, false, false, 0.90),
    };

    // Sealing effect on windage clearance
    let effective_proj_radius = match input.sealing_quality.as_str() {
        "none" => proj_radius,
        "tow" => (proj_radius + bore_radius) / 2.0, // halves the windage gap
        "clay" | _ => bore_radius,                   // eliminates windage gap (perfect seal)
    };
    
    // Windage gap area
    let gap_area = if effective_proj_radius >= bore_radius {
        0.0
    } else {
        std::f64::consts::PI * (bore_radius * bore_radius - effective_proj_radius * effective_proj_radius)
    };

    // weather parameters
    let wind_disturbance = input.weather_wind / 100.0;
    let humidity_slowdown = input.weather_humidity / 100.0;

    // Propellant consistency & burn profiles (made mutable for custom mix overrides)
    let (mut burn_profile_code, mut is_corned, mut initial_grain_r, mut burn_rate_mult, mut initial_gas_yield, is_damp) = match input.propellant_profile.as_str() {
        "uneven" => (0.0, false, 0.0, 1.0, 0.45, false),
        "fast_then_weak" => (1.0, true, 0.0006, 1.5, 0.45, false),
        "steady" => (2.0, true, 0.0012, 1.0, 0.45, false),
        "slow_smoky" => (3.0, false, 0.0, 0.5, 0.31, false),
        "damp_partial" | _ => (4.0, false, 0.0, 0.2, 0.225, true),
    };

    let custom_mix_active = input.custom_mix_active.unwrap_or(false);
    let saltpeter_ratio = input.saltpeter_ratio.unwrap_or(75.0) / 100.0;
    let charcoal_ratio = input.charcoal_ratio.unwrap_or(15.0) / 100.0;
    let sulfur_ratio = input.sulfur_ratio.unwrap_or(10.0) / 100.0;
    let saltpeter_purity = input.saltpeter_purity.unwrap_or(100.0) / 100.0;
    let charcoal_source = input.charcoal_source.clone().unwrap_or("alder".to_string());

    // Chemistry reaction kinetics parameters
    let mut temp_ignition = 2400.0 * (1.0 - humidity_slowdown * 0.15); // Peak temp in K

    if custom_mix_active {
        burn_profile_code = 5.0; // Custom alchemical code
        is_corned = input.propellant_profile == "steady" || input.propellant_profile == "fast_then_weak";
        initial_grain_r = if is_corned { 0.0012 } else { 0.0 };

        // Base charcoal source modifier
        let wood_mult = match charcoal_source.as_str() {
            "willow" => 1.35,
            "alder" => 1.0,
            "oak" | _ => 0.65,
        };
        
        // Stoichiometric deviation from 75/15/10
        let dev = (saltpeter_ratio - 0.75).abs() + (charcoal_ratio - 0.15).abs() + (sulfur_ratio - 0.10).abs();
        
        // Stoichiometry factor for burning speed
        let mut stoichiometry_burn = (1.0 - dev * 1.5).max(0.15);
        if saltpeter_ratio > 0.85 {
            stoichiometry_burn *= (1.0 - (saltpeter_ratio - 0.85) * 6.0).max(0.1);
        } else if saltpeter_ratio < 0.50 {
            stoichiometry_burn *= (saltpeter_ratio / 0.50).max(0.1);
        }

        burn_rate_mult = wood_mult * saltpeter_purity * stoichiometry_burn;
        // Apply profile multipliers
        if input.propellant_profile == "fast_then_weak" {
            burn_rate_mult *= 1.5;
        } else if input.propellant_profile == "slow_smoky" {
            burn_rate_mult *= 0.5;
        } else if input.propellant_profile == "damp_partial" {
            burn_rate_mult *= 0.2;
        }

        // Gas yield
        initial_gas_yield = 0.45 * (saltpeter_ratio / 0.75).min(1.0) * (charcoal_ratio / 0.15).min(1.0) * (1.0 - dev * 0.5).max(0.2);
        if input.propellant_profile == "slow_smoky" {
            initial_gas_yield *= 0.7;
        } else if input.propellant_profile == "damp_partial" {
            initial_gas_yield *= 0.5;
        }

        // Temperature
        let base_temp = 2400.0 * (saltpeter_ratio / 0.75).clamp(0.5, 1.15) * (1.0 - dev * 0.4).max(0.3);
        temp_ignition = base_temp * (1.0 - humidity_slowdown * 0.15);
    }

    let propellant_mass: f64 = 0.015; // 15 grams propellant charge
    let grain_density: f64 = 1700.0; // kg/m^3
    let grain_r0: f64 = initial_grain_r;
    let mut grain_r = grain_r0;
    let num_grains = if is_corned {
        let grain_volume = (4.0 / 3.0) * std::f64::consts::PI * grain_r0.powi(3);
        let grain_mass = grain_density * grain_volume;
        propellant_mass / grain_mass
    } else {
        0.0
    };

    // Frictional properties with persistent fouling scaling
    let base_static_friction = match input.sealing_quality.as_str() {
        "none" => 80.0,
        "tow" => 250.0,
        "clay" | _ => 750.0,
    };
    let static_friction_threshold = base_static_friction * (1.0 + input.persistent_fouling * 1.2);

    let dynamic_friction_coeff = match input.projectile_type.as_str() {
        "lead_arrow" => 0.12,
        "pebbles" => 0.28,
        "rough_stone" => 0.38,
        "lead_ball" | _ => 0.08,
    };

    // Convective wall heat cooling parameters
    let h_material = match input.barrel_material.as_str() {
        "cast_bronze" => 15000.0,
        "wrought_iron" => 8000.0,
        "bamboo" | _ => 1200.0,
    };
    let mut accumulated_heat_loss = 0.0;

    let mut unburned_mass: f64 = propellant_mass;
    let mut gas_mass: f64 = 0.0;
    let mut total_gas_leaked: f64 = 0.0;
    let mut total_soot_fouling: f64 = 0.0;
    let mut total_smoke_ejected: f64 = 0.0;
    let mut current_temp: f64 = 293.15; // room temp in K

    // Thermodynamic constants
    let cv = 1000.0; // J/(kg*K)
    let gamma = 1.22; // heat capacity ratio
    let cp = gamma * cv; // Cp in J/(kg*K)
    let mut chamber_energy: f64 = gas_mass * cv * current_temp;

    // 1. Calculate weather protection factors
    let weather_protection = input.weather_protection.clone().unwrap_or("none".to_string());
    let mut rain_coeff = 1.0;
    let mut wind_coeff = 1.0;
    let mut protection_delay = 0.0;

    match weather_protection.as_str() {
        "parchment" => {
            rain_coeff = 0.1;
            protection_delay = 4.0;
        }
        "pan_shield" => {
            rain_coeff = 0.2;
            wind_coeff = 0.2;
        }
        "operator_cowl" => {
            rain_coeff = 0.8;
            wind_coeff = 0.0;
        }
        _ => {}
    }

    // 2. Determine Ignition Delay (in ms)
    let base_ignition_delay = 2.0; // ms
    let weather_ignition_delay = humidity_slowdown * 8.0;
    let skill_ignition_delay = ((100.0 - input.priming_quality) * 0.15).max(0.0);
    let damp_ignition_delay = if is_damp { 8.0 } else { 0.0 };
    let fouling_ignition_delay = input.persistent_fouling * 6.0;
    
    let mut total_ignition_delay = base_ignition_delay 
        + weather_ignition_delay 
        + skill_ignition_delay 
        + damp_ignition_delay 
        + fouling_ignition_delay 
        + protection_delay
        + rng.gen_range(0.0..1.5);
    
    // Clamp to minimum of 0.1 ms to prevent division-by-zero or negative values
    total_ignition_delay = total_ignition_delay.max(0.1);

    // 3. Evaluate weather misfire probabilities (stochastic check performed once)
    let rain_frac = input.weather_rain / 100.0;
    let wind_frac = input.weather_wind / 100.0;

    let rain_exp = rain_frac * rain_coeff;
    let wind_exp = wind_frac * wind_coeff;

    let wet_prob = 1.0 - (-0.25 * rain_exp * total_ignition_delay).exp();
    let blown_prob = 1.0 - (-0.18 * wind_exp * total_ignition_delay).exp();

    let roll_wet: f64 = rng.gen();
    let roll_blown: f64 = rng.gen();

    let is_rain_misfire = roll_wet < wet_prob;
    let is_wind_misfire = roll_blown < blown_prob;

    let is_dud = input.priming_quality < 15.0 || (input.persistent_fouling > 0.9 && is_damp);
    let weather_misfire = is_rain_misfire || is_wind_misfire;

    if is_dud || weather_misfire {
        if is_rain_misfire {
            outcomes.push("misfire_rain".to_string());
        } else if is_wind_misfire {
            outcomes.push("misfire_wind".to_string());
        } else {
            outcomes.push("misfire".to_string());
        }

        let total_misfire_duration = total_ignition_delay + 2.0;
        let misfire_steps = (total_misfire_duration / dt) as usize;

        for step in 0..misfire_steps {
            let step_time = step as f64 * dt;
            let (temp_now, smoke_now, warnings_now) = if step_time < total_ignition_delay {
                let progress = step_time / total_ignition_delay;
                (
                    293.15 + (temp_ignition - 293.15) * progress,
                    0.05 * progress,
                    vec!["Priming powder burning...".to_string()]
                )
            } else {
                let decay = (-1.5 * (step_time - total_ignition_delay)).exp();
                let msg = if is_rain_misfire {
                    "Priming powder washed out by rain".to_string()
                } else if is_wind_misfire {
                    "Priming powder blown away by wind".to_string()
                } else {
                    "Priming failed to catch (Damp/Poor quality)".to_string()
                };
                (
                    293.15 + (temp_ignition - 293.15) * decay,
                    0.1 * decay,
                    vec![msg]
                )
            };

            frames.push(ShotFrame {
                t: 0.0, // normalized later
                time_ms: step_time,
                stage: "ignition".to_string(),
                projectile_x: 0.0,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.1,
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: smoke_now,
                fouling: input.persistent_fouling * 500.0,
                aim_offset: 0.0,
                warnings: warnings_now,
                unburned_mass: propellant_mass,
                gas_mass: 0.0,
                temperature: temp_now,
                grain_r: grain_r0,
                wall_heat_loss: 0.0,
                fouling_index: input.persistent_fouling,
                burn_profile_code,
                barrel_fatigue: input.persistent_fatigue,
            });
        }

        let frame_count = frames.len();
        for i in 0..frame_count {
            frames[i].t = i as f64 / (frame_count - 1).max(1) as f64;
        }

        return diagnosis::generate_result(input, frames, outcomes);
    }

    // Initial state variables
    let mut time_ms: f64 = 0.0;
    let max_time_ms: f64 = 60.0; // simulation time limit
    let total_steps = (max_time_ms / dt) as usize;

    let mut proj_x: f64 = 0.0;
    let mut proj_v: f64 = 0.0;
    let mut pressure: f64 = 0.1; // Atmospheric pressure in MPa
    let mut leakage_rate: f64 = 0.0;
    let mut peak_stress: f64 = 0.0;
    let mut is_moving = false;
    let mut stage = "setup".to_string();
    let mut has_exited = false;
    let mut exit_velocity: f64 = 0.0;
    let mut is_ruptured = false;
    let mut is_deformed = false;

    // Simulation loop
    for step in 0..total_steps {
        time_ms = step as f64 * dt;
        let mut step_warnings = Vec::new();

        // Stage 1: Setup & Pre-ignition
        if time_ms < total_ignition_delay {
            stage = "ignition".to_string();
            let ignition_progress = time_ms / total_ignition_delay;
            let temp_now = 293.15 + (temp_ignition - 293.15) * ignition_progress;
            frames.push(ShotFrame {
                t: 0.0,
                time_ms,
                stage: stage.clone(),
                projectile_x: 0.0,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.1,
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: 0.05 * ignition_progress,
                fouling: total_soot_fouling * 500.0,
                aim_offset: 0.0,
                warnings: vec!["Priming powder burning...".to_string()],
                unburned_mass: propellant_mass,
                gas_mass: 0.0,
                temperature: temp_now,
                grain_r: grain_r0,
                wall_heat_loss: 0.0,
                fouling_index: input.persistent_fouling,
                burn_profile_code,
                barrel_fatigue: input.persistent_fatigue,
            });
            current_temp = temp_now;
            chamber_energy = gas_mass * cv * current_temp;
            continue;
        }

        // Stage 2: Pressure building & Movement
        if !has_exited && !is_ruptured {
            stage = if is_moving { "movement".to_string() } else { "pressure".to_string() };

            // Propellant burn rate
            let burn_modifier = (1.0 - humidity_slowdown * 0.3) * (0.5 + 0.5 * (input.refinement_level / 100.0)) * burn_rate_mult;
            let mut r_burn = 0.00004 * burn_modifier * pressure.powf(0.5).max(0.1);
            
            // Uneven burn noise
            if burn_profile_code == 0.0 && r_burn > 0.0 {
                let noise = rng.gen_range(-0.25..0.25);
                r_burn *= 1.0 + noise;
            }

            let mut burned_in_step = 0.0;
            if unburned_mass > 0.0 {
                let a_surface = if is_corned {
                    if grain_r > 0.0 {
                        num_grains * 4.0 * std::f64::consts::PI * grain_r * grain_r
                    } else {
                        0.0
                    }
                } else {
                    match input.propellant_profile.as_str() {
                        "slow_smoky" => 0.004,
                        "damp_partial" => 0.003,
                        "uneven" | _ => 0.005,
                    }
                };

                let burn_mass_rate = grain_density * a_surface * r_burn; // kg/ms
                let mut generated = burn_mass_rate * dt;
                generated = generated.min(unburned_mass);
                
                burned_in_step = generated;
                unburned_mass -= burned_in_step;
                
                if is_corned {
                    grain_r = (grain_r - r_burn * dt).max(0.0);
                }
            }

            // Chemical gas yield
            let gas_yield_factor = initial_gas_yield * (1.0 - humidity_slowdown * 0.25);
            let gas_generated = burned_in_step * gas_yield_factor;
            gas_mass += gas_generated;

            // Soot & smoke residues
            let soot_fraction = if custom_mix_active {
                let wood_soot_mult = match charcoal_source.as_str() {
                    "willow" => 0.4,
                    "alder" => 1.0,
                    "oak" | _ => 2.0,
                };
                (0.15 * (charcoal_ratio / 0.15) * wood_soot_mult).clamp(0.05, 0.60)
            } else {
                if burn_profile_code == 3.0 || burn_profile_code == 4.0 { 0.30 } else { 0.15 }
            };
            let residue_generated = burned_in_step * (1.0 - gas_yield_factor);
            let step_soot = residue_generated * soot_fraction;
            let step_smoke = residue_generated * (1.0 - soot_fraction);
            total_soot_fouling += step_soot;
            total_smoke_ejected += step_smoke;

            // Volumetric work done
            let initial_vol = 0.000010; // 10cc chamber
            let prev_chamber_vol = initial_vol + bore_area * (proj_x - proj_v * (dt / 1000.0)).max(0.0);
            let chamber_vol = initial_vol + bore_area * proj_x;
            let d_vol = (chamber_vol - prev_chamber_vol).max(0.0);
            let work_done = (pressure - 0.1).max(0.0) * 1_000_000.0 * d_vol; // in Joules

            // Leak calculations
            let c_leak = 0.62;
            let r_gas = 280.0;
            let choked_constant = (gamma * (2.0 / (gamma + 1.0)).powf((gamma + 1.0) / (gamma - 1.0))).sqrt();
            let rt_sqrt = (r_gas * current_temp).sqrt();
            let choked_factor = choked_constant / rt_sqrt;
            let pressure_pa = pressure * 1_000_000.0;

            let mut active_gap_area = gap_area;
            if input.persistent_fatigue > 0.4 {
                // Fissures bleed additional chamber pressure (adds to gap area)
                let gap_mult = 1.0 + 1.5 * input.persistent_fatigue;
                active_gap_area = if gap_area > 0.0 {
                    gap_area * gap_mult
                } else {
                    // even if perfect seal, fissure leaks gas
                    std::f64::consts::PI * (bore_radius * bore_radius - (bore_radius - 0.0003).powi(2)) * (gap_mult - 1.0)
                };
            }

            let windage_leak = if active_gap_area > 0.0 && pressure > 0.1 {
                c_leak * active_gap_area * pressure_pa * choked_factor * (dt / 1000.0)
            } else {
                0.0
            };

            let touchhole_leak = if pressure > 0.1 {
                c_leak * touchhole_area * pressure_pa * choked_factor * (dt / 1000.0)
            } else {
                0.0
            };

            let actual_leak = (windage_leak + touchhole_leak).min(gas_mass);
            gas_mass -= actual_leak;
            total_gas_leaked += actual_leak;

            leakage_rate = actual_leak / dt;

            // Continuous wall cooling
            let a_bore = 2.0 * std::f64::consts::PI * bore_radius * (0.05 + proj_x);
            let q_lost = h_material * a_bore * (current_temp - 293.15).max(0.0) * (dt / 1000.0);
            accumulated_heat_loss += q_lost;

            // Energy update
            let energy_added = gas_generated * cv * temp_ignition;
            let energy_lost_leak = actual_leak * cp * current_temp;
            chamber_energy = (chamber_energy + energy_added - energy_lost_leak - work_done - q_lost).max(0.0);

            if gas_mass > 0.000001 {
                current_temp = chamber_energy / (gas_mass * cv);
            } else {
                current_temp = 293.15;
                chamber_energy = 0.0;
            }
            current_temp = current_temp.clamp(293.15, 3000.0);

            // Pressure (Nobel-Abel)
            let co_volume = 0.0008;
            let denominator = chamber_vol - co_volume * gas_mass;
            pressure = if denominator > 0.000001 {
                (gas_mass * r_gas * current_temp / denominator) / 1_000_000.0
            } else {
                0.1
            };
            pressure = pressure.max(0.1);

            // Force balance
            let force_pressure = (pressure - 0.1) * 1_000_000.0 * bore_area;

            if input.projectile_type == "none" {
                is_moving = false;
                proj_v = 0.0;
                proj_x = 0.0;
            } else {
                if !is_moving {
                    if force_pressure > static_friction_threshold {
                        is_moving = true;
                    }
                }

                if is_moving {
                    let mut jitter_coeff = 1.0;
                    if input.projectile_type == "rough_stone" {
                        let noise = (rng.gen_range(-15..15) as f64) / 100.0;
                        jitter_coeff = (1.0 + noise).max(0.5);
                    }
                    
                    let force_friction = dynamic_friction_coeff * static_friction_threshold * jitter_coeff;
                    let force_net = (force_pressure - force_friction).max(0.0);
                    
                    let accel = force_net / proj_mass;
                    proj_v += accel * (dt / 1000.0);
                    proj_x += proj_v * (dt / 1000.0);

                    if proj_x >= barrel_length {
                        proj_x = barrel_length;
                        has_exited = true;
                        exit_velocity = proj_v;
                    }
                }
            }

            // Hoop stress
            let hoop_stress = barrel.calculate_von_mises_stress(pressure, input.persistent_fatigue);
            peak_stress = peak_stress.max(hoop_stress);

            let (ruptured, deformed) = barrel.evaluate_failure(hoop_stress);
            if ruptured {
                is_ruptured = true;
                outcomes.push("barrel_failure".to_string());
                step_warnings.push("BARREL METALLURGICAL FAILURE".to_string());
            } else if deformed {
                is_deformed = true;
                step_warnings.push("Barrel deformation warning".to_string());
            }

            if windage_leak > 0.00001 {
                step_warnings.push("Gas blowing past projectile".to_string());
            }

            if custom_mix_active && sulfur_ratio > 0.15 {
                step_warnings.push("High sulfur acidic fouling".to_string());
            }

            let fouling_index_now = (input.persistent_fouling + (total_soot_fouling / 0.015)).min(1.0);
            frames.push(ShotFrame {
                t: 0.0,
                time_ms,
                stage: stage.clone(),
                projectile_x: proj_x / barrel_length,
                projectile_y: 0.0,
                projectile_velocity: proj_v,
                pressure,
                leakage: leakage_rate,
                barrel_stress: hoop_stress,
                smoke: (pressure / 15.0).min(1.0) + (total_soot_fouling * 500.0) * 0.2,
                fouling: total_soot_fouling * 500.0,
                aim_offset: 0.0,
                warnings: step_warnings,
                unburned_mass,
                gas_mass,
                temperature: current_temp,
                grain_r,
                wall_heat_loss: accumulated_heat_loss,
                fouling_index: fouling_index_now,
                burn_profile_code,
                barrel_fatigue: input.persistent_fatigue,
            });

            if is_ruptured {
                break;
            }
        }
    }

    // Calculate fatigue once per shot
    let mut delta_fatigue = 0.0;
    if peak_stress > 0.1 * barrel.yield_strength {
        if peak_stress <= barrel.yield_strength {
            // Elastic fatigue
            delta_fatigue = 0.005;
        } else {
            // Plastic fatigue
            let c_plastic = match input.barrel_material.as_str() {
                "bamboo" => 0.25,
                "wrought_iron" => 0.15,
                "cast_bronze" | _ => 0.10,
            };
            let stress_ratio = (peak_stress - barrel.yield_strength) / (barrel.ultimate_strength - barrel.yield_strength).max(1.0);
            delta_fatigue = 0.005 + c_plastic * stress_ratio * stress_ratio;
        }
    }

    // Chemical corrosion fatigue
    let sulfur_factor = if custom_mix_active { 1.0 + sulfur_ratio } else { 1.10 };
    let humidity_factor = 1.0 + (input.weather_humidity / 100.0) * 0.5;
    let delta_corrosion = 0.02 * (total_soot_fouling / 0.015).min(1.0) * sulfur_factor * humidity_factor;

    let mut final_fatigue = (input.persistent_fatigue + delta_fatigue + delta_corrosion).min(1.0);

    if final_fatigue >= 1.0 && !is_ruptured {
        is_ruptured = true;
        if !outcomes.contains(&"barrel_failure".to_string()) {
            outcomes.push("barrel_failure".to_string());
        }
    }

    // Map the final fatigue to all frames currently in the vector
    for frame in &mut frames {
        frame.barrel_fatigue = final_fatigue;
    }

    let fouling_index_now = (input.persistent_fouling + (total_soot_fouling / 0.015)).min(1.0);

    if is_ruptured {
        let last_frame = frames.last().unwrap().clone();
        for step in 1..10 {
            let decay = (-1.0 * step as f64).exp();
            frames.push(ShotFrame {
                t: 0.0,
                time_ms: last_frame.time_ms + step as f64 * 0.5,
                stage: "aftermath".to_string(),
                projectile_x: last_frame.projectile_x,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.1,
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: last_frame.smoke * 1.5,
                fouling: total_soot_fouling * 500.0,
                aim_offset: 0.0,
                warnings: vec!["TEST DEVICE RUPTURED".to_string()],
                unburned_mass,
                gas_mass: gas_mass * decay,
                temperature: 293.15 + (current_temp - 293.15) * decay,
                grain_r,
                wall_heat_loss: accumulated_heat_loss,
                fouling_index: fouling_index_now,
                burn_profile_code,
                barrel_fatigue: final_fatigue,
            });
        }
        return diagnosis::generate_result(input, frames, outcomes);
    }

    if !has_exited {
        outcomes.push("stuck_projectile".to_string());
        let last_frame = frames.last().unwrap().clone();
        for step in 1..10 {
            let decay = (-0.5 * step as f64).exp();
            frames.push(ShotFrame {
                t: 0.0,
                time_ms: last_frame.time_ms + step as f64 * 0.5,
                stage: "aftermath".to_string(),
                projectile_x: last_frame.projectile_x,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.1,
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: 0.1,
                fouling: total_soot_fouling * 500.0,
                aim_offset: 0.0,
                warnings: vec!["Projectile stuck in bore".to_string()],
                unburned_mass,
                gas_mass: gas_mass * decay,
                temperature: 293.15 + (current_temp - 293.15) * decay,
                grain_r,
                wall_heat_loss: accumulated_heat_loss,
                fouling_index: fouling_index_now,
                burn_profile_code,
                barrel_fatigue: final_fatigue,
            });
        }
        return diagnosis::generate_result(input, frames, outcomes);
    }

    // Stage 3: Flight trajectory
    stage = "flight".to_string();
    let mut base_jitter = (wind_disturbance * 2.8) + (1.0 - shape_regularity) * 4.2;
    if input.persistent_fatigue > 0.0 {
        // Deformed/fatigued barrel scales aim jitter due to out-of-round bore
        base_jitter *= 1.0 + 2.0 * input.persistent_fatigue;
    }
    let mut fixed_bias = 0.0;

    match weather_protection.as_str() {
        "pan_shield" => {
            fixed_bias = 1.0; // 1 degree bias
        }
        "operator_cowl" => {
            base_jitter += 2.5; // increase random range by 2.5 degrees
        }
        _ => {}
    }

    let aim_jitter = fixed_bias + rng.gen_range(-base_jitter..base_jitter);

    let target_distance = 35.0;
    let mut flight_x = 0.0;
    let mut flight_y = 1.2;
    let angle_rad = aim_jitter.to_radians();
    
    let mut vx = exit_velocity * angle_rad.cos();
    let mut vy = exit_velocity * angle_rad.sin();
    
    let flight_dt = 0.01;
    let mut flight_time = 0.0;
    let max_flight_duration = 3.0;

    let mut flight_frames = Vec::new();

    while flight_x < target_distance && flight_y > 0.0 && flight_time < max_flight_duration {
        flight_time += flight_dt;
        
        let air_density = 1.225;
        let proj_area = std::f64::consts::PI * proj_radius * proj_radius;
        let speed = (vx*vx + vy*vy).sqrt();
        
        let drag_force = 0.5 * drag_coeff * air_density * proj_area * speed * speed;
        let drag_accel = drag_force / proj_mass;
        
        vx -= drag_accel * (vx / speed) * flight_dt;
        vy -= (9.81 + drag_accel * (vy / speed)) * flight_dt;
        
        flight_x += vx * flight_dt;
        flight_y += vy * flight_dt;

        flight_frames.push((flight_x, flight_y, speed));
    }

    let total_flight_frames = flight_frames.len();
    for (i, (fx, fy, fspeed)) in flight_frames.into_iter().enumerate() {
        let normalized_step = i as f64 / total_flight_frames.max(1) as f64;
        let decay = (-0.3 * i as f64).exp();
        frames.push(ShotFrame {
            t: 0.0,
            time_ms: time_ms + i as f64 * (flight_dt * 1000.0),
            stage: if fx >= target_distance || fy <= 0.0 { "impact".to_string() } else { stage.clone() },
            projectile_x: fx,
            projectile_y: fy,
            projectile_velocity: fspeed,
            pressure: 0.1,
            leakage: 0.0,
            barrel_stress: 0.0,
            smoke: 0.2 * (1.0 - normalized_step),
            fouling: total_soot_fouling * 500.0,
            aim_offset: aim_jitter,
            warnings: if i == total_flight_frames - 1 {
                if fy <= 0.0 { vec!["Shot dropped short".to_string()] }
                else if (fy - 1.5).abs() < 0.3 { vec!["DIRECT BULLSEYE IMPACT!".to_string()] }
                else { vec!["Projectile impacted target".to_string()] }
            } else {
                vec![]
            },
            unburned_mass,
            gas_mass: gas_mass * decay,
            temperature: 293.15 + (current_temp - 293.15) * decay,
            grain_r,
            wall_heat_loss: accumulated_heat_loss,
            fouling_index: fouling_index_now,
            burn_profile_code,
            barrel_fatigue: final_fatigue,
        });
    }

    // Final outcome
    let final_y = frames.last().unwrap().projectile_y;
    let final_x = frames.last().unwrap().projectile_x;

    if final_x >= target_distance {
        let hit_dist = (final_y - 1.5).abs();
        if hit_dist < 0.3 {
            outcomes.push("target_hit".to_string());
        } else {
            outcomes.push("target_miss".to_string());
        }
    } else {
        outcomes.push("target_miss".to_string());
    }

    if is_deformed {
        outcomes.push("barrel_deformed".to_string());
    }

    let frame_count = frames.len();
    for i in 0..frame_count {
        frames[i].t = i as f64 / (frame_count - 1).max(1) as f64;
        frames[i].barrel_fatigue = final_fatigue;
    }

    diagnosis::generate_result(input, frames, outcomes)
}
