const express = require('express');
const { supabase } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Lister les contrats de l'utilisateur
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Vérifier que l'utilisateur ne peut accéder qu'à ses propres contrats
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        plans:plan_id(*),
        vehicle_info(*)
      `)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ contracts: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un nouveau contrat
router.post('/', verifyToken, async (req, res) => {
  try {
    const { plan_id, vehicle_id, start_date, premium_amount } = req.body;
    const user_id = req.user.userId;

    // Générer un numéro de contrat unique
    const contract_number = `SRO-${Date.now()}`;

    const { data, error } = await supabase
      .from('contracts')
      .insert([{
        user_id,
        plan_id,
        vehicle_id,
        contract_number,
        start_date,
        premium_amount,
        status: 'active',
        payment_status: 'pending'
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Contract created successfully',
      contract: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
