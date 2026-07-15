const express = require('express');
const PDFDocument = require('pdfkit');
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

// GET /api/applications/:id/certificate - Generate insurance certificate PDF
router.get('/:id/certificate', async (req, res) => {
  try {
    const { id } = req.params;

    // Get application details
    const { data: application, error: appError } = await supabase
      .from('insurance_applications')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        status,
        created_at,
        product:product_id(slug, name)
      `)
      .eq('id', id)
      .single();

    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `SURO-Insurance-${id}.pdf`;

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('SURO', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Assurance Automobile', { align: 'center', color: '#0F766E' });
    doc.moveDown(1);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text('Carte Verte d\'Assurance', { align: 'center' });
    doc.moveDown(0.5);

    // Separator line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown(1);

    // Certificate number
    doc.fontSize(10).font('Helvetica').text('Numéro de Certificat:', { continued: true });
    doc.fontSize(12).font('Helvetica-Bold').text(` SR-${id.substring(0, 8).toUpperCase()}`);
    doc.moveDown(0.5);

    // Issue date
    doc.fontSize(10).font('Helvetica').text('Date d\'émission:', { continued: true });
    const issueDate = new Date().toLocaleDateString('fr-FR');
    doc.fontSize(12).font('Helvetica-Bold').text(` ${issueDate}`);
    doc.moveDown(0.5);

    // Valid from
    doc.fontSize(10).font('Helvetica').text('Valide à partir de:', { continued: true });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    doc.fontSize(12).font('Helvetica-Bold').text(` ${tomorrow.toLocaleDateString('fr-FR')}`);
    doc.moveDown(1.5);

    // Policyholder section
    doc.fontSize(12).font('Helvetica-Bold').text('Assuré');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom: ${application.customer_name || 'Non fourni'}`);
    doc.text(`Email: ${application.customer_email || 'Non fourni'}`);
    doc.text(`Téléphone: ${application.customer_phone || 'Non fourni'}`);
    doc.moveDown(1);

    // Coverage section
    doc.fontSize(12).font('Helvetica-Bold').text('Couverture');
    doc.fontSize(10).font('Helvetica');
    doc.text('✓ Vol et Incendie');
    doc.text('✓ Responsabilité Civile');
    doc.text('✓ Assistance 24/7');
    doc.text('✓ Première quittance demain');
    doc.moveDown(1.5);

    // Amount section
    doc.fontSize(12).font('Helvetica-Bold').text('Tarif');
    doc.fontSize(10).font('Helvetica').text('Tarif personnalisé selon votre couverture');
    doc.moveDown(1.5);

    // Footer
    doc.fontSize(9).font('Helvetica').text('Souscription entièrement digitalisée par SURO', { align: 'center', color: '#999' });
    doc.text('Cette assurance est valide jusqu\'au premier paiement confirmé', { align: 'center', color: '#999' });
    doc.text('Pour toute question: support@suro.ma | www.suro.ma', { align: 'center', color: '#999' });

    // End PDF
    doc.end();
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
