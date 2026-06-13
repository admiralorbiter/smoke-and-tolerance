use crate::{ShotInput, ShotFrame, ShotResult, DiagnosisEntry};

pub fn generate_result(
    input: ShotInput,
    frames: Vec<ShotFrame>,
    outcomes: Vec<String>,
) -> ShotResult {
    let mut diagnosis = Vec::new();
    let mut summary = String::new();

    // 1. Process Misfires
    let has_misfire = outcomes.contains(&"misfire".to_string()) 
        || outcomes.contains(&"misfire_rain".to_string()) 
        || outcomes.contains(&"misfire_wind".to_string());

    if has_misfire {
        if outcomes.contains(&"misfire_rain".to_string()) {
            summary = "The rain soaked the touch-hole priming powder, preventing ignition.".to_string();
            diagnosis.push(DiagnosisEntry {
                severity: "critical".to_string(),
                title: "Priming Washed Out".to_string(),
                explanation: format!(
                    "Early firearms have exposed priming configurations. Moisture from the rain ({:.0}%) soaked the priming mix, extinguishing the heat before it could reach the chamber. Consider using touch-hole protections like Oiled Parchment or a Pan Cover in wet weather.",
                    input.weather_rain
                ),
            });
        } else if outcomes.contains(&"misfire_wind".to_string()) {
            summary = "The wind blew the priming powder away from the touch-hole.".to_string();
            diagnosis.push(DiagnosisEntry {
                severity: "critical".to_string(),
                title: "Priming Powder Blown Away".to_string(),
                explanation: format!(
                    "Under high winds ({:.0}%), the loose priming powder sitting on the touch-hole was scattered before the match could ignite it. Using a Pan Shield or Operator Cowl can help block the wind.",
                    input.weather_wind
                ),
            });
        } else {
            summary = "The touch-hole sparked, but the main charge did not ignite.".to_string();
            diagnosis.push(DiagnosisEntry {
                severity: "critical".to_string(),
                title: "Incomplete Ignition Chain".to_string(),
                explanation: "The match made contact, but humidity or poor grain consistency prevented the fire from transferring down the touch-hole. Higher saltpeter refinement or dryer conditions improve ignition reliability.".to_string(),
            });
        }
        
        return ShotResult {
            input,
            frames,
            outcomes,
            diagnosis,
            summary,
        };
    }

    // Find peak pressure and stress in the simulation
    let peak_pressure = frames.iter().map(|f| f.pressure).fold(0.0, f64::max);
    let peak_stress = frames.iter().map(|f| f.barrel_stress).fold(0.0, f64::max);
    let final_velocity = frames.iter().map(|f| f.projectile_velocity).fold(0.0, f64::max);

    // 2. Process Catastrophic Failures
    if outcomes.contains(&"barrel_failure".to_string()) {
        summary = format!(
            "Catastrophic failure: The barrel ruptured under a peak stress of {:.1} MPa.",
            peak_stress
        );

        match input.barrel_material.as_str() {
            "bamboo" => {
                diagnosis.push(DiagnosisEntry {
                    severity: "critical".to_string(),
                    title: "Bamboo Fiber Splitting".to_string(),
                    explanation: "Bamboo lacks the tensile strength to withstand high-pressure gas. The combination of fast-burning corned powder or tight wadding caused a pressure spike that split the fibers along the grain.".to_string(),
                });
            }
            "wrought_iron" => {
                diagnosis.push(DiagnosisEntry {
                    severity: "critical".to_string(),
                    title: "Weld Seam Failure".to_string(),
                    explanation: "Wrought iron barrels of this era were formed by forge-welding iron bars together. The extreme peak stress found a microscopic flaw in the longitudinal weld, causing a structural breach.".to_string(),
                });
            }
            "cast_bronze" | _ => {
                diagnosis.push(DiagnosisEntry {
                    severity: "critical".to_string(),
                    title: "Casting Void Fracture".to_string(),
                    explanation: "Bronze casting is susceptible to gas bubbles trapping inside the mold. The high chamber pressure concentrated around these hollow voids, initiating a brittle fracture that ruptured the barrel.".to_string(),
                });
            }
        }

        if input.sealing_quality == "clay" {
            diagnosis.push(DiagnosisEntry {
                severity: "warning".to_string(),
                title: "Clay Plug Pressure Overload".to_string(),
                explanation: "Packing the bore with clay created an airtight seal, preventing any windage escape. This forced gas to build to extreme levels before the projectile could budge, exceeding the barrel's material tolerance.".to_string(),
            });
        }

        if input.propellant_type == "corned" {
            diagnosis.push(DiagnosisEntry {
                severity: "info".to_string(),
                title: "Corned Powder Stress Peak".to_string(),
                explanation: "Granulated powder burns almost instantly compared to meal powder, causing a rapid pressure rise that hammer-struck the barrel walls before the projectile could accelerate.".to_string(),
            });
        }

        return ShotResult {
            input,
            frames,
            outcomes,
            diagnosis,
            summary,
        };
    }

    // 3. Process Stuck Projectile
    if outcomes.contains(&"stuck_projectile".to_string()) {
        if input.projectile_type == "none" {
            summary = "The incendiary packet burned completely inside the tube.".to_string();
            diagnosis.push(DiagnosisEntry {
                severity: "info".to_string(),
                title: "Open Burn Combustion".to_string(),
                explanation: "Without a projectile to seal the bore, pressure could not build up. The propellant burned as a slow, smoky alchemical flame venting directly into the open air.".to_string(),
            });
        } else {
            summary = "The projectile failed to leave the barrel.".to_string();
            
            if input.sealing_quality == "clay" {
                diagnosis.push(DiagnosisEntry {
                    severity: "critical".to_string(),
                    title: "Clay Jammed in Bore".to_string(),
                    explanation: "The clay plug wadding baked or jammed inside the barrel, creating a resistance too high for the weak gas pressure to overcome.".to_string(),
                });
            } else if input.weather_humidity > 60.0 && input.propellant_type == "meal" {
                diagnosis.push(DiagnosisEntry {
                    severity: "critical".to_string(),
                    title: "Sluggish Damp Burn".to_string(),
                    explanation: "The combination of meal powder and high humidity resulted in a slow, weak combustion. The pressure failed to reach the static friction threshold required to launch the heavy projectile.".to_string(),
                });
            } else {
                diagnosis.push(DiagnosisEntry {
                    severity: "critical".to_string(),
                    title: "Insufficent Propulsion".to_string(),
                    explanation: "Gas leaked too quickly around the loose-fitting projectile, collapsing the pressure before it could push the mass out of the bore.".to_string(),
                });
            }
        }

        return ShotResult {
            input,
            frames,
            outcomes,
            diagnosis,
            summary,
        };
    }

    // 4. Process Successful Launches (Hits vs. Misses)
    let is_hit = outcomes.contains(&"target_hit".to_string());
    
    if is_hit {
        summary = format!(
            "Successful shot! The projectile hit the target at {:.1} m/s.",
            final_velocity
        );
        diagnosis.push(DiagnosisEntry {
            severity: "info".to_string(),
            title: "Balanced Tolerances".to_string(),
            explanation: "You achieved a correct balance: the sealing minimized gas leakage, the propellant burned completely, and the projectile traveled smoothly with a predictable trajectory.".to_string(),
        });
    } else {
        summary = format!(
            "Shot missed. Muzzle velocity was {:.1} m/s but the trajectory strayed.",
            final_velocity
        );

        if input.projectile_type == "pebbles" {
            diagnosis.push(DiagnosisEntry {
                severity: "warning".to_string(),
                title: "Severe Gravel Scatter".to_string(),
                explanation: "Firing raw pebbles behaves like a shotgun spray. The light particles separated immediately at the muzzle, losing energy rapidly to air resistance and scattering wide of the target.".to_string(),
            });
        } else if input.projectile_type == "rough_stone" {
            diagnosis.push(DiagnosisEntry {
                severity: "warning".to_string(),
                title: "Rough Stone Rattling".to_string(),
                explanation: "The irregular surface and shape of the hand-carved stone caused it to bounce along the bore. This rattled the barrel, scraping the walls and deflecting the projectile off-target during muzzle exit.".to_string(),
            });
        }

        if input.sealing_quality == "none" {
            diagnosis.push(DiagnosisEntry {
                severity: "warning".to_string(),
                title: "Excessive Windage Leakage".to_string(),
                explanation: "With no wadding or bore packing, gas rushed past the projectile gap. You lost significant kinetic energy, resulting in a weak muzzle velocity and low flight path.".to_string(),
            });
        }
    }

    // General warnings / notes
    if outcomes.contains(&"barrel_deformed".to_string()) {
        diagnosis.push(DiagnosisEntry {
            severity: "warning".to_string(),
            title: "Micro-structural Strain".to_string(),
            explanation: "The peak hoop stress exceeded the barrel's yield limit. While it did not burst, the barrel has warped, increasing future friction and structural vulnerability.".to_string(),
        });
    }

    if input.weather_humidity > 50.0 {
        diagnosis.push(DiagnosisEntry {
            severity: "info".to_string(),
            title: "Humidity Fouling".to_string(),
            explanation: "Damp air leaves a sticky, sulfurous soot deposit inside the barrel. Firing again without clearing the bore will increase friction and risk jamming subsequent shots.".to_string(),
        });
    }

    ShotResult {
        input,
        frames,
        outcomes,
        diagnosis,
        summary,
    }
}
