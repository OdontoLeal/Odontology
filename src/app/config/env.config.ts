import dotenv from 'dotenv';
dotenv.config();

export const envConfig = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  security: {
    forceHttps:
      process.env.FORCE_HTTPS !== undefined
        ? process.env.FORCE_HTTPS === 'true'
        : (process.env.NODE_ENV || 'development') === 'production',
    hstsMaxAge: Number(process.env.HSTS_MAX_AGE) || 31536000, // 1 año en segundos (RFC 6797)
    hstsIncludeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
    hstsPreload: process.env.HSTS_PRELOAD === 'true',
  },
  db: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL !== 'false', 
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || '"Consultorio OdontoLeal" <notificaciones@odontoleal.com>',
    secure: process.env.SMTP_SECURE === 'true',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};