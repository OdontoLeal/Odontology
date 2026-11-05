import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { envConfig } from './config/env.config';
import apiRoutes from './routes/api.routes';
import { CronService } from '../shared/infrastructure/services/cron.service';

const app = express();

// Habilitar trust proxy para reconocer HTTPS y encabezados detrás del proxy inverso de Heroku
app.set('trust proxy', 1);

// D-05: Restricción estricta de CORS compatible con Heroku y desarrollo local
const allowedOrigins = [
  envConfig.frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
].filter(Boolean);

app.use((req, res, next) => {
  cors({
    origin: (origin, callback) => {
      // 1. Permitir peticiones sin origen (curl, pruebas, herramientas internas o mobile)
      if (!origin) return callback(null, true);

      // 2. Permitir desarrollo local
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return callback(null, true);
      }

      // 3. Permitir orígenes de Heroku (*.herokuapp.com)
      try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('.herokuapp.com')) {
          return callback(null, true);
        }
      } catch {
        // En caso de formato de URL no estándar
      }

      // 4. Permitir si coincide con el host actual (monolito donde Express sirve el SPA en dist/public)
      const host = req.get('host');
      if (host && (origin === `https://${host}` || origin === `http://${host}`)) {
        return callback(null, true);
      }

      // 5. Permitir si está en la lista blanca explícita de FRONTEND_URL
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Rechazar orígenes externos no autorizados sin romper la aplicación
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })(req, res, next);
});
app.use(express.json({ limit: '5mb' }));

// Rutas API v1
app.use('/api/v1', apiRoutes);

// Alias de compatibilidad hacia atrás para contratos de autenticación legados (I1-004)
app.use('/api/users-auth', (req, res, next) => {
  req.url = `/auth${req.url}`;
  apiRoutes(req, res, next);
});

// Servir el frontend SPA compilado en modo producción (Monolito modular)
const clientDistPath = path.resolve(process.cwd(), 'dist/public');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Fallback SPA en Express 5 para cualquier ruta GET que no sea /api
  // (los PDF clínicos ya no se sirven como archivos: se generan en memoria, RF-DOC-001 a 004)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Iniciar servicio de Cron Jobs en segundo plano (DEF-10)
CronService.start();

app.listen(envConfig.port, () => {
  console.log(`🚀 Servidor OdontoLeal ejecutándose en puerto ${envConfig.port}`);
});
