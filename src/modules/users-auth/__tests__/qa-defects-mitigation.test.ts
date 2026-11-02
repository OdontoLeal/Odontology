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
});
