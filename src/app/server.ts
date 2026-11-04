import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { envConfig } from './config/env.config';
import apiRoutes from './routes/api.routes';
import { CronService } from '../shared/infrastructure/services/cron.service';
import { authMiddleware } from '../shared/infrastructure/security/auth.middleware';
import { db } from '../shared/infrastructure/database/database';

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

// DEF-22, D-23 & CPS-DOC-001-01: Descarga protegida de documentos clínicos
app.get('/storage/clinical-documents/:idPaciente/:filename', authMiddleware, async (req, res) => {
  const user = (req as any).user;
  const roles = user?.roles ?? [];
  const isAllowed = roles.includes('ROL-ODO') || roles.includes('ROL-ESP') || roles.includes('ROL-ADM');

  if (!isAllowed) {
    try {
      await db.query(
        `INSERT INTO log_auditoria (usuario, accion, registro_afectado, detalle) VALUES ($1, $2, $3, $4)`,
        [
          user?.correo || user?.nombreCompleto || 'Desconocido',
          'Intento no autorizado de descarga de documento clínico',
          `paciente:${req.params.idPaciente}`,
          JSON.stringify({ ruta: req.originalUrl, metodo: req.method, roles }),
        ]
      );
    } catch (_) {}

    return res.status(403).json({ message: 'No tiene permiso para realizar esta acción' });
  }

  const { idPaciente, filename } = req.params;
  const storageFilePath = path.resolve(process.cwd(), 'storage/clinical-documents', idPaciente, filename);

  if (fs.existsSync(storageFilePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.sendFile(storageFilePath);
  }

  // Generador on-the-fly si el archivo se solicita directamente por URL
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText('CONSULTORIO ODONTOLÓGICO DR. EDUAR LEAL ÁLVAREZ', {
      x: 50,
      y: 740,
      size: 11,
      font: fontBold,
      color: rgb(0.07, 0.1, 0.15),
    });

    page.drawText('ODONTOLEAL • NIT: 91.245.678-9 • DOCUMENTO CLÍNICO OFICIAL', {
      x: 50,
      y: 725,
      size: 8,
      font: fontRegular,
      color: rgb(0.41, 0.45, 0.5),
    });

    page.drawText(`Documento Clínico - Paciente ID: ${idPaciente}`, {
      x: 50,
      y: 680,
      size: 10,
      font: fontBold,
      color: rgb(0.07, 0.1, 0.15),
    });

    page.drawText(`Archivo: ${filename}`, {
      x: 50,
      y: 660,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.12, 0.14, 0.17),
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    res.status(500).json({ message: 'Error generando PDF: ' + err.message });
  }
});

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

  // Fallback SPA en Express 5 para cualquier ruta GET que no sea /api o /storage
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/storage')) {
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
