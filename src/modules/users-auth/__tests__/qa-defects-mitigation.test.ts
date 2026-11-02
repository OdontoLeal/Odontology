import fs from 'node:fs';
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
  it('ROLES: Roles en Doctores y Equipo vienen dinámicamente de la BD y no están quemados', async () => {
    // Verificar que UsersManagementPage define onFetchRoles y no depende únicamente de DEFAULT_ROLES_FALLBACK
    const usersPageCode = fs.readFileSync('src/modules/users-auth/ui/views/UsersManagementPage.tsx', 'utf8');
    assert.strictEqual(usersPageCode.includes('onFetchRoles'), true);
    assert.strictEqual(usersPageCode.includes('fetchRolesDirectory'), true);
    assert.strictEqual(usersPageCode.includes("fetch('/api/v1/roles')"), true);

    // Verificar que App.tsx pasa onFetchRoles a UsersManagementPage
    const appCode = fs.readFileSync('src/App.tsx', 'utf8');
    assert.strictEqual(appCode.includes('onFetchRoles={auth.fetchRoles}'), true);
    assert.strictEqual(appCode.includes('refreshCatalogRoles'), true);
  });

  it('ROLES: Creación de rol funcional según el modelo de datos actual y rechaza permisos clínicos y códigos iniciales', async () => {
    const rolesStore: any[] = [
      { id_rol: 1, codigo: 'ROL-ADM', nombre_rol: 'Administrador del Sistema', permisos: ['RF-USR-001'], es_inicial: true },
      { id_rol: 2, codigo: 'ROL-ODO', nombre_rol: 'Odontólogo General', permisos: ['RF-HCL-005'], es_inicial: true },
    ];
    let nextId = 3;

    const mockRepo: any = {
      findAllRoles: async () => rolesStore,
      createRole: async (nombreRol: string, meta: any) => {
        const created = {
          id_rol: nextId++,
          codigo: meta?.codigo ?? 'ROL-GEN',
          nombre_rol: nombreRol,
          descripcion: meta?.descripcion ?? '',
          permisos: meta?.permisos ?? [],
          es_inicial: false,
        };
        rolesStore.push(created);
        return created;
      },
      countUsersByRole: async () => 0,
    };

    const ctrl = new UsersAuthController(mockRepo);

    // 1. Rechaza código reservado para roles iniciales
    const reqReserved: any = {
      body: {
        codigo: 'ROL-ADM',
        nombreRol: 'Nuevo Administrador',
        permisos: ['RF-AGE-008'],
      },
    };
    const resReserved = createMockResponse();
    await ctrl.createRole(reqReserved, resReserved);
    assert.strictEqual(resReserved.statusCode, 400);
    assert.match(resReserved.body.message, /reservado para los roles iniciales/i);

    // 2. Rechaza asignación de permisos clínicos a nuevos roles
    const reqClinical: any = {
      body: {
        codigo: 'ROL-PRU',
        nombreRol: 'Rol Prueba Clínico',
        permisos: ['RF-HCL-005'],
      },
    };
    const resClinical = createMockResponse();
    await ctrl.createRole(reqClinical, resClinical);
    assert.strictEqual(resClinical.statusCode, 400);
    assert.match(resClinical.body.message, /permiso clínico/i);

    // 3. Creación exitosa de rol configurable válido
    const reqValid: any = {
      body: {
        codigo: 'ROL-AUD',
        nombreRol: 'Auditor Externo',
        descripcion: 'Rol de prueba para auditorías de calidad',
        permisos: ['RF-AGE-008', 'RF-USR-004'],
      },
    };
    const resValid = createMockResponse();
    await ctrl.createRole(reqValid, resValid);
    assert.strictEqual(resValid.statusCode, 201);
    assert.strictEqual(resValid.body.data.codigo, 'ROL-AUD');
    assert.strictEqual(resValid.body.data.es_inicial, false);
    assert.strictEqual(rolesStore.length, 3);
  });

  it('ROLES: Edición de rol funcional protege permisos clínicos y rechaza nombres duplicados', async () => {
    const rolesStore: any[] = [
      { id_rol: 1, codigo: 'ROL-ADM', nombre_rol: 'Administrador del Sistema', permisos: ['RF-USR-001', 'RF-USR-002', 'RF-USR-003', 'RF-USR-004', 'RF-USR-007', 'RF-USR-010', 'RF-USR-011'], es_inicial: true },
      { id_rol: 2, codigo: 'ROL-AUD', nombre_rol: 'Auditor Externo', permisos: ['RF-AGE-008'], es_inicial: false, descripcion: 'Inicial' },
    ];

    const mockRepo: any = {
      findAllRoles: async () => rolesStore,
      findRoleById: async (id: number) => rolesStore.find((r) => r.id_rol === id) || null,
      updateRole: async (id: number, data: any) => {
        const target = rolesStore.find((r) => r.id_rol === id);
        if (!target) throw new Error('Rol no encontrado');
        target.nombre_rol = data.nombreRol;
        target.descripcion = data.descripcion;
        target.permisos = data.permisos;
        return target;
      },
      countUsersByRole: async () => 0,
    };

    const ctrl = new UsersAuthController(mockRepo);

    // 1. Rechaza duplicación de nombre con otro rol
    const reqDupName: any = {
      params: { id: '2' },
      body: {
        nombreRol: 'Administrador del Sistema',
        descripcion: 'Intento duplicar nombre',
        permisos: ['RF-AGE-008'],
      },
    };
    const resDup = createMockResponse();
    await ctrl.updateRole(reqDupName, resDup);
    assert.strictEqual(resDup.statusCode, 400);
    assert.match(resDup.body.message, /ya está en uso por otro rol/i);

    // 2. Edición exitosa de rol personalizado
    const reqUpdateValid: any = {
      params: { id: '2' },
      body: {
        nombreRol: 'Auditor de Calidad Senior',
        descripcion: 'Descripción actualizada',
        permisos: ['RF-AGE-008', 'RF-AGE-001'],
      },
    };
    const resUpdateValid = createMockResponse();
    await ctrl.updateRole(reqUpdateValid, resUpdateValid);
    assert.strictEqual(resUpdateValid.statusCode, 200);
    assert.strictEqual(resUpdateValid.body.data.nombre_rol, 'Auditor de Calidad Senior');
    assert.strictEqual(resUpdateValid.body.data.descripcion, 'Descripción actualizada');
  });

  it('ROLES: Eliminación permitida solo para roles no iniciales y si y solo si no tienen usuarios asignados', async () => {
    const rolesStore: any[] = [
      { id_rol: 1, codigo: 'ROL-ADM', nombre_rol: 'Administrador del Sistema', es_inicial: true, permisos: ['RF-USR-001'] },
      { id_rol: 2, codigo: 'ROL-ASIG', nombre_rol: 'Rol Asignado Con Usuarios', es_inicial: false, permisos: ['RF-AGE-008'] },
      { id_rol: 3, codigo: 'ROL-LIBRE', nombre_rol: 'Rol Libre Sin Usuarios', es_inicial: false, permisos: ['RF-AGE-008'] },
    ];

    const mockRepo: any = {
      findAllRoles: async () => rolesStore,
      findRoleById: async (id: number) => rolesStore.find((r) => r.id_rol === id) || null,
      countUsersByRole: async (idRol: number) => {
        if (idRol === 1) return 1;
        if (idRol === 2) return 2; // Tiene 2 usuarios asignados
        return 0; // Rol 3 no tiene usuarios
      },
      deleteRole: async (idRol: number) => {
        const idx = rolesStore.findIndex((r) => r.id_rol === idRol);
        if (idx >= 0) {
          rolesStore.splice(idx, 1);
          return true;
        }
        return false;
      },
    };

    const ctrl = new UsersAuthController(mockRepo);

    // 1. Intento de eliminar rol inicial del sistema -> RECHAZADO (400)
    const reqDelInitial: any = { params: { id: '1' } };
    const resDelInitial = createMockResponse();
    await ctrl.deleteRole(reqDelInitial, resDelInitial);
    assert.strictEqual(resDelInitial.statusCode, 400);
    assert.match(resDelInitial.body.message, /configuración inicial del sistema y no puede ser eliminado/i);

    // 2. Intento de eliminar rol con usuarios asignados -> RECHAZADO (400)
    const reqDelAssigned: any = { params: { id: '2' } };
    const resDelAssigned = createMockResponse();
    await ctrl.deleteRole(reqDelAssigned, resDelAssigned);
    assert.strictEqual(resDelAssigned.statusCode, 400);
    assert.match(resDelAssigned.body.message, /está asignado a 2 usuario/i);

    // 3. Eliminación exitosa de rol no inicial sin usuarios asignados -> PERMITIDO (200)
    const reqDelFree: any = { params: { id: '3' } };
    const resDelFree = createMockResponse();
    await ctrl.deleteRole(reqDelFree, resDelFree);
    assert.strictEqual(resDelFree.statusCode, 200);
    assert.strictEqual(resDelFree.body.eliminado, true);
    assert.strictEqual(rolesStore.some((r) => r.id_rol === 3), false);
  });

  it('CITAS: QuickScheduleModal inicializa sin bloques seleccionados por defecto y consulta por profesional', () => {
    const fileContent = fs.readFileSync('src/modules/appointments/ui/components/QuickScheduleModal.tsx', 'utf8');
    assert.ok(
      fileContent.includes('const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);'),
      'Los bloques seleccionados deben iniciar en un arreglo vacio []'
    );
    assert.ok(
      !fileContent.includes("['14:00-14:30', '14:30-15:00']"),
      'No debe tener bloques quemados por defecto'
    );
    assert.ok(
      fileContent.includes('idProfesional=${selectedDoctorId}'),
      'Debe consultar bloques disponibles filtrando por el profesional seleccionado'
    );
  });

  it('MODALES: AlertModal utiliza z-[100] garantizando que nunca quede detras de formularios', () => {
    const modalContent = fs.readFileSync('src/shared/ui/components/Modal.tsx', 'utf8');
    assert.ok(
      modalContent.includes('zIndex?: string;'),
      'Modal debe admitir prop zIndex personalizable'
    );
    const alertModalContent = fs.readFileSync('src/shared/ui/components/AlertModal.tsx', 'utf8');
    assert.ok(
      alertModalContent.includes('zIndex="z-[100]"'),
      'AlertModal debe pasar zIndex="z-[100]" para superponerse a cualquier modal o formulario'
    );
  });

  it('HABEAS DATA: Certificado adaptable a tamanos Carta, A4 y Oficio con reglas profesionales de impresion', () => {
    const holderContent = fs.readFileSync('src/modules/patients/ui/views/HolderDataQueryPage.tsx', 'utf8');
    assert.ok(
      holderContent.includes('patients = [],'),
      'HolderDataQueryPage debe recibir listado de pacientes para seleccion directa'
    );
    assert.ok(
      holderContent.includes("'LETTER' | 'A4' | 'LEGAL' | 'AUTO'"),
      'Debe soportar tipos de papel LETTER, A4 y LEGAL'
    );
    assert.ok(
      holderContent.includes('size: auto;'),
      'Debe definir @page size: auto para adaptarse a cualquier tamano de papel'
    );
    assert.ok(
      holderContent.includes('break-inside: avoid !important;'),
      'Debe prevenir saltos de pagina indebidos con avoid-break'
    );
    assert.ok(
      holderContent.includes('habeas-sheet-container'),
      'Debe contener clase contenedora adaptable para previsualizacion e impresion'
    );
  });

  it('PACIENTES: Nueva cita muestra estado de carga procesando peticion, cierra formulario y muestra modal de confirmacion', () => {
    // 1. En PatientProfilePage.tsx
    const profileContent = fs.readFileSync('src/modules/patients/ui/views/PatientProfilePage.tsx', 'utf8');
    assert.ok(
      profileContent.includes('const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);'),
      'PatientProfilePage debe controlar la apertura del modal de nueva cita'
    );
    assert.ok(
      profileContent.includes('const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);'),
      'PatientProfilePage debe gestionar el estado de carga durante el agendamiento'
    );
    assert.ok(
      profileContent.includes('setIsScheduleModalOpen(false);'),
      'Al confirmarse la cita debe desaparecer el formulario cerrando el modal'
    );
    assert.ok(
      profileContent.includes("title: '¡Cita Confirmada Exitosamente!'"),
      'Al confirmarse debe aparecer el modal de alerta con confirmacion exitosa'
    );
    assert.ok(
      profileContent.includes('<QuickScheduleModal'),
      'PatientProfilePage debe renderizar QuickScheduleModal preseleccionando al paciente'
    );

    // 2. En QuickScheduleModal.tsx
    const modalContent = fs.readFileSync('src/modules/appointments/ui/components/QuickScheduleModal.tsx', 'utf8');
    assert.ok(
      modalContent.includes('Procesando agendamiento...'),
      'Debe mostrar banner/overlay visual indicando que se esta procesando la peticion'
    );
    assert.ok(
      modalContent.includes("{isProcessing ? 'Confirmando Cita...' : 'Confirmar Cita'}"),
      'El boton Confirmar Cita debe cambiar a estado de carga durante el procesamiento'
    );
  });
});
