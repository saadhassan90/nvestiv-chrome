import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { crmRoutes } from './routes/crm.js';
import { searchRoutes } from './routes/search.js';

const app = Fastify({
  logger: false, // We use winston instead
});

// CORS
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow Chrome extension origins, configured origins, and no origin (curl/tests)
    if (!origin) return cb(null, true);

    const allowed = config.CORS_ORIGINS.split(',').map((s) => s.trim());

    for (const pattern of allowed) {
      if (pattern.includes('*')) {
        // Wildcard matching (e.g., chrome-extension://*)
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(origin)) return cb(null, true);
      } else if (origin === pattern) {
        return cb(null, true);
      }
    }

    // Allow localhost in development
    if (config.NODE_ENV === 'development' && origin.includes('localhost')) {
      return cb(null, true);
    }

    cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
});

// Rate limiting
await app.register(rateLimit, {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW_MS,
});

// Auth middleware
app.addHook('onRequest', authMiddleware);

// Health check (before auth)
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0',
}));

// Routes
await app.register(intelligenceRoutes);
await app.register(crmRoutes);
await app.register(searchRoutes);

// Global error handler
app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
  logger.error('Unhandled error', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
  });

  reply.code(error.statusCode ?? 500).send({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

// Start server
try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(`Intelligence API server started on port ${config.PORT}`);
} catch (err) {
  logger.error('Failed to start server', { error: (err as Error).message });
  process.exit(1);
}
