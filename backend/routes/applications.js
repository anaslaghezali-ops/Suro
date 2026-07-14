const express = require('express');
const { supabase } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/applications - Create a new application
router.post('/', async (req, res) => {
  try {
    const { product_id, customer_name, customer_email, customer_phone } = req.body;

    if (!product_id || !customer_email) {
      return res.status(400).json({ error: 'product_id and customer_email are required' });
    }

    const { data, error } = await supabase
      .from('insurance_applications')
      .insert([{
        product_id,
        customer_name,
        customer_email,
        customer_phone,
        status: 'nouvelle'
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Application created successfully',
      application: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/applications/:id - Get application details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('insurance_applications')
      .select(`
        *,
        product:product_id(id, slug, name),
        answers:insurance_application_answers(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/applications/:id/answers - Save answers for an application
router.post('/:id/answers', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // Array of { field_key, field_value }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array' });
    }

    // Delete existing answers for this application (for simplicity, or update them)
    // For now, we'll just insert new ones (they will accumulate)
    const answersToInsert = answers.map(answer => ({
      application_id: id,
      field_key: answer.field_key,
      field_value: answer.field_value
    }));

    const { data, error } = await supabase
      .from('insurance_application_answers')
      .insert(answersToInsert)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Answers saved successfully',
      answers: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/applications/:id/status - Update application status (admin)
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const { data, error } = await supabase
      .from('insurance_applications')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Status updated successfully',
      application: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/applications - List all applications (admin)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { product_slug, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    let query = supabase
      .from('insurance_applications')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        status,
        created_at,
        product:product_id(slug, name)
      `);

    if (product_slug) {
      const { data: product } = await supabase
        .from('insurance_products')
        .select('id')
        .eq('slug', product_slug)
        .single();
      if (product) {
        query = query.eq('product_id', product.id);
      }
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ applications: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/applications/:id/payment - Process payment for an application
router.post('/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { method, amount, currency = 'MAD' } = req.body;

    if (!method || !amount) {
      return res.status(400).json({ error: 'payment method and amount are required' });
    }

    // In production, this would integrate with Stripe, MTN Mobile Money, or other payment providers
    // For now, we'll simulate successful payment
    const paymentId = 'PAY-' + Date.now().toString();

    // Update application status to active
    const { data, error } = await supabase
      .from('insurance_applications')
      .update({ status: 'active', paid_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Payment processed successfully',
      payment: {
        id: paymentId,
        application_id: id,
        method,
        amount,
        currency,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      application: data[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
