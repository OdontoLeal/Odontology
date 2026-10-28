// src/app/routes/api.routes.ts
import { Router } from 'express';
import { db } from '../../shared/infrastructure/database/database';

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
router.post('/auth/login', usersController.login);
router.post('/auth/logout', usersController.logout);
router.post('/auth/recovery/request', usersController.requestPasswordRecovery);
router.post('/auth/recovery/reset', usersController.resetPasswordWithToken);

router.post('/roles', usersController.createRole);
router.get('/roles', usersController.getRoles);
router.put('/roles/:id', usersController.updateRole);
router.delete('/roles/:id', usersController.deleteRole);

router.post('/users', usersController.createUser);
router.get('/users', usersController.searchUsers);
router.put('/users/:id', usersController.updateUser);
router.patch('/users/:id/status', usersController.toggleUserStatus);

// 2. Rutas Módulo B: Agendamiento de Citas
router.post('/appointments/slots', appointmentsController.upsertTimeSlot);
router.get('/appointments/available-slots', appointmentsController.getAvailableSlots);
router.post('/appointments/generate-day-slots', appointmentsController.generateDaySlots);
router.patch('/appointments/slots/toggle', appointmentsController.toggleSlotStatus);
router.get('/appointments/slots', appointmentsController.getTimeSlots);
router.get('/appointments/monthly-summary', appointmentsController.getMonthlySummary);
router.get('/appointments/requests', appointmentsController.getRequests);
router.get('/appointments/requests/:id', appointmentsController.getRequestById);
router.post('/appointments/public-requests', appointmentsController.requestAppointmentPublic);
router.post('/appointments/requests/:id/review', appointmentsController.reviewRequest);
router.post('/appointments', appointmentsController.scheduleAppointment);
router.put('/appointments/:id', appointmentsController.updateAppointment);
router.patch('/appointments/:id/state', appointmentsController.changeState);
router.get('/appointments/agenda', appointmentsController.getAgenda);

// 3. Rutas Módulo C (Parte 1): Pacientes
router.post('/patients', patientsController.createPatient);
router.put('/patients/:id', patientsController.updatePatient);
router.get('/patients', patientsController.searchPatients);
router.get('/patients/:id', patientsController.getPatientProfile);

// 4. Rutas Módulo C (Parte 2): Historia Clínica, Odontograma y Evolución
router.post('/clinical-records/evolutions', clinicalRecordsController.createEntry);
router.put('/clinical-records/evolutions/:idEvolucion', clinicalRecordsController.updateEntry);
router.get('/clinical-records/patient/:idPaciente', clinicalRecordsController.getHistoryByPatient);

// 5. Rutas Módulo D: Consentimientos Informados
router.post('/consents/templates', consentsController.createTemplate);
router.put('/consents/templates/:id', consentsController.updateTemplate);
router.patch('/consents/templates/:id/status', consentsController.toggleStatus);
router.get('/consents/templates', consentsController.getTemplates);
router.post('/consents/sign', consentsController.signConsent);
router.get('/consents/patient/:idPaciente', consentsController.getPatientConsents);

// 6. Rutas Módulo E: Documentos Clínicos
router.post('/clinical-documents', clinicalDocumentsController.generateDocument);
router.get('/clinical-documents/patient/:idPaciente', clinicalDocumentsController.getPatientDocuments);

export default router;
