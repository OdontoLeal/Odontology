// src/app/routes/__tests__/routes.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildAgendaAppointmentPath,
  buildAgendaRequestPath,
  buildConsentSigningPath,
  buildConsultationPath,
  buildHolderDataPath,
  buildLoginUrl,
  buildPatientClinicalHistoryPath,
  buildPatientProfilePath,
  mapPathnameToNavView,
  ROUTES,
  sanitizeInternalRedirect,
} from '../paths';
import {
  calculatePatientAge,
  deriveAccessCapabilities,
  getDefaultInternalRoute,
} from '../access-capabilities';
import { mapRawPatientRecord } from '../patient-hydration';
import { RecoverPasswordUseCase } from '../../../modules/users-auth/application/recover-password.use-case';
import { UsersAuthController } from '../../../modules/users-auth/infrastructure/users-auth.controller';
import { envConfig } from '../../config/env.config';

describe('Enrutamiento SPA, Deep-Linking y Recuperación de Contraseña', () => {
  it('Rutas y constructores de URLs mantienen consistencia entre módulos y detalles', () => {
    assert.strictEqual(ROUTES.PUBLIC_BOOKING, '/');
    assert.strictEqual(ROUTES.LOGIN, '/login');
    assert.strictEqual(ROUTES.RECOVERY, '/recuperar-contrasena');
    assert.strictEqual(ROUTES.PRIVACY_NOTICE, '/aviso-privacidad');

    assert.strictEqual(buildPatientProfilePath(15), '/pacientes/15');
    assert.strictEqual(buildPatientClinicalHistoryPath(15), '/pacientes/15/historia');
    assert.strictEqual(buildConsentSigningPath(15, 3), '/pacientes/15/consentimientos/firmar/3');
    assert.strictEqual(buildConsultationPath(88), '/consulta/88');
    assert.strictEqual(buildAgendaAppointmentPath(88), '/agenda/citas/88');
    assert.strictEqual(buildAgendaRequestPath(12), '/agenda/solicitudes/12');
    assert.strictEqual(buildHolderDataPath('1020 3040'), '/pacientes/titular?doc=1020%203040');
    assert.strictEqual(buildHolderDataPath(), '/pacientes/titular');
  });

  it('sanitizeInternalRedirect previene Open Redirects y bloquea bucles públicos', () => {
    assert.strictEqual(sanitizeInternalRedirect('/pacientes/15'), '/pacientes/15');
    assert.strictEqual(
      sanitizeInternalRedirect('/pacientes/15/historia?tab=1'),
      '/pacientes/15/historia?tab=1'
    );
    assert.strictEqual(sanitizeInternalRedirect('/consulta/42'), '/consulta/42');
    assert.strictEqual(sanitizeInternalRedirect('/agenda/citas/9'), '/agenda/citas/9');

    // URLs externas, protocol-relative o rutas públicas no son destinos post-login válidos
    assert.strictEqual(sanitizeInternalRedirect('https://evil.com/phishing'), null);
    assert.strictEqual(sanitizeInternalRedirect('//evil.com'), null);
    assert.strictEqual(sanitizeInternalRedirect('/\\evil.com'), null);
    assert.strictEqual(sanitizeInternalRedirect('/login'), null);
    assert.strictEqual(sanitizeInternalRedirect('/recuperar-contrasena?token=abc'), null);
    assert.strictEqual(sanitizeInternalRedirect('/'), null);
    assert.strictEqual(sanitizeInternalRedirect('javascript:alert(1)'), null);

    assert.strictEqual(
      buildLoginUrl('/pacientes/42'),
      '/login?redirect=%2Fpacientes%2F42'
    );
    assert.strictEqual(buildLoginUrl('https://evil.com'), '/login');
  });

  it('mapPathnameToNavView sincroniza la barra lateral con rutas principales y detalladas', () => {
    assert.strictEqual(mapPathnameToNavView('/agenda'), 'APPOINTMENTS');
    assert.strictEqual(mapPathnameToNavView('/agenda/citas/12'), 'APPOINTMENTS');
    assert.strictEqual(mapPathnameToNavView('/consulta/12'), 'APPOINTMENTS');
    assert.strictEqual(mapPathnameToNavView('/pacientes'), 'PATIENTS');
    assert.strictEqual(mapPathnameToNavView('/pacientes/12'), 'PATIENTS');
    assert.strictEqual(mapPathnameToNavView('/pacientes/12/historia'), 'PATIENTS');
    assert.strictEqual(mapPathnameToNavView('/usuarios'), 'USERS');
    assert.strictEqual(mapPathnameToNavView('/roles'), 'ROLES');
    assert.strictEqual(mapPathnameToNavView('/consentimientos'), 'CONSENTS');
  });

  it('deriveAccessCapabilities y getDefaultInternalRoute respetan permisos RBAC por rol', () => {
    const adminCaps = deriveAccessCapabilities(
      (p) => ['RF-AGE-008', 'RF-USR-001', 'RF-USR-007', 'RF-HCL-004'].includes(p),
      [{ codigoRol: 'ROL-ADM' }]
    );
    assert.strictEqual(getDefaultInternalRoute(adminCaps), '/agenda');
    assert.strictEqual(adminCaps.isCoordinatorOnly, false);

    const coaCaps = deriveAccessCapabilities(
      (p) => ['RF-AGE-008', 'RF-HCL-004'].includes(p),
      [{ codigoRol: 'ROL-COA' }]
    );
    assert.strictEqual(coaCaps.isCoordinatorOnly, true);
    assert.strictEqual(coaCaps.canViewClinicalHistory, false);

    const usersOnlyCaps = deriveAccessCapabilities((p) => p === 'RF-USR-004', []);
    assert.strictEqual(getDefaultInternalRoute(usersOnlyCaps), '/usuarios');

    const consentsOnlyCaps = deriveAccessCapabilities((p) => p === 'RF-CON-004', []);
    assert.strictEqual(getDefaultInternalRoute(consentsOnlyCaps), '/consentimientos');
  });

  it('mapRawPatientRecord y calculatePatientAge normalizan respuestas de API para deep links', () => {
    const mapped = mapRawPatientRecord({
      idPaciente: 7,
      nombreCompleto: 'Camila Gómez',
      documentoIdentidad: '10102020',
      fechaNacimiento: '2012-06-15T00:00:00.000Z',
      sexo: null,
      correo: 'camila@example.com',
      telefono: '3001234567',
    });

    assert.strictEqual(mapped.idPaciente, 7);
    assert.strictEqual(mapped.fechaNacimiento, '2012-06-15');
    assert.strictEqual(mapped.datosIncompletos, true);
    assert.ok((mapped.edad ?? 0) < 18);
    assert.strictEqual(calculatePatientAge(mapped), mapped.edad);
  });

  it('PublicBookingPage (/) no expone botón Acceso Personal ni enlace discreto en el footer', () => {
    const publicBookingSource = fs.readFileSync(
      'src/modules/appointments/ui/views/PublicBookingPage.tsx',
      'utf8'
    );
    assert.strictEqual(publicBookingSource.includes('onNavigateToStaffLogin'), false);
    assert.strictEqual(publicBookingSource.includes('Acceso Personal'), false);
    assert.strictEqual(publicBookingSource.includes('<PublicNavbar />'), true);
    assert.strictEqual(publicBookingSource.includes('/login'), false);

    const appRouterSource = fs.readFileSync('src/app/routes/AppRouter.tsx', 'utf8');
    const guardsSource = fs.readFileSync('src/app/routes/RouteGuards.tsx', 'utf8');
    assert.strictEqual(appRouterSource.includes('PublicRootGuard'), true);
    assert.strictEqual(guardsSource.includes('ROUTES.RECOVERY'), true);
  });

  it('RecoverPasswordUseCase y UsersAuthController generan enlaces apuntando a /recuperar-contrasena?token=... sin duplicar rutas', async () => {
    const sentLinks: string[] = [];
    const activeUser = {
      idUsuario: 9,
      nombreCompleto: 'Dra. Laura Ríos',
      documentoIdentidad: '12345678',
      correo: 'laura@odontoleal.com',
      telefono: '3001234567',
      estado: true,
      esContrasenaTemporal: false,
      intentosFallidos: 0,
      roles: [],
    };

    const mockRepo: any = {
      findByEmail: async () => activeUser,
      invalidateUserRecoveryTokens: async () => {},
      saveRecoveryToken: async () => {},
    };
    const mockMailer: any = {
      sendPasswordRecoveryEmail: async (params: { recoveryLink: string }) => {
        sentLinks.push(params.recoveryLink);
      },
    };

    const useCase = new RecoverPasswordUseCase(mockRepo, undefined, mockMailer);

    await useCase.requestRecoveryLink({
      correo: 'laura@odontoleal.com',
      baseRecoveryUrl: 'https://odontoleal-1233560f76cb.herokuapp.com/',
    });
    await useCase.requestRecoveryLink({
      correo: 'laura@odontoleal.com',
      baseRecoveryUrl: 'https://odontoleal-1233560f76cb.herokuapp.com/recuperar-contrasena',
    });
    await useCase.requestRecoveryLink({
      correo: 'laura@odontoleal.com',
    });

    // También probamos pasando por UsersAuthController con envConfig.frontendUrl
    const controller = new UsersAuthController(mockRepo, undefined, undefined, mockMailer, {
      log: async () => {},
    } as any);
    let controllerStatus = 200;
    let controllerBody: any = null;
    await controller.requestPasswordRecovery(
      { body: { correo: 'laura@odontoleal.com' } } as any,
      {
        status(code: number) {
          controllerStatus = code;
          return this;
        },
        json(payload: unknown) {
          controllerBody = payload;
          return this;
        },
      } as any
    );

    assert.strictEqual(controllerStatus, 200);
    assert.strictEqual(controllerBody.message, RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE);
    assert.strictEqual(sentLinks.length, 4);
    assert.match(
      sentLinks[0],
      /^https:\/\/odontoleal-1233560f76cb\.herokuapp\.com\/recuperar-contrasena\?token=[a-f0-9]{64}$/
    );
    assert.match(
      sentLinks[1],
      /^https:\/\/odontoleal-1233560f76cb\.herokuapp\.com\/recuperar-contrasena\?token=[a-f0-9]{64}$/
    );
    assert.match(
      sentLinks[2],
      /^http:\/\/localhost:5173\/recuperar-contrasena\?token=[a-f0-9]{64}$/
    );
    const expectedBase = envConfig.frontendUrl.replace(/\/+$/, '');
    const escapedExpected = expectedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      sentLinks[3],
      new RegExp(`^${escapedExpected}(\\/recuperar-contrasena)?\\?token=[a-f0-9]{64}$`)
    );
    assert.strictEqual(sentLinks[3].includes('/recuperar-contrasena?token='), true);
  });
});
