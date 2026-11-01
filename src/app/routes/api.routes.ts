// src/app/routes/api.routes.ts
import { Router } from 'express';
import { db } from '../../shared/infrastructure/database/database';
import { authMiddleware } from '../../shared/infrastructure/security/auth.middleware';

import { UserRepository } from '../../modules/users-auth/infrastructure/user.repository';
import { UsersAuthController } from '../../modules/users-auth/infrastructure/users-auth.controller';

import { AppointmentRepository } from '../../modules/appointments/infrastructure/appointment.repository';
import { AppointmentsController } from '../../modules/appointments/infrastructure/appointments.controller';

import { PatientRepository } from '../../modules/patients/infrastructure/patient.repository';
import { PatientsController } from '../../modules/patients/infrastructure/patients.controller';

import { ClinicalRecordRepository } from '../../modules/clinical-records/infrastructure/clinical-record.repository';
import { ClinicalRecordsController } from '../../modules/clinical-records/infrastructure/clinical-records.controller';

import { ConsentRepository } from '../../modules/consents/infrastructure/consent.repository';
import { ConsentService } from '../../modules/consents/application/consent.service';
import { ConsentsController } from '../../modules/consents/infrastructure/consents.controller';

import { ClinicalDocumentRepository } from '../../modules/clinical-documents/infrastructure/clinical-document.repository';
import { ClinicalDocumentsController } from '../../modules/clinical-documents/infrastructure/clinical-documents.controller';

const router = Router();

const usersController = new UsersAuthController(new UserRepository());
const appointmentsController = new AppointmentsController(new AppointmentRepository());
const patientsController = new PatientsController(new PatientRepository());
const clinicalRecordsController = new ClinicalRecordsController(new ClinicalRecordRepository());
const consentsController = new ConsentsController(new ConsentService(new ConsentRepository()));
const clinicalDocumentsController = new ClinicalDocumentsController(new ClinicalDocumentRepository());

// 0. Healthcheck de conexión a Heroku Postgres (RQNF-FIA-001)
router.get('/health', async (_req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS "horaServidorColombia", current_database() AS "bdHeroku";');
    res.status(200).json({ status: 'OK', database: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// 1. Rutas Módulo A: Usuarios, Roles y Autenticación (RF-USR-001 a RF-USR-011)
// 1.1 Rutas públicas de acceso y recuperación (RF-USR-005, RF-USR-009)
router.post('/auth/login', usersController.login);
router.post('/auth/recovery/request', usersController.requestPasswordRecovery);
router.post('/auth/recovery/reset', usersController.resetPasswordWithToken);

// 1.2 Rutas autenticadas de administración de usuarios y roles (RQNF-SEG-003)
router.post('/auth/logout', authMiddleware, usersController.logout);

router.post('/roles', authMiddleware, usersController.createRole);
router.get('/roles', authMiddleware, usersController.getRoles);
router.put('/roles/:id', authMiddleware, usersController.updateRole);
router.delete('/roles/:id', authMiddleware, usersController.deleteRole);

// Alias de compatibilidad hacia atrás para contratos de roles (I1-005, I1-006)
router.post('/auth/roles', authMiddleware, usersController.createRole);
router.get('/auth/roles', authMiddleware, usersController.getRoles);
router.put('/auth/roles/:id', authMiddleware, usersController.updateRole);
router.delete('/auth/roles/:id', authMiddleware, usersController.deleteRole);

router.post('/users', authMiddleware, usersController.createUser);
router.get('/users', authMiddleware, usersController.searchUsers);
router.put('/users/:id', authMiddleware, usersController.updateUser);
router.patch('/users/:id/status', authMiddleware, usersController.toggleUserStatus);

// 2. Rutas Módulo B: Agendamiento de Citas
// 2.1 Rutas públicas del portal de pacientes (RF-AGE-003, RF-AGE-012, RF-USR-006)
router.get('/appointments/available-slots', appointmentsController.getAvailableSlots);
router.post('/appointments/public-requests', appointmentsController.requestAppointmentPublic);

// 2.2 Rutas internas protegidas de agenda y gestión (RQNF-SEG-003)
router.post('/appointments/slots', authMiddleware, appointmentsController.upsertTimeSlot);
router.post('/appointments/generate-day-slots', authMiddleware, appointmentsController.generateDaySlots);
router.patch('/appointments/slots/toggle', authMiddleware, appointmentsController.toggleSlotStatus);
router.get('/appointments/slots', authMiddleware, appointmentsController.getTimeSlots);
router.get('/appointments/monthly-summary', authMiddleware, appointmentsController.getMonthlySummary);
router.get('/appointments/requests', authMiddleware, appointmentsController.getRequests);
router.get('/appointments/requests/:id', authMiddleware, appointmentsController.getRequestById);
router.post('/appointments/requests/:id/review', authMiddleware, appointmentsController.reviewRequest);
router.post('/appointments', authMiddleware, appointmentsController.scheduleAppointment);
router.put('/appointments/:id', authMiddleware, appointmentsController.updateAppointment);
router.patch('/appointments/:id/state', authMiddleware, appointmentsController.changeState);
router.get('/appointments/agenda', authMiddleware, appointmentsController.getAgenda);

// 3. Rutas Módulo C (Parte 1): Pacientes (RQNF-SEG-003)
// DEF-15 & CPS-HCL-010-01: Rutas de datos de titular registradas ANTES de /patients/:id para evitar colisión
router.get('/patients/holder/:documento', authMiddleware, patientsController.exportHolderData);
router.get('/patients/holder', authMiddleware, patientsController.exportHolderData);
router.get('/patients/holder-data/:documento', authMiddleware, patientsController.exportHolderData);
router.get('/patients/holder-data', authMiddleware, patientsController.exportHolderData);

router.post('/patients', authMiddleware, patientsController.createPatient);
router.get('/patients', authMiddleware, patientsController.searchPatients);
router.put('/patients/:id', authMiddleware, patientsController.updatePatient);
router.get('/patients/:id', authMiddleware, patientsController.getPatientProfile);

// 4. Rutas Módulo C (Parte 2): Historia Clínica, Odontograma y Evolución (RQNF-SEG-003)
// DEF-15 & CPS-HCL-007-03: Ruta publicada del último odontograma
router.get('/clinical-records/odontogram/latest/:idPaciente', authMiddleware, clinicalRecordsController.getLatestOdontogram);
router.get('/clinical-records/odontogram/latest', authMiddleware, clinicalRecordsController.getLatestOdontogram);

router.post('/clinical-records', authMiddleware, clinicalRecordsController.createEntry);
router.put('/clinical-records/:idEvolucion', authMiddleware, clinicalRecordsController.updateEntry);
router.post('/clinical-records/evolutions', authMiddleware, clinicalRecordsController.createEntry);
router.put('/clinical-records/evolutions/:idEvolucion', authMiddleware, clinicalRecordsController.updateEntry);
router.get('/clinical-records/patient/:idPaciente', authMiddleware, clinicalRecordsController.getHistoryByPatient);

// 5. Rutas Módulo D: Consentimientos Informados (ERS v1.2)
// DEF-21 & CPS-CON-002-02, CPS-CON-006-01: Rutas de token y sesión para firma en Tablet
router.post('/consents/tablet-token', authMiddleware, consentsController.createTabletToken);
router.get('/consents/tablet-session/:token', consentsController.getTabletSession);
router.post('/consents/tablet-sign/:token', consentsController.submitTabletSigning);

// 5.1 Firma de consentimiento dentro de la sesión clínica (RF-CON-001, RF-CON-002, RF-CON-005)
router.post('/consents/sign', authMiddleware, consentsController.signConsent);

// 5.2 Rutas internas protegidas de plantillas y consulta clínica (RQNF-SEG-003, RF-CON-003, RF-CON-004, RF-CON-007, RF-CON-008)
router.post('/consents/templates', authMiddleware, consentsController.createTemplate);
router.put('/consents/templates/:id', authMiddleware, consentsController.updateTemplate);
router.patch('/consents/templates/:id/status', authMiddleware, consentsController.toggleStatus);
router.get('/consents/templates', authMiddleware, consentsController.getTemplates);
router.get('/consents/patient/:idPaciente', authMiddleware, consentsController.getPatientConsents);
router.get('/consents/:id/pdf', authMiddleware, consentsController.getConsentPdf);

// 6. Rutas Módulo E: Documentos Clínicos (RQNF-SEG-003)
router.post('/clinical-documents', authMiddleware, clinicalDocumentsController.generateDocument);
router.get('/clinical-documents/patient/:idPaciente', authMiddleware, clinicalDocumentsController.getPatientDocuments);

export default router;
