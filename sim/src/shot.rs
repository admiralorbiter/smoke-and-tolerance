use crate::{ShotInput, ShotFrame, ShotResult};
use crate::barrel::BarrelProperties;
use crate::diagnosis;
use rand::prelude::*;
use rand_chacha::ChaCha8Rng;

pub fn run_simulation(input: ShotInput) -> ShotResult {
    // Initialize deterministic random number generator from seed
    let mut rng = ChaCha8Rng::seed_from_u64(input.seed);

    let barrel = BarrelProperties::get_by_name(&input.barrel_material, input.seed);

    let mut frames = Vec::new();
    let mut outcomes = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    // Physical dimensions & constants
    let barrel_length = 0.30; // 30 cm barrel length
    let bore_radius = barrel.r_inner;
    let bore_area = std::f64::consts::PI * bore_radius * bore_radius;
    let touchhole_radius = 0.001; // 1mm radius = 2mm diameter touchhole
    let touchhole_area = std::f64::consts::PI * touchhole_radius * touchhole_radius;

    // Projectile Setup
    let (proj_mass, proj_radius, drag_coeff, is_arrow, is_gravel, shape_regularity) = match input.projectile_type.as_str() {
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

    // Frictional properties
    let static_friction_threshold = match input.sealing_quality.as_str() {
        "none" => 80.0,
        "tow" => 250.0,
        "clay" | _ => 750.0, // tight clay plug requires high pressure to budge
    };
    let dynamic_friction_coeff = match input.projectile_type.as_str() {
        "lead_arrow" => 0.12,
        "pebbles" => 0.28,
        "rough_stone" => 0.38,
        "lead_ball" | _ => 0.08, // lead is soft and self-lubricating
    };

    // Weather impact on ignition delay & duds
    let rain_dud_chance = input.weather_rain / 100.0;
    let wind_disturbance = input.weather_wind / 100.0;
    let humidity_slowdown = input.weather_humidity / 100.0;

    // 1. Check for absolute Misfire (Dud)
    let is_dud = rng.gen_bool(rain_dud_chance.min(0.95)) || 
                 (input.weather_wind > 60.0 && rng.gen_bool((wind_disturbance * 0.5).min(0.9)));

    if is_dud {
        outcomes.push("misfire".to_string());
        // Generate a few spark frames showing touchhole failure
        for step in 0..15 {
            let t = step as f64 / 15.0;
            frames.push(ShotFrame {
                t,
                time_ms: step as f64 * 0.5,
                stage: "ignition".to_string(),
                projectile_x: 0.0,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.0,
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: 0.2 * (1.0 - t),
                fouling: 0.0,
                aim_offset: 0.0,
                warnings: vec!["Priming failed to catch".to_string()],
            });
        }
        return diagnosis::generate_result(input, frames, outcomes);
    }

    // 2. Determine Ignition Delay (in ms)
    let base_ignition_delay = 3.0; // ms
    let weather_ignition_delay = humidity_slowdown * 12.0 + wind_disturbance * 6.0;
    let total_ignition_delay = base_ignition_delay + weather_ignition_delay + rng.gen_range(0.0..5.0);

    // Initial state variables
    let mut time_ms: f64 = 0.0;
    let dt: f64 = 0.05; // ms step size
    let max_time_ms: f64 = 60.0; // simulation time limit
    let total_steps = (max_time_ms / dt) as usize;

    let propellant_mass: f64 = 0.015; // 15 grams propellant charge
    let mut unburned_mass: f64 = propellant_mass;
    let mut gas_mass: f64 = 0.0;
    let mut fouling: f64 = 0.1 * (input.weather_humidity / 50.0);

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
            // Slow match burning glow
            let ignition_progress = time_ms / total_ignition_delay;
            frames.push(ShotFrame {
                t: 0.0, // normalized will be done later
                time_ms,
                stage: stage.clone(),
                projectile_x: 0.0,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.1,
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: 0.05 * ignition_progress,
                fouling,
                aim_offset: 0.0,
                warnings: vec!["Priming powder burning...".to_string()],
            });
            continue;
        }

        // Stage 2: Pressure building & Movement
        if !has_exited && !is_ruptured {
            stage = if is_moving { "movement".to_string() } else { "pressure".to_string() };

            // Propellant burn calculation
            let burn_modifier = (1.0 - humidity_slowdown * 0.3) * (0.5 + 0.5 * (input.refinement_level / 100.0));
            let mut burn_rate: f64 = match input.propellant_type.as_str() {
                "meal" => 0.0003 * burn_modifier, // slow linear burn (0.3 grams/ms)
                "corned" | _ => {
                    // Vieille's law approximation: rate = a * P^n
                    let base_rate = 0.0008 * burn_modifier;
                    let p_factor = pressure.powf(0.5).max(0.1);
                    base_rate * p_factor
                }
            };
            
            // Limit by remaining mass
            burn_rate = burn_rate.min(unburned_mass / dt);
            let burned_in_step = burn_rate * dt;
            unburned_mass -= burned_in_step;

            // Chemical gas conversion efficiency (wet powder yields less gas, more soot/ash)
            let gas_yield_factor = 0.45 * (1.0 - humidity_slowdown * 0.25);
            let gas_generated = burned_in_step * gas_yield_factor;
            gas_mass += gas_generated;
            fouling += burned_in_step * (1.0 - gas_yield_factor) * 0.05;

            // Gas leakage from windage and touchhole
            let c_leak = 0.62; // gas discharge coefficient
            let gas_density = if gas_mass > 0.0 {
                let volume = 0.00001 + bore_area * proj_x;
                gas_mass / volume
            } else {
                0.0
            };
            
            // Windage leak
            let windage_leak = if gap_area > 0.0 && pressure > 0.1 {
                let leak_vel = (2.0 * (pressure - 0.1) * 1_000_000.0 / gas_density.max(0.1)).sqrt();
                c_leak * gap_area * leak_vel * gas_density * (dt / 1000.0) // kg leaked in step
            } else {
                0.0
            };

            // Touchhole leak
            let touchhole_leak = if pressure > 0.1 {
                let leak_vel = (2.0 * (pressure - 0.1) * 1_000_000.0 / gas_density.max(0.1)).sqrt();
                c_leak * touchhole_area * leak_vel * gas_density * (dt / 1000.0)
            } else {
                0.0
            };

            leakage_rate = (windage_leak + touchhole_leak) / dt;
            gas_mass = (gas_mass - windage_leak - touchhole_leak).max(0.0);

            // Pressure calculation: Nobel-Abel gas expansion
            // P = m_gas * R * T / (V - eta * m_gas)
            let gas_temp_modifier = 1.0 - humidity_slowdown * 0.15;
            let rt = 340_000.0 * gas_temp_modifier; // Gas constant * Temp
            let co_volume = 0.001; // m^3/kg
            let chamber_vol = 0.000010 + bore_area * proj_x; // 10cc base chamber volume + barrel volume
            
            let denominator = chamber_vol - co_volume * gas_mass;
            pressure = if denominator > 0.000001 {
                (gas_mass * rt / denominator) / 1_000_000.0 // Convert to MPa
            } else {
                0.1
            };
            pressure = pressure.max(0.1); // clamp to atmospheric

            // Force balance
            let force_pressure = (pressure - 0.1) * 1_000_000.0 * bore_area; // Newtons

            if !is_moving {
                if force_pressure > static_friction_threshold {
                    is_moving = true;
                }
            }

            if is_moving {
                // Dynamic friction force
                // Stone shot rattling creates jagged spikes in friction
                let mut jitter_coeff = 1.0;
                if input.projectile_type == "rough_stone" {
                    let noise = (rng.gen_range(-15..15) as f64) / 100.0;
                    jitter_coeff = (1.0 + noise).max(0.5);
                }
                
                let force_friction = dynamic_friction_coeff * static_friction_threshold * jitter_coeff;
                let force_net = (force_pressure - force_friction).max(0.0);
                
                let accel = force_net / proj_mass;
                proj_v += accel * (dt / 1000.0); // dt is in ms
                proj_x += proj_v * (dt / 1000.0);

                if proj_x >= barrel_length {
                    proj_x = barrel_length;
                    has_exited = true;
                    exit_velocity = proj_v;
                }
            }

            // Calculate barrel hoop stress
            let hoop_stress = barrel.calculate_hoop_stress(pressure);
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

            frames.push(ShotFrame {
                t: 0.0, // fill later
                time_ms,
                stage: stage.clone(),
                projectile_x: proj_x / barrel_length,
                projectile_y: 0.0,
                projectile_velocity: proj_v,
                pressure,
                leakage: leakage_rate,
                barrel_stress: hoop_stress,
                smoke: (pressure / 15.0).min(1.0) + fouling * 0.2,
                fouling,
                aim_offset: 0.0,
                warnings: step_warnings,
            });

            if is_ruptured {
                break;
            }
        }
    }

    if is_ruptured {
        // Complete the failure visualization
        let last_frame = frames.last().unwrap().clone();
        for step in 1..10 {
            frames.push(ShotFrame {
                t: 0.0,
                time_ms: last_frame.time_ms + step as f64 * 0.5,
                stage: "aftermath".to_string(),
                projectile_x: last_frame.projectile_x,
                projectile_y: 0.0,
                projectile_velocity: 0.0,
                pressure: 0.1, // collapsed pressure
                leakage: 0.0,
                barrel_stress: 0.0,
                smoke: last_frame.smoke * 1.5,
                fouling,
                aim_offset: 0.0,
                warnings: vec!["TEST DEVICE RUPTURED".to_string()],
            });
        }
        return diagnosis::generate_result(input, frames, outcomes);
    }

    if !has_exited {
        // Projectile stuck in bore
        outcomes.push("stuck_projectile".to_string());
        let last_frame = frames.last().unwrap().clone();
        for step in 1..10 {
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
                fouling,
                aim_offset: 0.0,
                warnings: vec!["Projectile stuck in bore".to_string()],
            });
        }
        return diagnosis::generate_result(input, frames, outcomes);
    }

    // Stage 3: Flight trajectory and target impact
    stage = "flight".to_string();
    
    // Wind and rattling deflects trajectory
    let base_jitter = (wind_disturbance * 2.8) + (1.0 - shape_regularity) * 4.2;
    let aim_jitter = rng.gen_range(-base_jitter..base_jitter);

    // Initial flight state (2D projectile motion)
    let target_distance = 35.0; // Target is placed 35m away
    let mut flight_x = 0.0;
    let mut flight_y = 1.2; // Handheld height
    let angle_rad = aim_jitter.to_radians();
    
    let mut vx = exit_velocity * angle_rad.cos();
    let mut vy = exit_velocity * angle_rad.sin();
    
    let flight_dt = 0.01; // 10ms steps for flight ballistics
    let mut flight_time = 0.0;
    let max_flight_duration = 3.0;

    let mut flight_frames = Vec::new();

    while flight_x < target_distance && flight_y > 0.0 && flight_time < max_flight_duration {
        flight_time += flight_dt;
        
        // Flight drag
        let air_density = 1.225; // kg/m^3
        let proj_area = std::f64::consts::PI * proj_radius * proj_radius;
        let speed = (vx*vx + vy*vy).sqrt();
        
        let drag_force = 0.5 * drag_coeff * air_density * proj_area * speed * speed;
        let drag_accel = drag_force / proj_mass;
        
        // Update velocity components
        vx -= drag_accel * (vx / speed) * flight_dt;
        vy -= (9.81 + drag_accel * (vy / speed)) * flight_dt;
        
        flight_x += vx * flight_dt;
        flight_y += vy * flight_dt;

        flight_frames.push((flight_x, flight_y, speed));
    }

    // Add flight frames to the main frame array
    let total_flight_frames = flight_frames.len();
    for (i, (fx, fy, fspeed)) in flight_frames.into_iter().enumerate() {
        let normalized_step = i as f64 / total_flight_frames.max(1) as f64;
        frames.push(ShotFrame {
            t: 0.0, // fill later
            time_ms: time_ms + i as f64 * (flight_dt * 1000.0),
            stage: if fx >= target_distance || fy <= 0.0 { "impact".to_string() } else { stage.clone() },
            projectile_x: fx, // absolute flight coordinates mapped to frame
            projectile_y: fy,
            projectile_velocity: fspeed,
            pressure: 0.1,
            leakage: 0.0,
            barrel_stress: 0.0,
            smoke: 0.2 * (1.0 - normalized_step),
            fouling,
            aim_offset: aim_jitter,
            warnings: if i == total_flight_frames - 1 {
                if fy <= 0.0 { vec!["Shot dropped short".to_string()] }
                else if (fy - 1.5).abs() < 0.3 { vec!["DIRECT BULLSEYE IMPACT!".to_string()] }
                else { vec!["Projectile impacted target".to_string()] }
            } else {
                vec![]
            },
        });
    }

    // Final outcome categorization
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
        outcomes.push("target_miss".to_string()); // dropped short
    }

    if is_deformed {
        outcomes.push("barrel_deformed".to_string());
    }

    // Normalize t parameter (0.0 to 1.0) over all frames
    let frame_count = frames.len();
    for i in 0..frame_count {
        frames[i].t = i as f64 / (frame_count - 1) as f64;
    }

    diagnosis::generate_result(input, frames, outcomes)
}
