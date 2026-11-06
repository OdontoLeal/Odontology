# Modificación Temporal: Deshabilitación de la Restricción de Cita del Mismo Día (RF-AGE-009)

> **Fecha de implementación:** 5 de noviembre de 2026  
> **Estado:** TEMPORAL / DESHABILITADO  
> **Objetivo:** Permitir a los profesionales odontológicos (`ROL-ODO`, `ROL-ESP`) y administradores iniciar la atención clínica de citas confirmadas (`Confirmada` → `En consulta`) sin importar si la fecha programada corresponde al día de hoy, fechas pasadas o fechas futuras.

---

## 1. Contexto de la Regla de Negocio

En la especificación original (**ERS v1.3 - RF-AGE-009: Iniciar / Finalizar Atención Odontológica**), se establecía que:
- Solo el profesional responsable de la cita (o un Administrador con permisos clínicos) puede iniciar la atención de una cita médica (`Confirmada` → `En consulta`).
- La atención odontológica solo podía iniciarse dentro de la fecha de la cita (mismo día calendario en hora legal de Colombia `UTC-5`).

Para facilitar pruebas funcionales, atención de citas extemporáneas y revisiones clínicas sin depender de la fecha estricta del sistema, se ha deshabilitado temporalmente esta validación en el backend.

---

## 2. Archivos Modificados

La regla estaba protegida en dos capas del sistema (Dominio e Infraestructura):

1. **[`src/modules/appointments/domain/appointment.entity.ts`](file:///d:/Escritorio/Decimo%20Semestre/Odontology/src/modules/appointments/domain/appointment.entity.ts)** (Capa de Dominio)
2. **[`src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts`](file:///d:/Escritorio/Decimo%20Semestre/Odontology/src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts)** (Capa de Validación / Infraestructura)

---

## 3. Detalle de los Cambios

### A. Capa de Dominio: `AppointmentEntity.iniciarAtencion`
*Ubicación:* `src/modules/appointments/domain/appointment.entity.ts` (línea ~436)

**Código original:**
```typescript
const citaDay = AppointmentEntity.toColombiaDateString(this.horaInicio);
const todayDay = AppointmentEntity.toColombiaDateString(now);
if (citaDay !== todayDay) {
  throw new Error('Solo se puede iniciar la atención de citas correspondientes al día de hoy (RF-AGE-009).');
}
```

**Código actual (Comentado temporalmente):**
```typescript
// =========================================================================
// [DESHABILITADO TEMPORALMENTE]: Restricción de atender solo citas del mismo día.
// Detalle y reversión documentados en: /MODIFICACION_TEMPORAL_ATENCION_MISMO_DIA.md
// =========================================================================
/*
const citaDay = AppointmentEntity.toColombiaDateString(this.horaInicio);
const todayDay = AppointmentEntity.toColombiaDateString(now);
if (citaDay !== todayDay) {
  throw new Error('Solo se puede iniciar la atención de citas correspondientes al día de hoy (RF-AGE-009).');
}
*/
```

---

### B. Capa de Infraestructura: `validateStateChangeRules`
*Ubicación:* `src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts` (línea ~131)

**Código original:**
```typescript
case 'En consulta': {
  if (!can('RF-AGE-009') || !isResponsible) throw new ForbiddenError();
  if (citaActual.estado !== 'Confirmada') {
    throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita Confirmada.', 409);
  }
  if (inicioDia !== today && !isAdmin) {
    throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita del día.', 409);
  }
  return;
}
```

**Código actual (Comentado temporalmente):**
```typescript
case 'En consulta': {
  if (!can('RF-AGE-009') || !isResponsible) throw new ForbiddenError();
  if (citaActual.estado !== 'Confirmada') {
    throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita Confirmada.', 409);
  }
  // =========================================================================
  // [DESHABILITADO TEMPORALMENTE]: Restricción de atender solo citas del mismo día.
  // Detalle y reversión documentados en: /MODIFICACION_TEMPORAL_ATENCION_MISMO_DIA.md
  // =========================================================================
  /*
  if (inicioDia !== today && !isAdmin) {
    throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita del día.', 409);
  }
  */
  return;
}
```

---

## 4. Cómo Revertir Este Cambio Posteriormente

Para volver a activar la restricción estricta de que las citas solo puedan atenderse el mismo día de su agendamiento, sigue estos dos sencillos pasos:

### Paso 1: Descomentar en `src/modules/appointments/domain/appointment.entity.ts`
1. Abre el archivo [`src/modules/appointments/domain/appointment.entity.ts`](file:///d:/Escritorio/Decimo%20Semestre/Odontology/src/modules/appointments/domain/appointment.entity.ts).
2. Busca el método `iniciarAtencion`.
3. Retira los caracteres de comentario `/*` y `*/` para que el bloque de validación vuelva a ejecutarse:
   ```typescript
   const citaDay = AppointmentEntity.toColombiaDateString(this.horaInicio);
   const todayDay = AppointmentEntity.toColombiaDateString(now);
   if (citaDay !== todayDay) {
     throw new Error('Solo se puede iniciar la atención de citas correspondientes al día de hoy (RF-AGE-009).');
   }
   ```

### Paso 2: Descomentar en `src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts`
1. Abre el archivo [`src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts`](file:///d:/Escritorio/Decimo%20Semestre/Odontology/src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts).
2. Busca el bloque `case 'En consulta':`.
3. Retira los caracteres de comentario `/*` y `*/` para que la validación vuelva a estar activa:
   ```typescript
   if (inicioDia !== today && !isAdmin) {
     throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita del día.', 409);
   }
   ```

### Paso 3: Verificar compilación y pruebas
Ejecuta en la terminal de la raíz del proyecto:
```bash
npm run build
npm test
```
Ambos comandos deben finalizar con código de salida `0` y 110 pruebas exitosas.
