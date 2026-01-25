const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// API rate limits
const apiLimits = {
  // General API calls - 100 requests per 15 minutes
  general: createRateLimit(15 * 60 * 1000, 100, 'Too many API requests, please try again later'),
  
  // Authentication endpoints - 20 attempts per 15 minutes (increased for development)
  auth: createRateLimit(15 * 60 * 1000, 20, 'Too many authentication attempts, please try again later'),
  
  // Batch creation - 10 requests per hour
  batchCreation: createRateLimit(60 * 60 * 1000, 10, 'Too many batch creation requests, please try again later'),
  
  // Loan applications - 3 requests per hour
  loanApplication: createRateLimit(60 * 60 * 1000, 3, 'Too many loan applications, please try again later'),
  
  // Credit scoring - 5 requests per hour
  creditScoring: createRateLimit(60 * 60 * 1000, 5, 'Too many credit scoring requests, please try again later'),
  
  // QR code generation - 20 requests per hour
  qrGeneration: createRateLimit(60 * 60 * 1000, 20, 'Too many QR code generation requests, please try again later'),
  
  // ZK proof generation - 3 requests per hour
  zkProofGeneration: createRateLimit(60 * 60 * 1000, 3, 'Too many ZK proof generation requests, please try again later')
};

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://agrifinance.com',
      'https://www.agrifinance.com',
      'https://app.agrifinance.com',
      'https://51e46684-e9cb-4dd6-9c5c-805bb29968aa.preview.emergentagent.com'
    ];
    
    // Also allow any .emergent.host or .emergentagent.com domain
    if (origin.endsWith('.emergent.host') || origin.endsWith('.emergentagent.com')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'X-Nonce', 'X-Timestamp']
};

// Request signing middleware
const requestSigning = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const nonce = req.headers['x-nonce'];
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];
  
  // Skip signing for public endpoints
  const publicEndpoints = ['/api/health', '/api/docs', '/api/status'];
  if (publicEndpoints.includes(req.path)) {
    return next();
  }
  
  // Validate required headers
  if (!apiKey || !nonce || !timestamp || !signature) {
    return res.status(401).json({ error: 'Missing required security headers' });
  }
  
  // Validate timestamp (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(now - requestTime);
  
  if (timeDiff > 300000) { // 5 minutes
    return res.status(401).json({ error: 'Request timestamp too old' });
  }
  
  // Validate nonce (prevent replay attacks)
  if (nonceCache.has(nonce)) {
    return res.status(401).json({ error: 'Nonce already used' });
  }
  
  // Store nonce (expire after 5 minutes)
  nonceCache.set(nonce, true);
  setTimeout(() => nonceCache.delete(nonce), 300000);
  
  // Verify signature
  const expectedSignature = generateSignature(req, apiKey, nonce, timestamp);
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

// Nonce cache to prevent replay attacks
const nonceCache = new Map();

// Generate request signature
const generateSignature = (req, apiKey, nonce, timestamp) => {
  const method = req.method;
  const path = req.path;
  const body = JSON.stringify(req.body || {});
  
  const message = `${method}${path}${body}${nonce}${timestamp}`;
  const secret = process.env.API_SECRET_KEY || 'default-secret';
  
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
};

// Input validation middleware
const inputValidation = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// SQL injection protection
const sqlInjectionProtection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/gi,
    /(UNION\s+SELECT)/gi,
    /(DROP\s+TABLE)/gi,
    /(DELETE\s+FROM)/gi,
    /(INSERT\s+INTO)/gi,
    /(UPDATE\s+SET)/gi
  ];
  
  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    return sqlPatterns.some(pattern => pattern.test(str));
  };
  
  const checkObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) return true;
      } else if (checkString(obj[key])) {
        return true;
      }
    }
    return false;
  };
  
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({ error: 'Potentially malicious input detected' });
  }
  
  next();
};

// XSS protection
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
  ];
  
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return xssPatterns.reduce((clean, pattern) => clean.replace(pattern, ''), str);
  };
  
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      } else if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      }
    }
  };
  
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);
  
  next();
};

// Request logging middleware
const requestLogging = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    };
    
    // Log security events
    if (res.statusCode >= 400) {
      console.warn('🚨 Security Event:', logData);
    } else {
      console.log('📊 Request:', logData);
    }
  });
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: isDevelopment ? err.message : 'Invalid input data'
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      details: isDevelopment ? err.message : 'Invalid credentials'
    });
  }
  
  if (err.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      details: 'Too many requests, please try again later'
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: 'Internal server error',
    details: isDevelopment ? err.message : 'Something went wrong'
  });
};

// Health check endpoint
const healthCheck = (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
};

module.exports = {
  apiLimits,
  securityHeaders,
  corsOptions,
  requestSigning,
  inputValidation,
  sqlInjectionProtection,
  xssProtection,
  requestLogging,
  errorHandler,
  healthCheck
};





