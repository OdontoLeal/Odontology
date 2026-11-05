// src/app/routes/api.routes.ts
import { Router } from 'express';
import { db } from '../../shared/infrastructure/database/database';
import { authMiddleware, requirePermission } from '../../shared/infrastructure/security/auth.middleware';

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

/**
 * Rutas de la API (RQNF-SEG-003).
 *
 * Cada ruta interna exige sesión (`authMiddleware`) y el permiso del RF que
 * implementa (`requirePermission`), leído de `rol.permisos`. Las reglas que
 * dependen del contexto (profesional responsable de la cita, auxiliar con la
 * cita En consulta) se validan además en cada módulo.
 */
const router = Router();
const auth = authMiddleware;
const can = requirePermission;

const usersController = new UsersAuthController(new UserRepository());
const appointmentsController = new AppointmentsController(new AppointmentRepository());
const patientsController = new PatientsController(new PatientRepository());
const clinicalRecordsController = new ClinicalRecordsController(new ClinicalRecordRepository());
const consentsController = new ConsentsController(new ConsentService(new ConsentRepository()));
const clinicalDocumentsController = new ClinicalDocumentsController(new ClinicalDocumentRepository());

// 0. Healthcheck (RQNF-FIA-001)
router.get('/health', async (_req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS "horaServidorColombia";');
    res.status(200).json({ status: 'OK', database: result.rows[0] });
  } catch {
    res.status(500).json({ status: 'ERROR', message: 'Base de datos no disponible.' });
  }
});

// ---------------------------------------------------------------------------
// Sección pública (sin sesión): RF-USR-005, RF-USR-006, RF-USR-009, RF-AGE-003,
// RQNF-SEG-006
// ---------------------------------------------------------------------------
router.post('/auth/login', usersController.login);
router.post('/auth/recovery/request', usersController.requestPasswordRecovery);
router.post('/auth/recovery/reset', usersController.resetPasswordWithToken);
router.get('/appointments/available-slots', appointmentsController.getAvailableSlots);
router.post('/appointments/public-requests', appointmentsController.requestAppointmentPublic);
router.get('/public/privacy-notice', consentsController.getPrivacyNotice);

// ---------------------------------------------------------------------------
// Módulo A — Usuarios, roles y sesión
// ---------------------------------------------------------------------------
router.post('/auth/logout', auth, usersController.logout);
router.get('/auth/drafts', auth, usersController.getDrafts);
router.delete('/auth/drafts/:formularioId', auth, usersController.deleteDraft);

router.post('/roles', auth, can('RF-USR-007'), usersController.createRole);
router.get(
  '/roles',
  auth,
  can('RF-USR-007', 'RF-USR-010', 'RF-USR-011', 'RF-USR-001', 'RF-USR-002', 'RF-USR-004'),
  usersController.getRoles
);
router.put('/roles/:id', auth, can('RF-USR-010'), usersController.updateRole);
router.delete('/roles/:id', auth, can('RF-USR-011'), usersController.deleteRole);

router.post('/users', auth, can('RF-USR-001'), usersController.createUser);
router.get('/users', auth, can('RF-USR-004', 'RF-USR-001', 'RF-USR-002', 'RF-USR-003'), usersController.searchUsers);
router.put('/users/:id', auth, can('RF-USR-002'), usersController.updateUser);
router.patch('/users/:id/status', auth, can('RF-USR-003'), usersController.toggleUserStatus);

// ---------------------------------------------------------------------------
// Módulo B — Agenda
// ---------------------------------------------------------------------------
router.post('/appointments/slots', auth, can('RF-AGE-001'), appointmentsController.upsertTimeSlot);
router.post('/appointments/generate-day-slots', auth, can('RF-AGE-001'), appointmentsController.generateDaySlots);
router.patch('/appointments/slots/toggle', auth, can('RF-AGE-001'), appointmentsController.toggleSlotStatus);
router.get(
  '/appointments/slots',
  auth,
  can('RF-AGE-001', 'RF-AGE-002', 'RF-AGE-005', 'RF-AGE-006', 'RF-AGE-008'),
  appointmentsController.getTimeSlots
);
router.get('/appointments/monthly-summary', auth, can('RF-AGE-008'), appointmentsController.getMonthlySummary);
router.get('/appointments/requests', auth, can('RF-AGE-005', 'RF-AGE-008'), appointmentsController.getRequests);
router.get('/appointments/requests/:id', auth, can('RF-AGE-005', 'RF-AGE-008'), appointmentsController.getRequestById);
router.post('/appointments/requests/:id/review', auth, can('RF-AGE-005'), appointmentsController.reviewRequest);
router.post('/appointments', auth, can('RF-AGE-002'), appointmentsController.scheduleAppointment);
router.put('/appointments/:id', auth, can('RF-AGE-006'), appointmentsController.updateAppointment);
// Cancelar (RF-AGE-007), iniciar/finalizar (RF-AGE-009) o marcar inasistencia (RF-AGE-012):
// el permiso exacto se valida según el estado pedido.
router.patch(
  '/appointments/:id/state',
  auth,
  can('RF-AGE-007', 'RF-AGE-009', 'RF-AGE-012'),
  appointmentsController.changeState
);
router.get('/appointments/agenda', auth, can('RF-AGE-008'), appointmentsController.getAgenda);

// ---------------------------------------------------------------------------
// Módulo C — Pacientes (datos de identificación y contacto)
// ---------------------------------------------------------------------------
router.get('/patients/holder-data/:documento', auth, can('RF-HCL-010'), patientsController.exportHolderData);
router.get('/patients/holder-data', auth, can('RF-HCL-010'), patientsController.exportHolderData);
router.post('/patients', auth, can('RF-HCL-001'), patientsController.createPatient);
router.get('/patients', auth, can('RF-HCL-003', 'RF-AGE-002'), patientsController.searchPatients);
router.put('/patients/:id', auth, can('RF-HCL-002'), patientsController.updatePatient);
router.get('/patients/:id', auth, can('RF-HCL-004'), patientsController.getPatientProfile);

// ---------------------------------------------------------------------------
// Módulo C — Historia clínica, odontograma y evolución (Regla de Negocio 4)
// ---------------------------------------------------------------------------
router.get(
  '/clinical-records/odontogram/latest/:idPaciente',
  auth,
  can('RF-HCL-007'),
  clinicalRecordsController.getLatestOdontogram
);
// Historia de la consulta en curso: profesional responsable o auxiliar con la cita En consulta.
router.get(
  '/clinical-records/appointment/:idCita',
  auth,
  can('RF-HCL-005', 'RF-HCL-007', 'RF-HCL-009'),
  clinicalRecordsController.getConsultationRecord
);
router.post(
  '/clinical-records/evolutions',
  auth,
  can('RF-HCL-005', 'RF-HCL-007', 'RF-HCL-009'),
  clinicalRecordsController.createEntry
);
router.put(
  '/clinical-records/evolutions/:idEvolucion',
  auth,
  can('RF-HCL-006', 'RF-HCL-007', 'RF-HCL-009'),
  clinicalRecordsController.updateEntry
);
// Historial clínico completo: solo ROL-ODO y ROL-ESP (RF-HCL-008).
router.get('/clinical-records/patient/:idPaciente', auth, can('RF-HCL-008'), clinicalRecordsController.getHistoryByPatient);

// ---------------------------------------------------------------------------
// Módulo D — Consentimientos informados (ERS v1.3: sin firma por enlace/QR)
// ---------------------------------------------------------------------------
router.post('/consents/sign', auth, can('RF-CON-002'), consentsController.signConsent);
router.post('/consents/templates', auth, can('RF-CON-004'), consentsController.createTemplate);
router.put('/consents/templates/:id', auth, can('RF-CON-007'), consentsController.updateTemplate);
router.patch('/consents/templates/:id/status', auth, can('RF-CON-008'), consentsController.toggleStatus);
router.get(
  '/consents/templates',
  auth,
  can('RF-CON-001', 'RF-CON-004', 'RF-CON-007', 'RF-CON-008'),
  consentsController.getTemplates
);
router.get('/consents/patient/:idPaciente', auth, can('RF-CON-001', 'RF-CON-003'), consentsController.getPatientConsents);
router.get('/consents/:id/pdf', auth, can('RF-CON-003'), consentsController.getConsentPdf);

// ---------------------------------------------------------------------------
// Módulo E — Documentos clínicos: PDF en memoria, sin almacenar (RF-DOC-001 a 004)
// ---------------------------------------------------------------------------
router.post(
  '/clinical-documents',
  auth,
  can('RF-DOC-001', 'RF-DOC-002', 'RF-DOC-003'),
  clinicalDocumentsController.generateDocument
);

export default router;
