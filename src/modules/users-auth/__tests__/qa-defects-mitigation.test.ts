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

/** Registro de auditoría en memoria: las pruebas unitarias no escriben en la BD. */
const fakeAudit = { entries: [] as any[], async log(entry: any) { this.entries.push(entry); } };
const newUsersCtrl = (repo: any) =>
  new UsersAuthController(repo, undefined as any, undefined as any, undefined as any, fakeAudit);

describe('VERIFICACIÓN Y MITIGACIÓN DE DEFECTOS QA (D-01 a D-14)', () => {
  const dummyRepo: any = {};
  const usersCtrl = newUsersCtrl(dummyRepo);
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

    // ERS v1.3: el rechazo se decide al gestionar la solicitud (RF-AGE-005), no desde la agenda

    const reqRejectNoMotif: any = {
      params: { id: '1' },
      body: { nuevoEstado: 'Rechazada' },
      user: { idUsuario: 1, roles: ['ROL-ADM'] },
    };
    const resRejectNoMotif = createMockResponse();
    await apptsCtrl.changeState(reqRejectNoMotif, resRejectNoMotif);
    assert.strictEqual(resRejectNoMotif.statusCode, 409);
    assert.match(resRejectNoMotif.body.message, /Gestionar solicitud/i);

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
    assert.strictEqual(patRepoCode.includes('AS "agendadoPor"'), true);
    // Comprobar que la vista React de la ficha del paciente renderiza "Agendado por:"
    assert.strictEqual(patProfileUi.includes('Agendado por:'), true);
  });

  it('DEF-27 / T-3: El esquema vive en migraciones versionadas y se aplica con npm run db:migrate', async () => {
    const path = await import('path');
    const dir = path.resolve(process.cwd(), 'database/migrations');
    const files = fs.readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
    assert.deepStrictEqual(files.slice(0, 2), ['000_baseline.sql', '001_ers_1_3.sql']);

    const all = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase()).join('\n');
    const requiredTables = [
      'rol', 'usuario', 'usuario_rol', 'plantilla_consentimiento', 'paciente', 'bloques_horario',
      'solicitud_cita', 'historial_solicitud', 'cita', 'bloques_citas', 'historial_cita',
      'consentimiento_firmado', 'historia_clinica', 'evolucion', 'token_recuperacion',
      'registro_auditoria', 'sesion_revocada', 'intento_login', 'borrador_sesion', 'nota_evolucion',
    ];
    for (const table of requiredTables) {
      assert.ok(all.includes(`create table if not exists public.${table}`), `Falta la tabla ${table} en las migraciones`);
    }
    assert.ok(all.includes('chk_cita_estado'), 'La BD debe restringir los estados de la cita a los de la ERS');
    assert.ok(all.includes('trg_auditoria_inalterable'), 'La auditoría debe ser inalterable');

    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.match(pkg.scripts['db:migrate'], /migrate\.ts/);
    assert.strictEqual(fs.existsSync('database/schema.sql'), false, 'El esquema paralelo desalineado se retiró');
  });

  it('ROLES: Roles en Doctores y Equipo vienen dinámicamente de la BD y no están quemados', async () => {
    // Verificar que UsersManagementPage define onFetchRoles y no depende únicamente de DEFAULT_ROLES_FALLBACK
    const usersPageCode = fs.readFileSync('src/modules/users-auth/ui/views/UsersManagementPage.tsx', 'utf8');
    assert.strictEqual(usersPageCode.includes('onFetchRoles'), true);
    assert.strictEqual(usersPageCode.includes('fetchRolesDirectory'), true);
    assert.strictEqual(usersPageCode.includes("fetch('/api/v1/roles')"), true);

    // Verificar que el router raíz pasa onFetchRoles a UsersManagementPage
    const routerCode = fs.readFileSync('src/app/routes/AppRouter.tsx', 'utf8');
    assert.strictEqual(routerCode.includes('onFetchRoles={auth.fetchRoles}'), true);
    assert.strictEqual(routerCode.includes('refreshCatalogRoles'), true);
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

    const ctrl = newUsersCtrl(mockRepo);

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

    const ctrl = newUsersCtrl(mockRepo);

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

    const ctrl = newUsersCtrl(mockRepo);

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

  it('I4-011: Formateador de fecha DD/MM/AAAA y hora 12h (a. m. / p. m.) para correos en Colombia', async () => {
    const { formatColombiaDate, formatColombiaTime } = await import(
      '../../../shared/infrastructure/mail/mailer.service'
    );

    // Fechas AAAA-MM-DD -> DD/MM/AAAA
    assert.strictEqual(formatColombiaDate('2026-11-12'), '12/11/2026');
    assert.strictEqual(formatColombiaDate('2026-05-03'), '03/05/2026');

    // Horas 24h -> 12h
    assert.strictEqual(formatColombiaTime('14:00'), '02:00 p. m.');
    assert.strictEqual(formatColombiaTime('10:00'), '10:00 a. m.');
    assert.strictEqual(formatColombiaTime('00:00'), '12:00 a. m.');
    assert.strictEqual(formatColombiaTime('12:00'), '12:00 p. m.');

    // Rangos de horario
    assert.strictEqual(formatColombiaTime('10:00 - 10:30'), '10:00 a. m. - 10:30 a. m.');
    assert.strictEqual(formatColombiaTime('14:00 - 15:30'), '02:00 p. m. - 03:30 p. m.');
  });

  it('I5-002 (D-25): Rechaza una evolución con la cita de otro paciente', async () => {
    const { ClinicalRecordsController } = await import('../../clinical-records/infrastructure/clinical-records.controller');
    let escribio = false;
    const repo: any = {
      getAppointmentContext: async () => ({ idCita: 5, idPaciente: 5, idProfesional: 9, nombreProfesional: 'QA', estado: 'En consulta' }),
      createEvolutionEntry: async () => { escribio = true; return {}; },
    };
    const ctrl = new ClinicalRecordsController(repo);
    const res = createMockResponse();
    await ctrl.createEntry(
      { body: { idPaciente: 6, idCita: 5, motivoConsulta: 'X' }, user: { idUsuario: 9, roles: ['ROL-ODO'], permisos: ['RF-HCL-005'] } } as any,
      res
    );
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.message, /no corresponde al paciente/i);
    assert.strictEqual(escribio, false);
  });

  it('I6-001 (D-23, D-24, D-27): Los documentos no se guardan en disco ni se publican por una dirección', () => {
    const generatorSource = fs.readFileSync(
      'src/modules/clinical-documents/application/clinical-document-pdf-generator.service.ts',
      'utf8'
    );
    assert.ok(!generatorSource.includes('writeFileSync'), 'El PDF se genera en memoria');
    assert.ok(!generatorSource.includes('archivoPdfUrl'), 'No se devuelve una URL a un archivo');

    const serverSource = fs.readFileSync('src/app/server.ts', 'utf8');
    assert.ok(!serverSource.includes('/storage/clinical-documents'), 'La ruta que fabricaba PDF se retiró');

    const repoSource = fs.readFileSync(
      'src/modules/clinical-documents/infrastructure/clinical-document.repository.ts',
      'utf8'
    );
    assert.ok(!repoSource.includes('INSERT INTO public.evolucion'), 'Generar un documento no crea filas de evolución (D-24)');
  });

  it('I2-009 & I5-006: Acceso clínico denegado con mensaje único y la auxiliar solo con la cita En consulta', async () => {
    const { ClinicalAccessPolicy } = await import('../../clinical-records/application/clinical-access.policy');
    const cita = { idCita: 9, idPaciente: 7, idProfesional: 9, nombreProfesional: 'QA', estado: 'En consulta' };
    const aux: any = { idUsuario: 8, correo: 'aux@x.co', nombreCompleto: 'Aux', roles: ['ROL-AUX'], permisos: ['RF-HCL-009', 'RF-HCL-007'] };
    const coa: any = { idUsuario: 10, correo: 'coa@x.co', nombreCompleto: 'Coa', roles: ['ROL-COA'], permisos: ['RF-HCL-004'] };

    // La auxiliar ve la consulta en curso, pero no el historial completo
    assert.doesNotThrow(() => ClinicalAccessPolicy.assertCanViewConsultation(aux, cita));
    assert.throws(() => ClinicalAccessPolicy.assertCanViewHistory(aux), /No tiene permiso para realizar esta acción/);
    // Con la cita Atendida pierde el acceso
    assert.throws(() => ClinicalAccessPolicy.resolveWriter(aux, { ...cita, estado: 'Atendida' }), /No tiene permiso/);
    // La coordinadora nunca accede
    assert.throws(() => ClinicalAccessPolicy.assertCanViewConsultation(coa, cita), /No tiene permiso para realizar esta acción/);
  });

  it('I3-007 & I4-010 (ERS v1.3): El paciente ya no guarda autorización ni acudiente en su ficha', async () => {
    const { Patient } = await import('../../patients/domain/patient.entity');
    // RF-HCL-001: todos los datos son obligatorios al registrar
    assert.throws(
      () => Patient.create({ nombreCompleto: 'Paciente QA', documentoIdentidad: '987654321', fechaNacimiento: '1995-04-10' }),
      /sexo del paciente es obligatorio/
    );
    const ok = Patient.create({
      nombreCompleto: 'Paciente QA',
      documentoIdentidad: '987654321',
      fechaNacimiento: '1995-04-10',
      sexo: 'Femenino',
      telefono: '3001234567',
      correo: 'qa@correo.com',
    });
    const prim = ok.toPrimitives() as any;
    assert.strictEqual(prim.autorizacionDatos, undefined);
    assert.strictEqual(prim.acudiente, undefined);
    // Paciente creado desde una solicitud sin sexo: "Datos incompletos" derivado (no se guarda)
    const fromRequest = Patient.reconstitute({ nombreCompleto: 'X', documentoIdentidad: '1', fechaNacimiento: '1990-01-01' });
    assert.strictEqual(fromRequest.datosIncompletos, true);
  });

  it('DEF-PROF-01: AppointmentsController.getActiveProfessionals retorna catálogo de profesionales para asignación sin requerir permisos de gestión de usuarios (RF-USR-004)', async () => {
    const fakeApptRepo: any = {
      findActiveProfessionals: async () => [
        { idUsuario: 1, nombreCompleto: 'Dr. Eduar Leal', especialidad: 'Odontólogo General', codigoRol: 'ROL-ODO' },
        { idUsuario: 37, nombreCompleto: 'Dra. Natalia Díaz', especialidad: 'Especialista en Ortodoncia', codigoRol: 'ROL-ESP' },
      ],
    };
    const ctrl = new AppointmentsController(fakeApptRepo);
    const req: any = {};
    const res = createMockResponse();
    await ctrl.getActiveProfessionals(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.length, 2);
    assert.strictEqual(res.body.data[0].codigoRol, 'ROL-ODO');
    assert.strictEqual(res.body.data[1].codigoRol, 'ROL-ESP');
  });

  it('DEF-AGENDA-01: AppointmentsController.getMonthlySummary aplica RBAC: odontólogos ven solo sus citas sin solicitudes, y personal de agenda ve solicitudes', async () => {
    let capturedParams: any = null;
    const fakeApptRepo: any = {
      getMonthlySummary: async (year: number, month: number, idProfesional?: number, includeSolicitudes = true) => {
        capturedParams = { year, month, idProfesional, includeSolicitudes };
        return [
          { fecha: '2026-11-10', dia: 10, totalCitas: 1, totalSolicitadas: includeSolicitudes ? 2 : 0, totalBloques: 28, sinBloques: false },
        ];
      },
    };
    const ctrl = new AppointmentsController(fakeApptRepo);

    // Caso A: Odontólogo Héctor Ramírez (idUsuario: 2) -> seesAll = false, idProfesional forzado a 2, sin solicitudes
    const reqOdo: any = {
      user: { idUsuario: 2, roles: ['ROL-ODO'], permisos: ['RF-AGE-008'] },
      query: { year: '2026', month: '11' },
    };
    const resOdo = createMockResponse();
    await ctrl.getMonthlySummary(reqOdo, resOdo);
    assert.strictEqual(resOdo.statusCode, 200);
    assert.strictEqual(capturedParams.idProfesional, 2);
    assert.strictEqual(capturedParams.includeSolicitudes, false);
    assert.strictEqual(resOdo.body.data[0].totalSolicitadas, 0);

    // Caso B: Coordinadora de agendamiento -> seesAll = true, incluye solicitudes
    const reqCoa: any = {
      user: { idUsuario: 3, roles: ['ROL-COA'], permisos: ['RF-AGE-008'] },
      query: { year: '2026', month: '11' },
    };
    const resCoa = createMockResponse();
    await ctrl.getMonthlySummary(reqCoa, resCoa);
    assert.strictEqual(resCoa.statusCode, 200);
    assert.strictEqual(capturedParams.idProfesional, undefined);
    assert.strictEqual(capturedParams.includeSolicitudes, true);
    assert.strictEqual(resCoa.body.data[0].totalSolicitadas, 2);
  });

  it('DEF-AGENDA-02: AppointmentsController.generateDaySlots reporta yaExistian cuando no se generaron bloques nuevos', async () => {
    const fakeApptRepo: any = {
      generateDaySlots: async (fecha: string) => ({
        totalGenerados: 0,
        yaExistian: true,
        totalExistentes: 28,
        fecha,
      }),
    };
    const ctrl = new AppointmentsController(fakeApptRepo);
    const req: any = { body: { fecha: '2026-11-10' } };
    const res = createMockResponse();
    await ctrl.generateDaySlots(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.data.yaExistian, true);
    assert.ok(res.body.message.includes('ya se encuentran generados'));
  });

  it('DEF-AGENDA-03: AppointmentsController.getAgenda excluye canceladas en la agenda operativa y las mantiene en historial por paciente', async () => {
    const calls: any[] = [];
    const fakeApptRepo: any = {
      getAgenda: async (idProfesional?: number, idPaciente?: number, fecha?: string, includeCancelled?: boolean) => {
        calls.push({ idProfesional, idPaciente, fecha, includeCancelled });
        return [];
      },
    };
    const ctrl = new AppointmentsController(fakeApptRepo);

    // Agenda operativa (sin idPaciente) -> includeCancelled = false
    await ctrl.getAgenda(
      { user: { idUsuario: 1, roles: ['ROL-COA'], permisos: ['RF-AGE-008'] }, query: { fecha: '2026-11-10' } } as any,
      createMockResponse()
    );
    assert.strictEqual(calls[0].includeCancelled, false);

    // Historial en ficha de paciente (con idPaciente) -> includeCancelled = true
    await ctrl.getAgenda(
      { user: { idUsuario: 1, roles: ['ROL-COA'], permisos: ['RF-AGE-008'] }, query: { idPaciente: '15' } } as any,
      createMockResponse()
    );
    assert.strictEqual(calls[1].idPaciente, 15);
    assert.strictEqual(calls[1].includeCancelled, true);
  });

  it('DEF-AUX-01 (Opción A): ROL-AUX puede registrar evolución/odontograma en consulta sin apertura previa y luego el doctor completa la apertura sin perder datos', async () => {
    const { ClinicalRecordsController } = await import('../../clinical-records/infrastructure/clinical-records.controller');
    const { CreateClinicalRecordUseCase } = await import('../../clinical-records/application/create-clinical-record.use-case');
    const { ClinicalRecordsModulePublicApi } = await import('../../clinical-records');

    let storedEvo: any = null;
    const capturedEntries: any[] = [];
    const fakeRepo: any = {
      getAppointmentContext: async (idCita: number) => ({
        idCita,
        idPaciente: 7,
        idProfesional: 2,
        nombreProfesional: 'Dr. Prueba',
        estado: 'En consulta',
      }),
      findEvolutionByCitaId: async () => storedEvo,
      getClinicalHistoryByPatient: async () => [
        {
          idHistoria: 1,
          idPaciente: 7,
          idEvolucion: 90,
          idCita: 1,
          motivoConsulta: 'Control previo',
          antecedentesClinicos: { diabetes: { aplica: true, observacion: 'Controlada' } },
          evolucion: {
            tipoRegistro: 'APERTURA_CONSULTA',
            motivoConsulta: 'Control previo',
            antecedentes: { diabetes: { aplica: true, observacion: 'Controlada' } },
          },
        },
        ...(storedEvo ? [storedEvo] : []),
      ],
      createEvolutionEntry: async (dto: any) => {
        capturedEntries.push(dto);
        storedEvo = {
          idEvolucion: 99,
          idHistoria: 1,
          idCita: dto.idCita,
          motivoConsulta: dto.motivoConsulta ?? '',
          antecedentesClinicos: dto.antecedentesClinicos ?? {},
          evolucion: {
            tipoRegistro: dto.payload?.tipoRegistro ?? 'EVOLUCION_ODONTOGRAMA',
            motivoConsulta: dto.motivoConsulta ?? '',
            antecedentes: dto.antecedentesClinicos ?? {},
          },
        };
        return storedEvo;
      },
    };

    const ctrl = new ClinicalRecordsController(fakeRepo);
    const auxReq: any = {
      user: {
        idUsuario: 8,
        correo: 'aux@x.co',
        nombreCompleto: 'Milena Aux',
        roles: ['ROL-AUX'],
        permisos: ['RF-HCL-007', 'RF-HCL-009'],
      },
      body: {
        idPaciente: 7,
        idCita: 200,
        procedimientoRealizado: 'Aislamiento y toma radiográfica',
        hallazgosObservaciones: 'Paciente colaborador',
      },
    };
    const auxRes = createMockResponse();
    await ctrl.createEntry(auxReq, auxRes);

    assert.strictEqual(auxRes.statusCode, 201);
    assert.strictEqual(capturedEntries[0].actor.esProfesionalResponsable, false);
    assert.strictEqual(capturedEntries[0].nota.texto, 'Paciente colaborador');
    assert.strictEqual(capturedEntries[0].nota.procedimientoRealizado, 'Aislamiento y toma radiográfica');

    // Mientras solo haya apoyo de la auxiliar sin motivoConsulta, NO se considera apertura médica completa
    const publicApi = new ClinicalRecordsModulePublicApi(fakeRepo);
    assert.strictEqual(await publicApi.hasConsultationReasonRegistered(200), false);

    // Luego el odontólogo completa la apertura formal (precargando antecedentes de la cita previa #1, no los vacíos de #200)
    const createUseCase = new CreateClinicalRecordUseCase(fakeRepo);
    await createUseCase.execute({
      idPaciente: 7,
      idCita: 200,
      estadoCita: 'En consulta',
      idProfesionalResponsable: 2,
      actor: { idUsuario: 2, nombreUsuario: 'Dr. Prueba', roles: ['ROL-ODO'] },
      writer: { idUsuario: 2, nombreUsuario: 'Dr. Prueba', correo: 'dr@x.co', esProfesionalResponsable: true },
      motivoConsulta: 'Dolor en molar inferior',
    });

    assert.strictEqual(await publicApi.hasConsultationReasonRegistered(200), true);
    assert.strictEqual(capturedEntries[1].antecedentesClinicos.diabetes.aplica, true);
  });

  it('DEF-MODAL-01: Modal.tsx no reinicia foco al cambiar la referencia de onClose al escribir', () => {
    const modalSrc = fs.readFileSync('src/shared/ui/components/Modal.tsx', 'utf8');
    assert.ok(modalSrc.includes('onCloseRef'), 'Debe usar onCloseRef para evitar re-ejecución del efecto');
    assert.ok(!modalSrc.includes('}, [isOpen, onClose])'), 'El useEffect del foco no debe depender de onClose');
  });
});
