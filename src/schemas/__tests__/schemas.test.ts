import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  RolPermisosSchema,
  ConfigurableRolPermisosSchema,
  AntecedentesClinicosSchema,
  HabitosHigieneSchema,
  ExamenEstomatognaticoSchema,
  OdontogramaSchema,
  PlanManejoSchema,
  createDefaultAntecedentesClinicos,
  createNoAplicaAntecedentesClinicos,
  createDefaultHabitosHigiene,
  createDefaultExamenEstomatognatico,
  createInitialOdontograma,
  createDefaultPlanManejo,
} from '../index';

describe('CONTRATOS JSONB Y ESQUEMAS ZOD (Single Source of Truth - Capa 2 y Capa 3)', () => {
  describe('2.1. rol.permisos (Módulo A - RF-USR-007, RF-USR-010)', () => {
    it('Permite un listado válido de permisos funcionales', () => {
      const valid = ['RF-AGE-001', 'RF-AGE-002', 'RF-HCL-001', 'RF-HCL-010'];
      const res = RolPermisosSchema.safeParse(valid);
      assert.strictEqual(res.success, true);
    });

    it('Rechaza arreglo de permisos vacío', () => {
      const res = RolPermisosSchema.safeParse([]);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /al menos un \(1\) permiso asignado/);
      }
    });

    it('ConfigurableRolPermisosSchema rechaza permisos clínicos protegidos (RF-HCL-005 a RF-HCL-009, etc.)', () => {
      const invalid = ['RF-AGE-001', 'RF-HCL-005'];
      const res = ConfigurableRolPermisosSchema.safeParse(invalid);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /protegidos/i);
      }
    });

    it('ConfigurableRolPermisosSchema rechaza permisos automáticos o universal (RF-USR-008, RF-AGE-010)', () => {
      const invalid = ['RF-AGE-001', 'RF-USR-008'];
      const res = ConfigurableRolPermisosSchema.safeParse(invalid);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /procesos automáticos/i);
      }
    });
  });

  describe('2.2. antecedentes_clinicos (Módulo C - RF-HCL-005)', () => {
    it('Valida exitosamente el archivo oficial antecendentes_clinicos.json', () => {
      const raw = fs.readFileSync('d:/Descargas/antecendentes_clinicos.json', 'utf-8');
      const json = JSON.parse(raw);
      const res = AntecedentesClinicosSchema.safeParse(json);
      assert.strictEqual(res.success, true);
    });

    it('createDefaultAntecedentesClinicos() genera un objeto válido', () => {
      const def = createDefaultAntecedentesClinicos();
      const res = AntecedentesClinicosSchema.safeParse(def);
      assert.strictEqual(res.success, true);
    });

    it('createNoAplicaAntecedentesClinicos() genera estructura válida con N/A', () => {
      const noAplica = createNoAplicaAntecedentesClinicos();
      const res = AntecedentesClinicosSchema.safeParse(noAplica);
      assert.strictEqual(res.success, true);
      assert.strictEqual(noAplica.cirugias.presenta, false);
      assert.strictEqual(noAplica.cirugias.observaciones, 'N/A');
    });

    it('Rechaza si presenta: true pero observaciones está vacío o es N/A', () => {
      const invalid = createDefaultAntecedentesClinicos();
      invalid.cirugias.presenta = true;
      invalid.cirugias.observaciones = 'N/A';
      const res = AntecedentesClinicosSchema.safeParse(invalid);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /no pueden ser "N\/A"/i);
      }
    });
  });

  describe('2.3. habitos_higiene (Módulo C - RF-HCL-005)', () => {
    it('Valida exitosamente el archivo oficial habitos_higiene.json', () => {
      const raw = fs.readFileSync('d:/Descargas/habitos_higiene.json', 'utf-8');
      const json = JSON.parse(raw);
      const res = HabitosHigieneSchema.safeParse(json);
      assert.strictEqual(res.success, true);
    });

    it('createDefaultHabitosHigiene() genera un objeto válido', () => {
      const def = createDefaultHabitosHigiene();
      const res = HabitosHigieneSchema.safeParse(def);
      assert.strictEqual(res.success, true);
    });

    it('Rechaza si aplica: true pero frecuencia_cantidad o observaciones están vacías', () => {
      const invalid = createDefaultHabitosHigiene();
      invalid.fuma_tabaco_vapeo.aplica = true;
      invalid.fuma_tabaco_vapeo.frecuencia_cantidad = '';
      invalid.fuma_tabaco_vapeo.observaciones = '';
      const res = HabitosHigieneSchema.safeParse(invalid);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /no pueden estar vacías/i);
      }
    });
  });

  describe('2.4. examen_estomatognatico (Módulo C - RF-HCL-005)', () => {
    it('Valida exitosamente el archivo oficial examen_estomatognatico.json', () => {
      const raw = fs.readFileSync('d:/Descargas/examen_estomatognatico.json', 'utf-8');
      const json = JSON.parse(raw);
      const res = ExamenEstomatognaticoSchema.safeParse(json);
      assert.strictEqual(res.success, true);
    });

    it('createDefaultExamenEstomatognatico() genera un objeto válido', () => {
      const def = createDefaultExamenEstomatognatico();
      const res = ExamenEstomatognaticoSchema.safeParse(def);
      assert.strictEqual(res.success, true);
    });

    it('Rechaza si presenta_anormalidades: true pero observaciones es N/A o vacío', () => {
      const invalid = createDefaultExamenEstomatognatico();
      invalid.lengua.presenta_anormalidades = true;
      invalid.lengua.observaciones = 'N/A';
      const res = ExamenEstomatognaticoSchema.safeParse(invalid);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /no pueden ser "N\/A"/i);
      }
    });
  });

  describe('2.5. odontograma (Módulo C - RF-HCL-007, RQNF-USA-001)', () => {
    it('Valida exitosamente el archivo oficial odontograma.json', () => {
      const raw = fs.readFileSync('d:/Descargas/odontograma.json', 'utf-8');
      const json = JSON.parse(raw);
      const res = OdontogramaSchema.safeParse(json);
      assert.strictEqual(res.success, true);
    });

    it('createInitialOdontograma() genera odontograma válido permanente para adulto (4 cuadrantes)', () => {
      const od = createInitialOdontograma(false);
      const res = OdontogramaSchema.safeParse(od);
      assert.strictEqual(res.success, true);
      assert.ok(od.cuadrantes.cuadrante_1);
      assert.ok(od.cuadrantes.cuadrante_2);
      assert.ok(od.cuadrantes.cuadrante_3);
      assert.ok(od.cuadrantes.cuadrante_4);
      assert.strictEqual(od.cuadrantes.cuadrante_5, undefined);
    });

    it('createInitialOdontograma(true) incluye cuadrantes temporales 5 a 8 para menores de edad', () => {
      const od = createInitialOdontograma(true);
      const res = OdontogramaSchema.safeParse(od);
      assert.strictEqual(res.success, true);
      assert.ok(od.cuadrantes.cuadrante_5);
      assert.ok(od.cuadrantes.cuadrante_6);
      assert.ok(od.cuadrantes.cuadrante_7);
      assert.ok(od.cuadrantes.cuadrante_8);
    });

    it('Diferencia caras: palatina en arcada superior y lingual en arcada inferior', () => {
      const od = createInitialOdontograma(false);
      const upperTooth = od.cuadrantes.cuadrante_1.piezas['16'];
      assert.ok('palatina' in upperTooth.caras);
      assert.ok(!('lingual' in upperTooth.caras));

      const lowerTooth = od.cuadrantes.cuadrante_3.piezas['36'];
      assert.ok('lingual' in lowerTooth.caras);
      assert.ok(!('palatina' in lowerTooth.caras));
    });

    it('Rechaza odontograma si una cara dental tiene más de 1 hallazgo activo', () => {
      const od = createInitialOdontograma(false);
      const tooth = od.cuadrantes.cuadrante_1.piezas['16'];
      (tooth.caras as any).vestibular.caries_activa = true;
      (tooth.caras as any).vestibular.restauracion_resina = true; // 2 activos simultáneos
      const res = OdontogramaSchema.safeParse(od);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /un \(1\) hallazgo activo/i);
      }
    });
  });

  describe('2.6. plan_manejo (Módulos C y E - RF-DOC-001 a RF-DOC-004)', () => {
    it('Valida exitosamente el archivo oficial plan_manejo.json', () => {
      const raw = fs.readFileSync('d:/Descargas/plan_manejo.json', 'utf-8');
      const json = JSON.parse(raw);
      const res = PlanManejoSchema.safeParse(json);
      assert.strictEqual(res.success, true);
    });

    it('createDefaultPlanManejo() genera un objeto válido', () => {
      const def = createDefaultPlanManejo();
      const res = PlanManejoSchema.safeParse(def);
      assert.strictEqual(res.success, true);
    });

    it('Rechaza incapacidad médica con días fuera de rango (1 a 30 días)', () => {
      const plan = createDefaultPlanManejo();
      plan.incapacidad_medica.requiere_incapacidad = true;
      plan.incapacidad_medica.fecha_inicio = '2026-10-31';
      plan.incapacidad_medica.fecha_culminacion = '2026-11-05';
      plan.incapacidad_medica.diagnostico_justificacion = 'Tratamiento quirúrgico dental';
      plan.incapacidad_medica.dias_incapacidad = 45; // Mayor a 30
      const res = PlanManejoSchema.safeParse(plan);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /máxima es de 30 días/i);
      }
    });

    it('Rechaza remisión a médico o especialista individual (RF-DOC-003)', () => {
      const plan = createDefaultPlanManejo();
      plan.remision_medica.requiere_remision = true;
      plan.remision_medica.especialidad_destino = 'Dr. Juan Pérez'; // Prohibido
      plan.remision_medica.motivo_resumen_clinico = 'Evaluación urgente';
      const res = PlanManejoSchema.safeParse(plan);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /no a un profesional médico individual/i);
      }
    });

    it('Exige otra_especialidad_nombre si especialidad_destino es "Otra"', () => {
      const plan = createDefaultPlanManejo();
      plan.remision_medica.requiere_remision = true;
      plan.remision_medica.especialidad_destino = 'Otra';
      plan.remision_medica.otra_especialidad_nombre = '';
      plan.remision_medica.motivo_resumen_clinico = 'Evaluación multidisciplinaria';
      const res = PlanManejoSchema.safeParse(plan);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        const msg = (res.error.issues || (res.error as any).errors)[0].message;
        assert.match(msg, /especificar el nombre si eligió "Otra"/i);
      }
    });
  });
});
