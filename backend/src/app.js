import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = new Set([
  ...config.frontendUrls,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (origin.startsWith('http://localhost:')) return true;
  // Allow all Vercel preview deployments for this project
  if (origin.match(/^https:\/\/allcrm(-[a-z0-9]+)?\.vercel\.app$/)) return true;
  return false;
};

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/tenant/login', authLimiter);
app.use('/api/tenant/signup', authLimiter);

app.use('/api/payment/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  req.rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  try {
    req.body = JSON.parse(req.rawBody || '{}');
  } catch {
    req.body = {};
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Salon CRM API is running',
    health: '/api/health',
  });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
