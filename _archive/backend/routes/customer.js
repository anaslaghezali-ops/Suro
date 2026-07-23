const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware: Check customer auth
const isCustomerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.customerId = decoded.id;
    req.customerEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/customer/signup - Register new customer
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create customer in Supabase
    const { data, error } = await supabase
      .from('customers')
      .insert({
        email,
        password_hash: hashedPassword,
        name,
        phone,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Generate JWT token
    const token = jwt.sign(
      { id: data.id, email: data.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Customer registered successfully',
      customer: {
        id: data.id,
        email: data.email,
        name: data.name,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customer/login - Login customer
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find customer by email
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !customer) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, customer.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Logged in successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/profile - Get customer profile
router.get('/profile', isCustomerAuth, async (req, res) => {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, email, name, phone, created_at')
      .eq('id', req.customerId)
      .single();

    if (error) throw error;

    res.json({
      customer,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/customer/profile - Update customer profile
router.put('/profile', isCustomerAuth, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const { data, error } = await supabase
      .from('customers')
      .update({
        name,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.customerId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Profile updated',
      customer: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/policies - Get customer's active insurance policies
router.get('/policies', isCustomerAuth, async (req, res) => {
  try {
    // Find applications linked to this customer email
    const { data: applications, error } = await supabase
      .from('insurance_applications')
      .select('*')
      .eq('customer_email', req.customerEmail)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      policies: applications || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/policies/:id - Get policy details
router.get('/policies/:id', isCustomerAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: policy, error } = await supabase
      .from('insurance_applications')
      .select('*')
      .eq('id', id)
      .eq('customer_email', req.customerEmail)
      .single();

    if (error) throw error;

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Get answers for this policy
    const { data: answers } = await supabase
      .from('insurance_application_answers')
      .select('*')
      .eq('application_id', id);

    res.json({
      policy: {
        ...policy,
        answers: answers || [],
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customer/claims - Submit a new claim
router.post('/claims', isCustomerAuth, async (req, res) => {
  try {
    const { policy_id, claim_type, description, claim_date } = req.body;

    if (!policy_id || !claim_type || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify policy belongs to customer
    const { data: policy, error: policyError } = await supabase
      .from('insurance_applications')
      .select('id')
      .eq('id', policy_id)
      .eq('customer_email', req.customerEmail)
      .single();

    if (policyError || !policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Create claim
    const { data: claim, error } = await supabase
      .from('insurance_claims')
      .insert({
        application_id: policy_id,
        customer_id: req.customerId,
        claim_type,
        description,
        claim_date: claim_date || new Date().toISOString(),
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Claim submitted successfully',
      claim,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/claims - Get customer's claims
router.get('/claims', isCustomerAuth, async (req, res) => {
  try {
    const { data: claims, error } = await supabase
      .from('insurance_claims')
      .select('*')
      .eq('customer_id', req.customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      claims: claims || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/claims/:id - Get claim details
router.get('/claims/:id', isCustomerAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: claim, error } = await supabase
      .from('insurance_claims')
      .select('*')
      .eq('id', id)
      .eq('customer_id', req.customerId)
      .single();

    if (error) throw error;

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({
      claim,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/payments - Get payment history
router.get('/payments', isCustomerAuth, async (req, res) => {
  try {
    // Get all active applications for this customer
    const { data: applications } = await supabase
      .from('insurance_applications')
      .select('id, customer_email, paid_at')
      .eq('customer_email', req.customerEmail);

    const payments = applications
      ?.filter(app => app.paid_at)
      .map(app => ({
        id: app.id,
        amount: 120, // Mock amount
        date: app.paid_at,
        status: 'completed',
        policy_id: app.id,
      })) || [];

    res.json({
      payments: payments.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customer/renew - Renew insurance policy
router.post('/renew/:policyId', isCustomerAuth, async (req, res) => {
  try {
    const { policyId } = req.params;

    // Verify policy belongs to customer
    const { data: policy, error: policyError } = await supabase
      .from('insurance_applications')
      .select('*')
      .eq('id', policyId)
      .eq('customer_email', req.customerEmail)
      .single();

    if (policyError || !policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Create new application for renewal
    const { data: newPolicy, error } = await supabase
      .from('insurance_applications')
      .insert({
        product_id: policy.product_id,
        customer_name: policy.customer_name,
        customer_email: policy.customer_email,
        customer_phone: policy.customer_phone,
        coverage_type: policy.coverage_type,
        status: 'nouvelle',
        created_at: new Date().toISOString(),
        renewed_from: policyId,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Policy renewal initiated',
      policy: newPolicy,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/certificate/:policyId - Get policy certificate
router.get('/certificate/:policyId', isCustomerAuth, async (req, res) => {
  try {
    const { policyId } = req.params;

    // Verify policy belongs to customer
    const { data: policy, error: policyError } = await supabase
      .from('insurance_applications')
      .select('id')
      .eq('id', policyId)
      .eq('customer_email', req.customerEmail)
      .single();

    if (policyError || !policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Redirect to admin certificate endpoint
    res.redirect(`/api/applications/${policyId}/certificate`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
