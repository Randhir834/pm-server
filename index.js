const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(compression());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'private, max-age=30');
  }
  next();
});

app.get('/', (req, res) => {
  res.send('CRM API running...');
});



// Import routes here
const authRoutes = require('./routes/authRoutes');
const leadsRoutes = require('./routes/leadsRoutes');
const importantPointsRoutes = require('./routes/importantPointsRoutes');
const projectsRoutes = require('./routes/projectsRoutes');


app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/important-points', importantPointsRoutes);
app.use('/api/projects', projectsRoutes);


// MongoDB Atlas connection with proper options
const connectDB = async () => {
  try {

    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not configured in .env file');
    }
    
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'CRM' // Explicitly set database name
    });
    
    
    
    // Start server only after successful database connection
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Connected to MongoDB Atlas`);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    process.exit(1);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  
  process.exit(0);
});

// Connect to database
connectDB();
