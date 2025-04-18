const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// File: app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


// Routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const routineRoutes = require('./routes/routine');
const preferencesRoutes = require('./routes/preferences');
const scheduleRoutes = require('./routes/schedule');



// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/schedule', scheduleRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;