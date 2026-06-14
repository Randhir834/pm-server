const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

// Validate critical environment variables
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'somereallylongrandomsecret') {
  console.error('❌ FATAL: JWT_SECRET is not set or is using default value. Please set a secure JWT_SECRET in .env file.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('❌ FATAL: MONGO_URI is not set. Please set MONGO_URI in .env file.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5001;

// CORS Configuration - only allow specific origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());

// Add request size limits to prevent payload attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'private, max-age=30');
  }
  next();
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  };
  res.status(200).json(healthCheck);
});

app.get('/', (req, res) => {
  res.send('CRM API running...');
});



// Import routes here
const authRoutes = require('./routes/authRoutes');
const leadsRoutes = require('./routes/leadsRoutes');
const importantPointsRoutes = require('./routes/importantPointsRoutes');
const projectsRoutes = require('./routes/projectsRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const salaryRoutes = require('./routes/salaryRoutes');


app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/important-points', importantPointsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/salary', salaryRoutes);


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
