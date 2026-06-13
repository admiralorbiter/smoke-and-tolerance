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
    pub fn get_by_name(name: &str, seed: u64) -> Self {
        // Deterministic flaw factor from seed
        let flaw_rand = ((seed % 100) as f64) / 100.0; // 0.0 to 1.0

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

    /// Calculate maximum hoop stress at the inner wall using Lamé equations for thick-walled cylinders.
    /// Returns stress in MPa.
    pub fn calculate_hoop_stress(&self, pressure_mpa: f64) -> f64 {
        if pressure_mpa <= 0.0 {
            return 0.0;
        }
        let ri_sq = self.r_inner * self.r_inner;
        let ro_sq = self.r_outer * self.r_outer;
        
        let nominal_stress = pressure_mpa * (ro_sq + ri_sq) / (ro_sq - ri_sq);
        nominal_stress * self.flaw_factor
    }

    /// Evaluates if the barrel fails under the given stress (in MPa).
    /// Returns (is_ruptured, is_deformed)
    pub fn evaluate_failure(&self, stress_mpa: f64) -> (bool, bool) {
        let is_ruptured = stress_mpa >= self.ultimate_strength;
        let is_deformed = stress_mpa >= self.yield_strength && !is_ruptured;
        (is_ruptured, is_deformed)
    }
}
