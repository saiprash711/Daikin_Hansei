// ============================================================================
// HANSEI BACKEND - PRODUCTION READY WITH FIXED CORS
// ============================================================================
const express = require('express');
const cors = require('cors');
const { pgPool } = require("./config/database"); // Make sure this line exists
const { ensureUploadHistoryTable } = require("./routes/upload"); // ADD THIS LINE
require('dotenv').config();

// Set development mode for local testing
const isDevelopment = process.env.NODE_ENV !== 'production';

const app = express();
const PORT = process.env.PORT || 3000;

if (isDevelopment) {
  console.log('🔧 Development mode enabled');
}

// ============================================================================
// FIXED CORS CONFIGURATION - Enhanced for local development
// ============================================================================
const allowedOrigins = [
  'http://localhost',
  'http://127.0.0.1', 
  'null', // For local file testing
  'https://chennai-fe.vercel.app', // FIXED: Corrected URL without trailing slash
  'https://chennai-frontend.vercel.app', // Keep both variants just in case
  'https://daikin-n9wy.onrender.com', // Your backend URL
  'https://16f6cc8fd36d.ngrok-free.app', // Current ngrok backend
  'https://*.ngrok-free.app', // Allow all ngrok free domains
  'https://*.ngrok.io' // Allow all ngrok domains
];

// More permissive CORS for development
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 CORS Check - Origin:', origin);
    
    // Always allow requests with no origin in development (file:// access)
    if (!origin) {
      if (isDevelopment) {
        console.log('✅ No origin - allowing request in development (for file:// access)');
        return callback(null, true);
      } else {
        console.log('✅ No origin - allowing request');
        return callback(null, true);
      }
    }

    // Explicitly allow null origin (file:// protocol)
    if (origin === 'null') {
      console.log('✅ Null origin - allowing request (for file:// access)');
      return callback(null, true);
    }

    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Remove trailing slash from both for comparison
      const cleanOrigin = origin.replace(/\/$/, '');
      const cleanAllowed = allowedOrigin.replace(/\/$/, '');
      
      // Handle wildcard domains like *.ngrok-free.app
      if (cleanAllowed.includes('*')) {
        const pattern = cleanAllowed.replace('*', '.*');
        const regex = new RegExp('^' + pattern + '$');
        return regex.test(cleanOrigin);
      }
      
      // Check exact match or startsWith for localhost/127.0.0.1 with different ports
      const exactMatch = cleanOrigin === cleanAllowed;
      const portVariantMatch = (allowedOrigin === 'http://localhost' || allowedOrigin === 'http://127.0.0.1') 
        && cleanOrigin.startsWith(cleanAllowed);
      
      return exactMatch || portVariantMatch;
    });

    if (isAllowed) {
      console.log('✅ CORS: Origin allowed -', origin);
      callback(null, true);
    } else {
      console.error('❌ CORS: Origin not allowed -', origin);
      console.error('📝 Allowed origins:', allowedOrigins);
      // For development, we'll be more permissive but still log the issue
      if (isDevelopment) {
        console.warn('⚠️  Development mode: Allowing origin for debugging purposes');
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Requested-With']
};

// Apply CORS middleware FIRST
app.use(cors(corsOptions));

// Add explicit OPTIONS handling for preflight requests
app.options('*', cors(corsOptions));

// ============================================================================
// BASIC MIDDLEWARE
// ============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (HTML, CSS, JS, images)
app.use(express.static('.'));

// Serve the dashboard from hansei-dashboard folder
app.use('/dashboard', express.static('../hansei-dashboard'));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'null'}`);
  next();
});

// ============================================================================
// HEALTH CHECK ROUTES (MOVED UP FOR PRIORITY)
// ============================================================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hansei Backend is WORKING!',
    cors: 'ENABLED - Fixed Configuration',
    timestamp: new Date().toISOString(),
    origin: req.get('Origin') || 'null'
  });
});

app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested from origin:', req.get('Origin'));
  res.json({ 
    status: 'healthy',
    cors: 'WORKING',
    backend: 'Chennai Backend Connected',
    timestamp: new Date().toISOString(),
    origin: req.get('Origin') || 'null'
  });
});

// Serve dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../hansei-dashboard/index.html'));
});

// ============================================================================
// LOAD EXISTING ROUTES WITH BETTER ERROR HANDLING
// ============================================================================
try {
  const authRoutes = require('./routes/auth');
  const salesRoutes = require('./routes/sales');
  const analyticsRoutes = require('./routes/analytics');
  const { router: uploadRoutes } = require('./routes/upload');
  const chatbotRoutes = require('./routes/chatbot');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/chatbot', chatbotRoutes);

  console.log('✅ All routes loaded successfully');

} catch (error) {
  console.log('⚠️ Warning: Some routes failed to load. Basic functionality will work.');
  console.log('Error details:', error.message);
  
  // Create fallback routes if modules don't exist
  app.use('/api/auth', (req, res) => {
    res.status(503).json({ error: 'Auth service temporarily unavailable' });
  });
  
  app.use('/api/sales', (req, res) => {
    res.status(503).json({ error: 'Sales service temporarily unavailable' });
  });
  
  app.use('/api/analytics', (req, res) => {
    res.status(503).json({ error: 'Analytics service temporarily unavailable' });
  });
  
  app.use('/api/upload', (req, res) => {
    res.status(503).json({ error: 'Upload service temporarily unavailable' });
  });
  
  app.use('/api/chatbot', (req, res) => {
    res.status(503).json({ error: 'Chatbot service temporarily unavailable' });
  });
}

// ============================================================================
// GLOBAL ERROR HANDLING
// ============================================================================
app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler:', err.message);
  
  // Handle CORS errors specifically
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS policy violation', 
      details: err.message,
      allowedOrigins: allowedOrigins 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.path);
  res.status(404).json({ 
    error: 'Endpoint not found', 
    path: req.path,
    availableEndpoints: ['/api/health', '/api/auth', '/api/sales', '/api/analytics', '/api/upload', '/api/chatbot']
  });
});

// ============================================================================
// START SERVER
// ============================================================================
// ADD THIS BLOCK: Make database connection optional
(async () => {
  try {
    const client = await pgPool.connect();
    try {
      await ensureUploadHistoryTable(client);
      console.log("✅ 'upload_history' table ensured in database.");
    } catch (error) {
      console.error("❌ Error ensuring 'upload_history' table:", error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.warn("⚠️ Database connection failed, continuing without database:", error.message);
  }
})();
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ==========================================');
  console.log('🚀 HANSEI BACKEND STARTED SUCCESSFULLY!');
  console.log('🚀 ==========================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌐 Public URL: https://daikin-n9wy.onrender.com`);
  console.log(`🔥 CORS: FIXED & ENABLED`);
  console.log(`✅ Allowed Origins:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log(`🧪 Test: https://daikin-n9wy.onrender.com/api/health`);
  console.log('🚀 ==========================================');
});

// Enhanced error handling
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ ${bind} requires elevated privileges.`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ ${bind} is already in use.`);
      console.error('💡 Try: kill -9 $(lsof -ti:3000) or change PORT in .env');
      process.exit(1);
      break;
    default:
      console.error(`❌ Server error:`, error);
      throw error;
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
});

console.log('🔄 Starting Hansei Backend Server...');
