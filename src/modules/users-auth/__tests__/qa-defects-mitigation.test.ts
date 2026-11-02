// src/modules/users-auth/__tests__/qa-defects-mitigation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleHttpError } from '../../../shared/infrastructure/http/http-error.handler';
import { UsersAuthController } from '../infrastructure/users-auth.controller';
import { AppointmentsController } from '../../appointments/infrastructure/appointments.controller';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe('VERIFICACIÓN Y MITIGACIÓN DE DEFECTOS QA (D-01 a D-14)', () => {
  const dummyRepo: any = {};
  const usersCtrl = new UsersAuthController(dummyRepo);
  const apptsCtrl = new AppointmentsController(dummyRepo);

  it('D-03: Login rechaza cuerpo vacío o ausente con código 400 (no 401 ni TypeError)', async () => {
    const reqEmpty: any = { body: {} };
    const resEmpty = createMockResponse();
    await usersCtrl.login(reqEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 400);
    assert.match(resEmpty.body.message, /cuerpo de la solicitud es obligatorio/i);

    const reqMissingFields: any = { body: { correo: 'test@correo.com' } };
    const resMissing = createMockResponse();
    await usersCtrl.login(reqMissingFields, resMissing);
    assert.strictEqual(resMissing.statusCode, 400);
    assert.match(resMissing.body.message, /contrasena/i);
  });

  it('D-03: Crear rol rechaza cuerpo vacío o sin campos obligatorios con código 400', async () => {
    const reqEmpty: any = { body: {} };
    const resEmpty = createMockResponse();
    await usersCtrl.createRole(reqEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 400);
    assert.match(resEmpty.body.message, /cuerpo de la solicitud es obligatorio/i);

    const reqNoCode: any = { body: { nombreRol: 'Rol Prueba' } };
    const resNoCode = createMockResponse();
    await usersCtrl.createRole(reqNoCode, resNoCode);
    assert.strictEqual(resNoCode.statusCode, 400);
    assert.match(resNoCode.body.message, /codigo/i);
  });

  it('D-08: toggleUserStatus rechaza string "false" o payload vacío con código 400', async () => {
    const reqStringFalse: any = { params: { id: '5' }, body: { estado: 'false' } };
    const resStringFalse = createMockResponse();
    await usersCtrl.toggleUserStatus(reqStringFalse, resStringFalse);
    assert.strictEqual(resStringFalse.statusCode, 400);
    assert.match(resStringFalse.body.message, /estrictamente de tipo booleano/i);

    const reqEmpty: any = { params: { id: '5' }, body: {} };
    const resEmpty = createMockResponse();
    await usersCtrl.toggleUserStatus(reqEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 400);
    assert.match(resEmpty.body.message, /estrictamente de tipo booleano/i);
  });

  it('D-13: reviewRequest rechaza petición sin campo aprobar booleano con código 400', async () => {
    const reqEmpty: any = { params: { id: '10' }, body: {} };
    const resEmpty = createMockResponse();
    await apptsCtrl.reviewRequest(reqEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 400);
    assert.match(resEmpty.body.message, /aprobar.*estrictamente de tipo booleano/i);

    const reqStringAprobar: any = { params: { id: '10' }, body: { aprobar: 'true' } };
    const resString = createMockResponse();
    await apptsCtrl.reviewRequest(reqStringAprobar, resString);
    assert.strictEqual(resString.statusCode, 400);
    assert.match(resString.body.message, /aprobar.*estrictamente de tipo booleano/i);
  });

  it('D-07: handleHttpError oculta detalles crudos de PostgreSQL y retorna 500 para fallos de BD', () => {
    const res500 = createMockResponse();
    const errorPgFatal = new Error('getaddrinfo ENOTFOUND heroku-postgres.aws.com');
    handleHttpError(res500, errorPgFatal, 400);
    assert.strictEqual(res500.statusCode, 500);
    assert.strictEqual(res500.body.message, 'Error interno en el servidor. Por favor intente más tarde.');
    assert.strictEqual(String(res500.body.message).includes('heroku-postgres'), false);

    const resConstraint = createMockResponse();
    const errorConstraint = new Error('duplicate key value violates unique constraint "paciente_documento_identidad_key"');
    (errorConstraint as any).code = '23505';
    handleHttpError(resConstraint, errorConstraint, 400);
    assert.strictEqual(resConstraint.statusCode, 400);
    assert.match(resConstraint.body.message, /ya existe un registro/i);
    assert.strictEqual(String(resConstraint.body.message).includes('paciente_documento_identidad_key'), false);
  });

  it('DEF-04: changeState exige motivo obligatorio al cancelar o rechazar cita con código 400', async () => {
    const reqCancelNoMotif: any = {
      params: { id: '1' },
      body: { nuevoEstado: 'Cancelada' },
      user: { idUsuario: 1, roles: ['ROL-ADM'] },
    };
    const resCancelNoMotif = createMockResponse();
    await apptsCtrl.changeState(reqCancelNoMotif, resCancelNoMotif);
    assert.strictEqual(resCancelNoMotif.statusCode, 400);
    assert.match(resCancelNoMotif.body.message, /motivo de cancelación.*obligatorio/i);

    const reqRejectNoMotif: any = {
      params: { id: '1' },
      body: { nuevoEstado: 'Rechazada' },
      user: { idUsuario: 1, roles: ['ROL-ADM'] },
    };
    const resRejectNoMotif = createMockResponse();
    await apptsCtrl.changeState(reqRejectNoMotif, resRejectNoMotif);
    assert.strictEqual(resRejectNoMotif.statusCode, 400);
    assert.match(resRejectNoMotif.body.message, /motivo de rechazo.*obligatorio/i);

    const reqReviewRejectNoMotif: any = {
      params: { id: '10' },
      body: { aprobar: false },
      user: { idUsuario: 1, roles: ['ROL-COA'] },
    };
    const resReviewReject = createMockResponse();
    await apptsCtrl.reviewRequest(reqReviewRejectNoMotif, resReviewReject);
    assert.strictEqual(resReviewReject.statusCode, 400);
    assert.match(resReviewReject.body.message, /motivo de rechazo.*obligatorio/i);
  });

  it('DEF-08: review-request y repo no inventan fecha fija ni teléfono dummy cuando el usuario no los envía', async () => {
    const fs = await import('fs');
    const repoCode = fs.readFileSync('src/modules/appointments/infrastructure/appointment.repository.ts', 'utf8');

    // Confirmar que no hay números ni correos dummy hardcodeados en el repositorio de citas
    assert.strictEqual(repoCode.includes('+57 318 459 2011'), false);
    assert.strictEqual(repoCode.includes('paciente@odontoleal.com'), false);
    assert.strictEqual(repoCode.includes('eduard.leal@gmail.com'), false);

    const useCaseCode = fs.readFileSync('src/modules/appointments/application/review-request.use-case.ts', 'utf8');
    // Confirmar que no inventa fecha fija 2000-01-01
    assert.strictEqual(useCaseCode.includes("new Date('2000-01-01')"), false);
  });

  it('DEF-16: El repositorio y las consultas de agenda exponen "agendadoPor" para la ficha del paciente', async () => {
    const fs = await import('fs');
    const repoCode = fs.readFileSync('src/modules/appointments/infrastructure/appointment.repository.ts', 'utf8');
    const patRepoCode = fs.readFileSync('src/modules/patients/infrastructure/patient.repository.ts', 'utf8');
    const patProfileUi = fs.readFileSync('src/modules/patients/ui/views/PatientProfilePage.tsx', 'utf8');

    // Comprobar que getAgenda extrae agendadoPor
    assert.strictEqual(repoCode.includes('AS "agendadoPor"'), true);
    // Comprobar que la ficha del paciente en repositorio extrae agendadoPor
    assert.strictEqual(patRepoCode.includes("'agendadoPor'"), true);
    // Comprobar que la vista React de la ficha del paciente renderiza "Agendado por:"
    assert.strictEqual(patProfileUi.includes('Agendado por:'), true);
  });

  it('DEF-27: El repositorio incluye el script DDL canónico y el comando npm db:init protegido', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Comprobar existencia del archivo de esquema DDL
    const schemaPath = path.resolve(process.cwd(), 'database/schema.sql');
    assert.strictEqual(fs.existsSync(schemaPath), true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const requiredTables = [
      'rol',
      'usuario',
      'usuario_rol',
      'plantilla_consentimiento',
      'paciente',
      'bloques_horario',
      'solicitud_cita',
      'historial_solicitud',
      'cita',
      'bloques_citas',
      'historial_cita',
      'consentimiento_firmado',
      'historia_clinica',
      'evolucion',
      'auditoria_historia_clinica',
    ];

    for (const table of requiredTables) {
      assert.strictEqual(
        schemaContent.toLowerCase().includes(`create table if not exists public.${table}`) ||
        schemaContent.toLowerCase().includes(`create table if not exists ${table}`),
        true,
        `Falta la tabla ${table} en database/schema.sql`
      );
    }

    // Comprobar que package.json expone el comando db:init
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.strictEqual(typeof pkg.scripts['db:init'], 'string');
    assert.match(pkg.scripts['db:init'], /init-db\.ts/);
  });
});
