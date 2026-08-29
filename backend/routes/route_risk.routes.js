const express = require('express');
const router = express.Router();
const { analyzeRouteRisk } = require('../utils/routeRiskCalculator');

/**
 * Route Travel Risk API Endpoint
 * POST /api/analyze
 * Body: { current_location, destination, departure_date, departure_time }
 */
router.post('/analyze', async (req, res) => {
  const { current_location, destination, departure_date, departure_time } = req.body;

  if (!current_location || !destination) {
    return res.status(422).json({
      detail: 'Both current_location and destination are required.'
    });
  }

  // Validate departure date within 16 days if specified
  if (departure_date) {
    const depTime = new Date(departure_date).getTime();
    const now = new Date().getTime();
    const diffDays = (depTime - now) / (1000 * 3600 * 24);
    if (diffDays > 16) {
      return res.status(422).json({
        detail: 'Choose a departure within the next 16 days.'
      });
    }
  }

  try {
    const result = await analyzeRouteRisk({
      current_location,
      destination,
      departure_date: departure_date || new Date().toISOString().split('T')[0],
      departure_time: departure_time || '09:00'
    });

    res.json(result);
  } catch (error) {
    console.error('[Route Risk API Error]', error);
    res.status(502).json({
      detail: 'Routing, geocoding, or weather provider could not be reached.'
    });
  }
});

module.exports = router;
