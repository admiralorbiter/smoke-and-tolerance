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
}

pub const STRIDE_COUNT: usize = 16;

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
        };

        let result = shot::run_simulation(input);
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
        };

        let result = shot::run_simulation(input);
        assert!(result.outcomes.contains(&"barrel_failure".to_string()));
    }
}
