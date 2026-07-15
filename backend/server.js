const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const contractsRoutes = require('./routes/contracts');
const claimsRoutes = require('./routes/claims');
const contactRoutes = require('./routes/contact');
const productsRoutes = require('./routes/products');
const applicationsRoutes = require('./routes/applications');
const vehiclesRoutes = require('./routes/vehicles');
const adminRoutes = require('./routes/admin');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SURO API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SURO] Server running on port ${PORT}`);
  console.log(`[SURO] API available at http://localhost:${PORT}/api`);
});
