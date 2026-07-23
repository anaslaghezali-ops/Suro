const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

// Envoyer un message de contact
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message, user_id } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const { data, error } = await supabase
      .from('contact_messages')
      .insert([{
        name,
        email,
        subject,
        message,
        user_id: user_id || null,
        status: 'new'
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
