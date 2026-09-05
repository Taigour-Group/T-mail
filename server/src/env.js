import 'dotenv/config';
import { z } from 'zod';

// Validate + normalize environment once at boot. Fail fast with a clear message.
const schema = z.object({
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5273'),

  EMAIL_DOMAIN: z.string().min(1).default('tgo.com'),

  TGO_ISSUER: z.string().url(),
  TMAIL_CLIENT_ID: z.string().min(1),
  TMAIL_CLIENT_SECRET: z.string().min(1),
  TMAIL_REDIRECT_URI: z.string().url(),

  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 chars'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  TMAIL_SERVICE_TOKEN: z.string().min(16, 'TMAIL_SERVICE_TOKEN must be at least 16 chars'),

  SYSTEM_SENDER_NOREPLY: z.string().default('no-reply@tgo.com'),
  SYSTEM_SENDER_SECURITY: z.string().default('security@tgo.com'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('✖ Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCopy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

const e = parsed.data;

export const env = {
  port: e.PORT,
  nodeEnv: e.NODE_ENV,
  isProd: e.NODE_ENV === 'production',
  webOrigin: e.WEB_ORIGIN,
  emailDomain: e.EMAIL_DOMAIN.toLowerCase(),

  oidc: {
    issuer: e.TGO_ISSUER.replace(/\/$/, ''),
    clientId: e.TMAIL_CLIENT_ID,
    clientSecret: e.TMAIL_CLIENT_SECRET,
    redirectUri: e.TMAIL_REDIRECT_URI,
  },

  cookieSecret: e.COOKIE_SECRET,

  supabase: {
    url: e.SUPABASE_URL,
    serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
  },

  serviceToken: e.TMAIL_SERVICE_TOKEN,

  systemSenders: {
    noReply: e.SYSTEM_SENDER_NOREPLY.toLowerCase(),
    security: e.SYSTEM_SENDER_SECURITY.toLowerCase(),
  },
};
