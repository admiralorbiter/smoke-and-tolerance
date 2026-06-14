use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

pub mod shot;
pub mod barrel;
pub mod diagnosis;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShotInput {
    pub barrel_material: String,    // "bamboo", "wrought_iron", "cast_bronze"
    pub propellant_type: String,     // "meal", "corned"
    pub refinement_level: f64,      // 0-100
    pub projectile_type: String,     // "lead_arrow", "pebbles", "rough_stone", "lead_ball"
    pub sealing_quality: String,     // "none", "tow", "clay"
    pub weather_humidity: f64,      // 0-100
    pub weather_wind: f64,          // 0-100
    pub weather_rain: f64,          // 0-100
    pub priming_quality: f64,       // 0-100
    pub seed: u64,
    pub persistent_fouling: f64,    // 0-1
    pub propellant_profile: String, // "uneven", "fast_then_weak", "steady", "slow_smoky", "damp_partial"
    
    pub persistent_fatigue: f64,    // 0-1
    pub flaw_seed: u64,
    
    // Custom alchemical mix options
    pub custom_mix_active: Option<bool>,
    pub saltpeter_ratio: Option<f64>,
    pub charcoal_ratio: Option<f64>,
    pub sulfur_ratio: Option<f64>,
    pub charcoal_source: Option<String>,
    pub saltpeter_purity: Option<f64>,
    pub weather_protection: Option<String>,
    pub target_armor_type: Option<String>,

    pub persistent_temperature: Option<f64>,
    pub is_swabbed_wet: Option<bool>,
    pub touchhole_erosion: Option<f64>,
}

pub const STRIDE_COUNT: usize = 23;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShotFrame {
    pub t: f64,                     // 0-1 normalized simulation time
    pub time_ms: f64,               // absolute time in milliseconds
    pub stage: String,              // "setup", "ignition", "pressure", "movement", "muzzle_exit", "flight", "impact", "aftermath"
    pub projectile_x: f64,          // 0-1 normalized position in barrel
    pub projectile_y: f64,          // flight height (for flight stage)
    pub projectile_velocity: f64,   // m/s
    pub pressure: f64,              // MPa
    pub leakage: f64,               // MPa/ms rate
    pub barrel_stress: f64,          // MPa
    pub smoke: f64,                 // 0-1 relative smoke density
    pub fouling: f64,               // 0-1 relative residue
    pub aim_offset: f64,            // degrees
    pub warnings: Vec<String>,
    pub unburned_mass: f64,         // propellant mass remaining in kg
    pub gas_mass: f64,              // chamber gas mass in kg
    pub temperature: f64,           // chamber gas temperature in Kelvin
    pub grain_r: f64,               // propellant grain radius in meters
    pub wall_heat_loss: f64,        // convective energy lost in Joules
    pub fouling_index: f64,         // persistent fouling index
    pub burn_profile_code: f64,     // code representing propellant profile
    pub barrel_fatigue: f64,        // cumulative barrel fatigue index
    pub barrel_temperature: f64,
    pub structural_strength_pct: f64,
    pub touchhole_radius_current: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosisEntry {
    pub severity: String,           // "info", "warning", "critical"
    pub title: String,
    pub explanation: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShotResult {
    pub input: ShotInput,
    pub frames: Vec<ShotFrame>,
    pub outcomes: Vec<String>,       // e.g., "misfire", "delayed_ignition", "barrel_failure", "hit", "miss"
    pub diagnosis: Vec<DiagnosisEntry>,
    pub summary: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShotResultWasm {
    pub input: ShotInput,
    pub frame_count: usize,
    pub frame_data_ptr: usize,
    pub outcomes: Vec<String>,
    pub diagnosis: Vec<DiagnosisEntry>,
    pub summary: String,
}

static mut FRAME_BUFFER: Vec<f64> = Vec::new();

#[wasm_bindgen]
pub fn simulate_shot(val: JsValue) -> Result<JsValue, JsValue> {
    let input: ShotInput = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let result = shot::run_simulation(input.clone());

    unsafe {
        FRAME_BUFFER.clear();
        for frame in &result.frames {
            let stage_code = match frame.stage.as_str() {
                "setup" => 0.0,
                "ignition" => 1.0,
                "pressure" => 2.0,
                "movement" => 3.0,
                "muzzle_exit" => 4.0,
                "flight" => 5.0,
                "impact" => 6.0,
                "aftermath" | _ => 7.0,
            };
            FRAME_BUFFER.push(frame.t);
            FRAME_BUFFER.push(frame.time_ms);
            FRAME_BUFFER.push(frame.projectile_x);
            FRAME_BUFFER.push(frame.projectile_y);
            FRAME_BUFFER.push(frame.projectile_velocity);
            FRAME_BUFFER.push(frame.pressure);
            FRAME_BUFFER.push(frame.leakage);
            FRAME_BUFFER.push(frame.barrel_stress);
            FRAME_BUFFER.push(frame.smoke);
            FRAME_BUFFER.push(frame.fouling);
            FRAME_BUFFER.push(frame.aim_offset);
            FRAME_BUFFER.push(stage_code);
            FRAME_BUFFER.push(frame.unburned_mass);
            FRAME_BUFFER.push(frame.gas_mass);
            FRAME_BUFFER.push(frame.temperature);
            FRAME_BUFFER.push(frame.grain_r);
            FRAME_BUFFER.push(frame.wall_heat_loss);
            FRAME_BUFFER.push(frame.fouling_index);
            FRAME_BUFFER.push(frame.burn_profile_code);
            FRAME_BUFFER.push(frame.barrel_fatigue);
            FRAME_BUFFER.push(frame.barrel_temperature);
            FRAME_BUFFER.push(frame.structural_strength_pct);
            FRAME_BUFFER.push(frame.touchhole_radius_current);
        }

        let wasm_result = ShotResultWasm {
            input,
            frame_count: result.frames.len(),
            frame_data_ptr: FRAME_BUFFER.as_ptr() as usize,
            outcomes: result.outcomes,
            diagnosis: result.diagnosis,
            summary: result.summary,
        };

        serde_wasm_bindgen::to_value(&wasm_result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shot::run_simulation;

    #[test]
    fn test_simulation_happy_path() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 85.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };

        let result = run_simulation(input);
        assert!(!result.outcomes.contains(&"barrel_failure".to_string()));
        assert!(!result.outcomes.contains(&"stuck_projectile".to_string()));
    }

    #[test]
    fn test_simulation_bamboo_explosion() {
        let input = ShotInput {
            barrel_material: "bamboo".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 100.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "clay".to_string(),
            weather_humidity: 0.0,
            weather_wind: 0.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };

        let result = run_simulation(input);
        assert!(result.outcomes.contains(&"barrel_failure".to_string()));
    }

    #[test]
    fn test_fouling_accumulation_impact() {
        let mut input_clean = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 85.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };
        let result_clean = run_simulation(input_clean.clone());
        
        let mut input_fouled = input_clean;
        input_fouled.persistent_fouling = 0.8;
        let result_fouled = run_simulation(input_fouled);
        
        let peak_v_clean = result_clean.frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);
        let peak_v_fouled = result_fouled.frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);
        
        assert!(peak_v_fouled < peak_v_clean, "Fouling must degrade muzzle velocity via drag!");
    }

    #[test]
    fn test_rain_misfire_without_protection() {
        let mut misfire_count = 0;
        for i in 0..100 {
            let input = ShotInput {
                barrel_material: "cast_bronze".to_string(),
                propellant_type: "corned".to_string(),
                refinement_level: 85.0,
                projectile_type: "lead_ball".to_string(),
                sealing_quality: "tow".to_string(),
                weather_humidity: 10.0,
                weather_wind: 0.0,
                weather_rain: 95.0, // heavy rain
                priming_quality: 100.0,
                seed: 100 + i, // different seeds
                persistent_fouling: 0.0,
                propellant_profile: "steady".to_string(),
                persistent_fatigue: 0.0,
                flaw_seed: 42,
                custom_mix_active: None,
                saltpeter_ratio: None,
                charcoal_ratio: None,
                sulfur_ratio: None,
                charcoal_source: None,
                saltpeter_purity: None,
                weather_protection: Some("none".to_string()),
                target_armor_type: None,
            };

            let result = run_simulation(input);
            if result.outcomes.contains(&"misfire_rain".to_string()) {
                misfire_count += 1;
            }
        }
        assert!(misfire_count >= 40, "Misfire count is {}/100, expected at least 40 in heavy rain without protection", misfire_count);
    }

    #[test]
    fn test_parchment_protection_success() {
        let mut misfire_count = 0;
        let mut success_count = 0;
        for i in 0..100 {
            let input = ShotInput {
                barrel_material: "cast_bronze".to_string(),
                propellant_type: "corned".to_string(),
                refinement_level: 85.0,
                projectile_type: "lead_ball".to_string(),
                sealing_quality: "tow".to_string(),
                weather_humidity: 10.0,
                weather_wind: 0.0,
                weather_rain: 95.0, // heavy rain
                priming_quality: 100.0,
                seed: 100 + i,
                persistent_fouling: 0.0,
                propellant_profile: "steady".to_string(),
                persistent_fatigue: 0.0,
                flaw_seed: 42,
                custom_mix_active: None,
                saltpeter_ratio: None,
                charcoal_ratio: None,
                sulfur_ratio: None,
                charcoal_source: None,
                saltpeter_purity: None,
                weather_protection: Some("parchment".to_string()),
                target_armor_type: None,
            };

            let result = run_simulation(input);
            if result.outcomes.contains(&"misfire_rain".to_string()) {
                misfire_count += 1;
            } else {
                success_count += 1;
            }
        }
        assert!(misfire_count <= 40, "Misfire count is {}/100, expected at most 40 with parchment cover in heavy rain", misfire_count);
        assert!(success_count >= 60);
    }

    #[test]
    fn test_fatigue_accumulation_and_rupture() {
        let input_base = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 80.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 0.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };

        // First shot (0 fatigue)
        let result1 = run_simulation(input_base.clone());
        let fatigue1 = result1.frames.last().unwrap().barrel_fatigue;
        assert!(fatigue1 > 0.0, "Fatigue must increase from 0.0");
        assert!(!result1.outcomes.contains(&"barrel_failure".to_string()));

        // Firing with a barrel already at 99% fatigue should trigger rupture
        let mut input_stressed = input_base;
        input_stressed.persistent_fatigue = 0.99;
        let result2 = run_simulation(input_stressed);
        let fatigue2 = result2.frames.last().unwrap().barrel_fatigue;
        assert_eq!(fatigue2, 1.0, "Fatigue should be clamped to 1.0");
        assert!(result2.outcomes.contains(&"barrel_failure".to_string()), "Fatigued barrel must rupture");
    }

    #[test]
    fn test_era1_challenge_victory() {
        let input = ShotInput {
            barrel_material: "bamboo".to_string(),
            propellant_type: "meal".to_string(),
            refinement_level: 45.0,
            projectile_type: "none".to_string(),
            sealing_quality: "none".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "uneven".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };
        let result = run_simulation(input);
        let final_time = result.frames.last().unwrap().time_ms;
        assert!(final_time >= 8.0, "Era 1 burn duration must be >= 8ms");
        assert!(!result.outcomes.contains(&"barrel_failure".to_string()));
    }

    #[test]
    fn test_era1_challenge_fail_by_split() {
        let input = ShotInput {
            barrel_material: "bamboo".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 75.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "clay".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };
        let result = run_simulation(input);
        assert!(result.outcomes.contains(&"barrel_failure".to_string()), "Bamboo with corned powder and clay wadding must rupture");
    }

    #[test]
    fn test_era2_challenge_victory() {
        let input = ShotInput {
            barrel_material: "bamboo".to_string(),
            propellant_type: "meal".to_string(),
            refinement_level: 55.0,
            projectile_type: "lead_arrow".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "uneven".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };
        let result = run_simulation(input);
        let max_vel = result.frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);
        assert!(max_vel >= 40.0, "Era 2 velocity is {}, expected >= 40 m/s", max_vel);
        assert!(!result.outcomes.contains(&"barrel_failure".to_string()));
    }

    #[test]
    fn test_era3_challenge_victory() {
        let input = ShotInput {
            barrel_material: "wrought_iron".to_string(),
            propellant_type: "meal".to_string(),
            refinement_level: 65.0,
            projectile_type: "pebbles".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "uneven".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: Some("wrought_iron".to_string()),
        };
        let result = run_simulation(input);
        let max_vel = result.frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);
        assert!(max_vel >= 30.0, "Era 3 velocity is {}, expected >= 30 m/s", max_vel);
        assert!(!result.outcomes.contains(&"barrel_failure".to_string()));
    }

    #[test]
    fn test_era4_challenge_victory() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 85.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: Some("silk_lamellar".to_string()),
        };
        let result = run_simulation(input);
        let max_vel = result.frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);
        assert!(max_vel >= 90.0, "Era 4 velocity is {}, expected >= 90 m/s", max_vel);
        assert!(!result.outcomes.contains(&"barrel_failure".to_string()));
        assert!(!result.outcomes.contains(&"barrel_deformed".to_string()));
    }

    #[test]
    fn test_era4_challenge_fail_by_deformation() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 100.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "clay".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: None,
        };
        let result = run_simulation(input);
        assert!(result.outcomes.contains(&"barrel_deformed".to_string()), "Cast Bronze with clay wadding and 100% refinement must deform");
    }

    #[test]
    fn test_era5_challenge_victory() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 85.0,
            projectile_type: "rough_stone".to_string(),
            sealing_quality: "clay".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: Some("oak_wood".to_string()),
        };
        let result = run_simulation(input);
        let max_vel = result.frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);
        assert!(max_vel >= 110.0, "Era 5 velocity is {}, expected >= 110 m/s", max_vel);
        assert!(!result.outcomes.contains(&"barrel_failure".to_string()));
    }

    #[test]
    fn test_poncelet_lead_ball_vs_iron() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 85.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: Some("wrought_iron".to_string()),
        };
        let result = run_simulation(input);
        // Ensure final frame y representing penetration is computed and non-zero
        let final_frame = result.frames.last().unwrap();
        assert!(final_frame.projectile_y > 0.0, "Penetration depth must be calculated");
    }

    #[test]
    fn test_poncelet_stone_fracture() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "corned".to_string(),
            refinement_level: 85.0,
            projectile_type: "rough_stone".to_string(),
            sealing_quality: "tow".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: None,
            saltpeter_ratio: None,
            charcoal_ratio: None,
            sulfur_ratio: None,
            charcoal_source: None,
            saltpeter_purity: None,
            weather_protection: None,
            target_armor_type: Some("wrought_iron".to_string()),
        };
        let result = run_simulation(input);
        let final_frame = result.frames.last().unwrap();
        assert!(final_frame.projectile_y > 0.0, "Fracture penetration must be calculated");
    }

    #[test]
    fn test_stoichiometry_byproduct_allocation() {
        let input = ShotInput {
            barrel_material: "cast_bronze".to_string(),
            propellant_type: "meal".to_string(),
            refinement_level: 85.0,
            projectile_type: "lead_ball".to_string(),
            sealing_quality: "none".to_string(),
            weather_humidity: 10.0,
            weather_wind: 5.0,
            weather_rain: 0.0,
            priming_quality: 100.0,
            seed: 42,
            persistent_fouling: 0.0,
            propellant_profile: "steady".to_string(),
            persistent_fatigue: 0.0,
            flaw_seed: 42,
            custom_mix_active: Some(true),
            saltpeter_ratio: Some(50.0),
            charcoal_ratio: Some(40.0),
            sulfur_ratio: Some(10.0),
            charcoal_source: Some("oak".to_string()),
            saltpeter_purity: Some(100.0),
            weather_protection: None,
            target_armor_type: None,
        };
        let result = run_simulation(input);
        // Verify that carbon soot warning is generated in diagnosis card
        let has_warning = result.diagnosis.iter().any(|d| d.explanation.contains("soot") || d.explanation.contains("carbon") || d.title.contains("Carbo"));
        if !has_warning {
            panic!("Diagnosis entries found: {:?}", result.diagnosis);
        }
    }
}

