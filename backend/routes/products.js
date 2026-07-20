const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

// GET /api/products - List all insurance products
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('insurance_products')
      .select('id, slug, name, description, icon, active')
      .eq('active', true);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ products: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:slug - Get product details
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('insurance_products')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:slug/fields - Get form fields for a product
router.get('/:slug/fields', async (req, res) => {
  try {
    const { slug } = req.params;

    // First get the product ID
    const { data: product, error: productError } = await supabase
      .from('insurance_products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Then get the fields
    const { data: fields, error: fieldsError } = await supabase
      .from('insurance_product_fields')
      .select('*')
      .eq('product_id', product.id)
      .order('step_number', { ascending: true })
      .order('order_in_step', { ascending: true });

    if (fieldsError) {
      return res.status(400).json({ error: fieldsError.message });
    }

    // Group fields by step
    const fieldsByStep = {};
    fields.forEach(field => {
      const step = field.step_number || 1;
      if (!fieldsByStep[step]) {
        fieldsByStep[step] = [];
      }
      fieldsByStep[step].push(field);
    });

    res.json({
      product: product,
      fields: fields,
      fieldsByStep: fieldsByStep,
      totalSteps: Object.keys(fieldsByStep).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
