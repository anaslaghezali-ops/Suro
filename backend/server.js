const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Routes
app.post('/api/auth/signup', require('./routes/auth'));
app.post('/api/auth/login', require('./routes/auth'));
app.post('/api/subscribe', require('./routes/subscribe'));
app.post('/api/claims', require('./routes/claims'));
app.get('/api/contracts/:userId', require('./routes/contracts'));
app.get('/api/claims/:userId', require('./routes/claims'));
app.post('/api/contact', require('./routes/contact'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
