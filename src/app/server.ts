import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { envConfig } from './config/env.config';
import apiRoutes from './routes/api.routes';

const app = express();

// Habilitar trust proxy para reconocer HTTPS y encabezados detrás del proxy inverso de Heroku
app.set('trust proxy', 1);

app.use(cors());
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
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(envConfig.port, () => {
  console.log(`🚀 Servidor OdontoLeal ejecutándose en puerto ${envConfig.port}`);
});
