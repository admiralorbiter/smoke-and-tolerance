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
    pub seed: u64,
}

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

#[wasm_bindgen]
pub fn simulate_shot(val: JsValue) -> Result<JsValue, JsValue> {
    let input: ShotInput = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let result = shot::run_simulation(input);

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
