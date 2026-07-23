const express = require('express');

const router = express.Router();

// Mock vehicle database - in production, this would query a real vehicle registry
const vehicleRegistry = {
  'AB-1234-CD': { brand: 'BMW', model: 'X5', year: 2023, mileage: 45000 },
  'EF-5678-GH': { brand: 'Mercedes', model: 'C-Class', year: 2022, mileage: 32000 },
  'IJ-9012-KL': { brand: 'Toyota', model: 'Corolla', year: 2021, mileage: 55000 },
  'MN-3456-OP': { brand: 'Audi', model: 'A4', year: 2023, mileage: 28000 },
  'QR-7890-ST': { brand: 'Renault', model: 'Clio', year: 2020, mileage: 67000 },
};

// POST /api/vehicles/info - Get vehicle info by registration plate
router.post('/info', async (req, res) => {
  try {
    const { immatriculation } = req.body;

    if (!immatriculation) {
      return res.status(400).json({ error: 'immatriculation is required' });
    }

    // Normalize plate format (uppercase, remove spaces)
    const normalized = immatriculation.toUpperCase().replace(/\s/g, '');

    // In production, this would query a real vehicle registry API or database
    // For now, use mock data
    let vehicle = vehicleRegistry[normalized];

    // Generate realistic data if not in mock registry
    if (!vehicle) {
      // For demo purposes, return realistic but random data
      const brands = ['BMW', 'Mercedes', 'Audi', 'Toyota', 'Renault', 'Peugeot', 'Fiat'];
      const models = ['X5', 'C-Class', 'A4', 'Corolla', 'Clio', '308', '500'];

      vehicle = {
        brand: brands[Math.floor(Math.random() * brands.length)],
        model: models[Math.floor(Math.random() * models.length)],
        year: 2020 + Math.floor(Math.random() * 4),
        mileage: 20000 + Math.floor(Math.random() * 100000),
      };
    }

    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
