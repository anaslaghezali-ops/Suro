const express = require('express');
const { supabase } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Lister les sinistres de l'utilisateur
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Vérifier que l'utilisateur ne peut accéder qu'à ses propres sinistres
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ claims: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un nouveau sinistre
router.post('/', verifyToken, async (req, res) => {
  try {
    const { contract_id, incident_date, incident_location, description, amount_claimed } = req.body;
    const user_id = req.user.userId;

    // Générer un numéro de sinistre unique
    const claim_number = `CLM-${Date.now()}`;

    const { data, error } = await supabase
      .from('claims')
      .insert([{
        user_id,
        contract_id,
        claim_number,
        incident_date,
        incident_location,
        description,
        amount_claimed,
        status: 'submitted'
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Claim submitted successfully',
      claim: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
