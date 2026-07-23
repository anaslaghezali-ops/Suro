const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware: Check admin role (simplified)
const isAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.use(isAdmin);

// GET /api/admin/dashboard - Dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    // Total applications
    const { count: totalApps } = await supabase
      .from('insurance_applications')
      .select('*', { count: 'exact', head: true });

    // Active policies
    const { count: activeApps } = await supabase
      .from('insurance_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Pending applications (created but not paid)
    const { count: pendingApps } = await supabase
      .from('insurance_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nouvelle');

    // Total revenue (mock - would aggregate payments)
    const { data: paidApps } = await supabase
      .from('insurance_applications')
      .select('id')
      .not('paid_at', 'is', null);

    const totalRevenue = (paidApps?.length || 0) * 120; // Mock: 120 DH per policy

    // Average conversion rate
    const conversionRate = totalApps > 0
      ? Math.round((activeApps / totalApps) * 100)
      : 0;

    res.json({
      totalApplications: totalApps,
      activeApplications: activeApps,
      pendingApplications: pendingApps,
      totalRevenue,
      conversionRate,
      avgTimeInTunnel: '2.5 min',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/applications - List all applications
router.get('/applications', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('insurance_applications')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      applications: data,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/applications/:id - Get application details
router.get('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('insurance_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Get answers for this application
    const { data: answers } = await supabase
      .from('insurance_application_answers')
      .select('*')
      .eq('application_id', id);

    res.json({
      ...data,
      answers: answers || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/applications/:id/status - Update application status
router.put('/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['nouvelle', 'active', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('insurance_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Application status updated',
      application: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/claims - Create/file a claim
router.post('/claims', async (req, res) => {
  try {
    const { application_id, description, claim_type } = req.body;

    const { data, error } = await supabase
      .from('insurance_claims')
      .insert({
        application_id,
        description,
        claim_type,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Claim created',
      claim: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/claims - List all claims
router.get('/claims', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('insurance_claims')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      claims: data,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/claims/:id/status - Update claim status
router.put('/claims/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid claim status' });
    }

    const { data, error } = await supabase
      .from('insurance_claims')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Claim status updated',
      claim: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/payments - Payment analytics
router.get('/payments', async (req, res) => {
  try {
    const { data: paidApps } = await supabase
      .from('insurance_applications')
      .select('id, customer_email, customer_name, paid_at')
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false });

    const totalPaid = paidApps?.length || 0;
    const totalRevenue = totalPaid * 120;

    res.json({
      totalPayments: totalPaid,
      totalRevenue,
      payments: paidApps || [],
      avgPaymentTime: '2.5 min',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/products - Product management
router.get('/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('insurance_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      products: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/products - Create product
router.post('/products', async (req, res) => {
  try {
    const { slug, name, description, icon, active } = req.body;

    const { data, error } = await supabase
      .from('insurance_products')
      .insert({
        slug,
        name,
        description,
        icon,
        active: active || true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Product created',
      product: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
