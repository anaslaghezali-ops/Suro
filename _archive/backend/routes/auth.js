const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Inscription
router.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Hash du mot de passe
    const password_hash = await bcrypt.hash(password, 10);

    // Insérer l'utilisateur dans Supabase
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash,
        first_name,
        last_name,
        phone
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const user = data[0];
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Récupérer l'utilisateur
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, data.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Mettre à jour last_login
    await supabase
      .from('users')
      .update({ last_login: new Date() })
      .eq('id', data.id);

    const token = generateToken(data.id, data.email);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
