import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './env.js';
import { notFound, errorHandler } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { threadsRouter } from './routes/threads.js';
import { messagesRouter } from './routes/messages.js';
import { labelsRouter } from './routes/labels.js';
import { attachmentsRouter } from './routes/attachments.js';
import { searchRouter } from './routes/search.js';
import { systemRouter } from './routes/system.js';
import { demoRouter } from './routes/demo.js';

const app = express();
if (env.isProd) app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });

app.get('/health', (req, res) => res.json({ ok: true, service: 'tmail-server', domain: env.emailDomain }));

app.use('/auth', authLimiter, authRouter);

// Transactional (service-auth + its own strict limiter) mounted before the user API.
app.use('/api/system', systemRouter);

app.use('/api', apiLimiter);
app.use('/api/threads', threadsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/labels', labelsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/search', searchRouter);
app.use('/api/demo', demoRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`tmail-server listening on http://localhost:${env.port}  (domain: @${env.emailDomain})`);
  console.log(`OIDC issuer: ${env.oidc.issuer}  |  callback: ${env.oidc.redirectUri}`);
});
