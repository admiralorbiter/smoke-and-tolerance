pub struct BarrelProperties {
    pub name: &'static str,
    pub r_inner: f64,          // meters
    pub r_outer: f64,          // meters
    pub yield_strength: f64,   // MPa
    pub ultimate_strength: f64,// MPa
    pub elastic_modulus: f64,  // GPa (for flavor or expansions)
    pub flaw_factor: f64,      // stress concentration multiplier
}

impl BarrelProperties {
    pub fn get_by_name(name: &str, flaw_seed: u64) -> Self {
        // Deterministic flaw factor from flaw_seed
        let flaw_rand = ((flaw_seed % 100) as f64) / 100.0; // 0.0 to 1.0

        match name {
            "bamboo" => Self {
                name: "Bamboo",
                r_inner: 0.010,
                r_outer: 0.015,
                yield_strength: 30.0,
                ultimate_strength: 45.0,
                elastic_modulus: 15.0,
                flaw_factor: 1.0 + flaw_rand * 0.1, // very consistent but weak fibers
            },
            "wrought_iron" => Self {
                name: "Wrought Iron Staves",
                r_inner: 0.012,
                r_outer: 0.024,
                yield_strength: 130.0,
                ultimate_strength: 220.0,
                elastic_modulus: 190.0,
                flaw_factor: 1.1 + flaw_rand * 0.4, // high flaw chance from hand-welded seams
            },
            "cast_bronze" | _ => Self {
                name: "Cast Bronze",
                r_inner: 0.012,
                r_outer: 0.028,
                yield_strength: 160.0,
                ultimate_strength: 280.0,
                elastic_modulus: 100.0,
                flaw_factor: 1.0 + flaw_rand * 0.5, // casting bubble voids
            },
        }
    }

    pub fn get_thermal_properties(&self) -> (f64, f64, f64, f64) {
        // Returns (alpha_expansion, heat_capacity, mass, t_limit)
        match self.name {
            "Bamboo" => (5e-6, 1200.0, 0.3, 450.0),
            "Wrought Iron Staves" => (12e-6, 450.0, 1.8, 1800.0),
            _ => (18e-6, 380.0, 2.4, 1200.0), // Bronze
        }
    }

    /// Calculate the von Mises stress at the inner wall using closed-cylinder equations for thick-walled cylinders.
    /// Returns stress in MPa.
    pub fn calculate_von_mises_stress(&self, pressure_mpa: f64, fatigue: f64) -> f64 {
        if pressure_mpa <= 0.0 {
            return 0.0;
        }
        let ri_sq = self.r_inner * self.r_inner;
        let ro_sq = self.r_outer * self.r_outer;
        
        let nominal_stress = pressure_mpa * (3.0_f64.sqrt() * ro_sq) / (ro_sq - ri_sq);
        
        // Crack propagation scales the active flaw factor
        let active_flaw_factor = self.flaw_factor * (1.0 + 0.6 * fatigue);
        nominal_stress * active_flaw_factor
    }

    /// Evaluates if the barrel fails under the given stress (in MPa) taking temperature into account.
    /// Returns (is_ruptured, is_deformed, dynamic_yield, dynamic_ultimate)
    pub fn evaluate_failure_thermal(&self, stress_mpa: f64, barrel_temp: f64) -> (bool, bool, f64, f64) {
        let (_, _, _, t_limit) = self.get_thermal_properties();
        
        // Decay calculation
        let temp_ratio = ((barrel_temp - 293.15) / (t_limit - 293.15)).clamp(0.0, 1.0);
        let strength_sens = match self.name {
            "Bamboo" => 1.8,
            "Wrought Iron Staves" => 0.65,
            _ => 0.85, // Bronze
        };
        
        let strength_mult = (1.0 - strength_sens * temp_ratio * temp_ratio).max(0.1);
        
        let dynamic_yield = self.yield_strength * strength_mult;
        let dynamic_ultimate = self.ultimate_strength * strength_mult;
        
        let is_ruptured = stress_mpa >= dynamic_ultimate;
        let is_deformed = stress_mpa >= dynamic_yield && !is_ruptured;
        
        (is_ruptured, is_deformed, dynamic_yield, dynamic_ultimate)
    }

    pub fn evaluate_failure(&self, stress_mpa: f64) -> (bool, bool) {
        let is_ruptured = stress_mpa >= self.ultimate_strength;
        let is_deformed = stress_mpa >= self.yield_strength && !is_ruptured;
        (is_ruptured, is_deformed)
    }
}
