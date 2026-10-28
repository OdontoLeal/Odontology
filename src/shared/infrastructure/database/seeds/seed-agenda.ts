// src/shared/infrastructure/database/seeds/seed-agenda.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- Iniciando Seeding de Base de Datos OdontoLeal ---');

    // 1. Asegurar roles
    const roles = [
      { id: 1, name: 'Administrador del Sistema' },
      { id: 2, name: 'Odontólogo General' },
      { id: 3, name: 'Especialista en Ortodoncia' },
      { id: 4, name: 'Coordinadora de Agendamiento' },
      { id: 5, name: 'Auxiliar de Odontología' },
    ];
    for (const r of roles) {
      await client.query(
        `INSERT INTO public.rol (id_rol, nombre_rol)
         VALUES ($1, $2)
         ON CONFLICT (id_rol) DO UPDATE SET nombre_rol = EXCLUDED.nombre_rol;`,
        [r.id, r.name]
      );
    }

    // 2. Doctores y Usuarios del sistema (según imágenes y ERS)
    const users = [
      {
        id: 1,
        nombre: 'Dr. Eduar Leal Álvarez',
        documento: '1098765432',
        correo: 'eduard.leal@gmail.com',
        telefono: '3101234567',
        roles: [1, 2],
      },
      {
        id: 101,
        nombre: 'Dr. Mateo Gómez',
        documento: '1098765401',
        correo: 'mateo.gomez@odontoleal.com',
        telefono: '3124567891',
        roles: [2],
      },
      {
        id: 102,
        nombre: 'Dra. Valeria Silva',
        documento: '1098765402',
        correo: 'valeria.silva@odontoleal.com',
        telefono: '3157891234',
        roles: [3],
      },
      {
        id: 103,
        nombre: 'Dr. Alejandro Ruiz',
        documento: '1098765403',
        correo: 'alejandro.ruiz@odontoleal.com',
        telefono: '3109876542',
        roles: [1, 2],
      },
      {
        id: 67,
        nombre: 'Andrea Guerrero',
        documento: '1050000045',
        correo: 'andrea@gmail.com',
        telefono: '3114534113',
        roles: [4],
      },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO public.usuario (id_usuario, nombre_completo, documento_identidad, correo, telefono, contrasena_hash, estado)
         VALUES ($1, $2, $3, $4, $5, 'PasswordSegura1', true)
         ON CONFLICT (id_usuario) DO UPDATE 
         SET nombre_completo = EXCLUDED.nombre_completo, 
             documento_identidad = EXCLUDED.documento_identidad,
             correo = EXCLUDED.correo,
             telefono = EXCLUDED.telefono;`,
        [u.id, u.nombre, u.documento, u.correo, u.telefono]
      );

      for (const rid of u.roles) {
        await client.query(
          `INSERT INTO public.usuario_rol (id_usuario, id_rol, estado)
           VALUES ($1, $2, true)
           ON CONFLICT (id_usuario, id_rol) DO NOTHING;`,
          [u.id, rid]
        );
      }
    }
    console.log('✅ Doctores y usuarios verificados.');

    // 3. Pacientes registrados (según imágenes)
    const patients = [
      {
        id: 1,
        nombre: 'Sofía Carvajal',
        documento: '1020456789',
        correo: 'sofia.carvajal@email.com',
        telefono: '+57 312 456 7890',
        fechaNac: '1996-05-14',
        sexo: 'Femenino',
      },
      {
        id: 2,
        nombre: 'Carlos Mendoza',
        documento: '79845123',
        correo: 'carlos.mendoza@email.com',
        telefono: '+57 311 234 5678',
        fechaNac: '1984-03-12',
        sexo: 'Masculino',
      },
      {
        id: 3,
        nombre: 'Jorge Luis Morales',
        documento: '1032789456',
        correo: 'jorge.morales@email.com',
        telefono: '+57 310 987 6543',
        fechaNac: '1992-08-20',
        sexo: 'Masculino',
      },
      {
        id: 4,
        nombre: 'Mariana Restrepo',
        documento: '1108654321',
        correo: 'mariana.restrepo@email.com',
        telefono: '+57 318 456 7890',
        fechaNac: '2002-11-04',
        sexo: 'Femenino',
      },
      {
        id: 5,
        nombre: 'Andrés Felipe Ramos',
        documento: '1015678901',
        correo: 'andres.ramos@email.com',
        telefono: '+57 314 567 8901',
        fechaNac: '1997-09-15',
        sexo: 'Masculino',
      },
    ];

    for (const p of patients) {
      await client.query(
        `INSERT INTO public.paciente (id_paciente, nombre_completo, documento_identidad, correo, telefono, fecha_nacimiento, sexo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id_paciente) DO UPDATE 
         SET nombre_completo = EXCLUDED.nombre_completo,
             documento_identidad = EXCLUDED.documento_identidad,
             correo = EXCLUDED.correo,
             telefono = EXCLUDED.telefono,
             fecha_nacimiento = EXCLUDED.fecha_nacimiento,
             sexo = EXCLUDED.sexo;`,
        [p.id, p.nombre, p.documento, p.correo, p.telefono, p.fechaNac, p.sexo]
      );
    }
    console.log('✅ Pacientes verificados.');

    // 4. Generación de Bloques Horarios para Octubre 2026
    // Horarios de 08:00 a 18:00 de Lunes a Sábado
    // Domingos (4, 11, 18, 25): NO se crean bloques -> Aparece "Sin bloques" en el calendario
    for (let day = 1; day <= 31; day++) {
      const dayStr = day.toString().padStart(2, '0');
      const dateStr = `2026-10-${dayStr}`;
      const d = new Date(`${dateStr}T12:00:00Z`);
      const dayOfWeek = d.getUTCDay(); // 0 = Domingo

      // Si es domingo, no crear bloques
      if (dayOfWeek === 0) continue;

      // Crear bloques estándar de 30 min entre 08:00 y 17:00
      const standardHours = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
        '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
      ];

      for (let i = 0; i < standardHours.length; i++) {
        const startH = standardHours[i];
        let endH = standardHours[i + 1] || '17:00';
        const startTimestamp = `${dateStr} ${startH}:00`;
        const endTimestamp = `${dateStr} ${endH}:00`;

        // Para el día 24 de Octubre de 2026:
        // Bloques 12:00 y 12:30 están deshabilitados (estado = false) según Imagen 3
        let isHabilitado = true;
        if (day === 24 && (startH === '12:00' || startH === '12:30')) {
          isHabilitado = false;
        }

        await client.query(
          `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (inicio) DO UPDATE
           SET final = EXCLUDED.final, estado = EXCLUDED.estado;`,
          [startTimestamp, endTimestamp, isHabilitado]
        );
      }
    }
    console.log('✅ Bloques de horario para Octubre 2026 creados.');

    // 5. Citas Específicas para Sábado 24 de Octubre de 2026 (según Imagen 3)
    // Limpiamos citas existentes previas en el día 24 para asegurar exactitud
    await client.query(`
      DELETE FROM public.bloques_citas 
      WHERE id_bloque::text LIKE '2026-10-24%';
    `);
    await client.query(`
      DELETE FROM public.cita 
      WHERE id_cita IN (
        SELECT id_cita FROM public.cita WHERE id_cita IN (10, 11, 12, 13, 14)
      );
    `);

    // Cita 1: Carlos Mendoza (08:30 - 09:30) [Completada]
    // Profilaxis y Limpieza • Dra. Valeria Silva (id: 102)
    const cita1 = await client.query(
      `INSERT INTO public.cita (id_cita, titulo, descripcion, id_paciente, id_usuario, estado)
       VALUES (10, 'Profilaxis y Limpieza', 'Limpieza y remoción de cálculo supragingival con ultrasonido', 2, 102, 'Completada')
       ON CONFLICT (id_cita) DO UPDATE 
       SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, id_paciente = EXCLUDED.id_paciente,
           id_usuario = EXCLUDED.id_usuario, estado = EXCLUDED.estado
       RETURNING id_cita;`
    );
    await client.query(`
      INSERT INTO public.bloques_citas (id_bloque, id_cita)
      VALUES ('2026-10-24 08:30:00', 10), ('2026-10-24 09:00:00', 10)
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      UPDATE public.bloques_horario SET ocupacion = true 
      WHERE inicio IN ('2026-10-24 08:30:00', '2026-10-24 09:00:00');
    `);

    // Cita 2: Mariana Restrepo (09:30 - 10:30) [En consulta]
    // Ajuste de Ortodoncia • Dra. Valeria Silva (id: 102)
    await client.query(
      `INSERT INTO public.cita (id_cita, titulo, descripcion, id_paciente, id_usuario, estado)
       VALUES (11, 'Ajuste de Ortodoncia', 'Control mensual, cambio de arcos y colocación de elásticos intermaxilares', 4, 102, 'En consulta')
       ON CONFLICT (id_cita) DO UPDATE 
       SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, id_paciente = EXCLUDED.id_paciente,
           id_usuario = EXCLUDED.id_usuario, estado = EXCLUDED.estado;`
    );
    await client.query(`
      INSERT INTO public.bloques_citas (id_bloque, id_cita)
      VALUES ('2026-10-24 09:30:00', 11), ('2026-10-24 10:00:00', 11)
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      UPDATE public.bloques_horario SET ocupacion = true 
      WHERE inicio IN ('2026-10-24 09:30:00', '2026-10-24 10:00:00');
    `);

    // Cita 3: Jorge Luis Morales (10:30 - 11:30) [En espera]
    // Endodoncia Molar #46 • Dr. Mateo Gómez (id: 101)
    await client.query(
      `INSERT INTO public.cita (id_cita, titulo, descripcion, id_paciente, id_usuario, estado)
       VALUES (12, 'Endodoncia Molar #46', 'Tratamiento de conductos en molar 46 con instrumentación rotatoria', 3, 101, 'En espera')
       ON CONFLICT (id_cita) DO UPDATE 
       SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, id_paciente = EXCLUDED.id_paciente,
           id_usuario = EXCLUDED.id_usuario, estado = EXCLUDED.estado;`
    );
    await client.query(`
      INSERT INTO public.bloques_citas (id_bloque, id_cita)
      VALUES ('2026-10-24 10:30:00', 12), ('2026-10-24 11:00:00', 12)
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      UPDATE public.bloques_horario SET ocupacion = true 
      WHERE inicio IN ('2026-10-24 10:30:00', '2026-10-24 11:00:00');
    `);

    // Cita 4: Sofía Carvajal (14:00 - 15:00) [Confirmada]
    // Valoración para Implante • Dr. Mateo Gómez (id: 101)
    await client.query(
      `INSERT INTO public.cita (id_cita, titulo, descripcion, id_paciente, id_usuario, estado)
       VALUES (13, 'Valoración para Implante', 'Evaluación de densidad ósea mediante tomografía CBCT, toma de impresiones digitales 3D y diseño de la guía quirúrgica para osteointegración.', 1, 101, 'Confirmada')
       ON CONFLICT (id_cita) DO UPDATE 
       SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, id_paciente = EXCLUDED.id_paciente,
           id_usuario = EXCLUDED.id_usuario, estado = EXCLUDED.estado;`
    );
    await client.query(`
      INSERT INTO public.bloques_citas (id_bloque, id_cita)
      VALUES ('2026-10-24 14:00:00', 13), ('2026-10-24 14:30:00', 13)
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      UPDATE public.bloques_horario SET ocupacion = true 
      WHERE inicio IN ('2026-10-24 14:00:00', '2026-10-24 14:30:00');
    `);

    // 6. Solicitud Pendiente de Aprobación: Lucía Restrepo Gómez (15:30 - 16:00)
    // Conectada a solicitud_cita y cita en estado 'Solicitada'
    await client.query(`
      DELETE FROM public.solicitud_cita 
      WHERE correo_solicitante = 'lucia.restrepo@email.com' OR bloque_solicitado = '2026-10-24 15:30:00';
    `);

    const solRes = await client.query(
      `INSERT INTO public.solicitud_cita 
        (nombre_solicitante, documento_solicitante, correo_solicitante, telefono_solicitante, fecha_nacimiento, sexo, bloque_solicitado, descripcion, fecha_solicitud, estado)
       VALUES 
        ('Lucía Restrepo Gómez', '1025884320', 'lucia.restrepo@email.com', '+57 318 459 2011', '1997-04-12', 'Femenino', '2026-10-24 15:30:00', 'Valoración por sensibilidad en molar inferior derecho y revisión general', '2026-10-24 09:15:00', true)
       RETURNING id_solicitud;`
    );
    const idSolicitudLucia = solRes.rows[0].id_solicitud;

    // Crear cita pendiente en public.cita en estado 'Solicitada'
    // En public.cita: titulo varchar(50), descripcion varchar(500)
    await client.query(
      `INSERT INTO public.cita (id_cita, titulo, descripcion, id_paciente, id_usuario, estado)
       VALUES (14, 'Valoración Sensibilidad Molar', 'Valoración por sensibilidad en molar inferior derecho y revisión general', 1, 101, 'Solicitada')
       ON CONFLICT (id_cita) DO UPDATE 
       SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, estado = EXCLUDED.estado;`
    );
    await client.query(`
      INSERT INTO public.bloques_citas (id_bloque, id_cita)
      VALUES ('2026-10-24 15:30:00', 14)
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      UPDATE public.bloques_horario SET ocupacion = true 
      WHERE inicio = '2026-10-24 15:30:00';
    `);

    // 7. Citas para los otros días del mes de Octubre 2026 según los badges del calendario en Imagen 3:
    // Oct 1: 2 citas
    // Oct 6: 1 cita
    // Oct 8: 3 citas
    // Oct 13: 2 citas
    // Oct 15: 4 citas
    // Oct 20: 3 citas
    // Oct 22: 5 citas
    // Oct 26: 2 citas
    // Oct 29: 3 citas
    // Oct 30: 1 cita
    const monthAppointmentsPlan = [
      { day: 1, count: 2, times: ['09:00', '11:00'] },
      { day: 6, count: 1, times: ['10:00'] },
      { day: 8, count: 3, times: ['08:30', '10:30', '14:00'] },
      { day: 13, count: 2, times: ['09:30', '15:00'] },
      { day: 15, count: 4, times: ['08:30', '10:00', '11:30', '14:30'] },
      { day: 20, count: 3, times: ['09:00', '11:00', '16:00'] },
      { day: 22, count: 5, times: ['08:30', '10:00', '11:30', '14:00', '15:30'] },
      { day: 26, count: 2, times: ['09:00', '14:00'] },
      { day: 29, count: 3, times: ['08:30', '11:00', '15:30'] },
      { day: 30, count: 1, times: ['10:00'] },
    ];

    let seedCitaId = 100;
    for (const plan of monthAppointmentsPlan) {
      const dayStr = plan.day.toString().padStart(2, '0');
      const dateStr = `2026-10-${dayStr}`;

      for (let i = 0; i < plan.times.length; i++) {
        const time = plan.times[i];
        const blockStart = `${dateStr} ${time}:00`;
        const pacId = (i % 4) + 1;
        const docId = i % 2 === 0 ? 101 : 102;
        seedCitaId++;

        // Asegurar que el bloque existe
        await client.query(
          `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
           VALUES ($1, $1::timestamp + interval '30 minute', true, true)
           ON CONFLICT (inicio) DO UPDATE SET ocupacion = true;`,
          [blockStart]
        );

        await client.query(
          `INSERT INTO public.cita (id_cita, titulo, descripcion, id_paciente, id_usuario, estado)
           VALUES ($1, 'Control Odontológico', 'Consulta programada en agenda médica', $2, $3, 'Confirmada')
           ON CONFLICT (id_cita) DO UPDATE SET estado = 'Confirmada';`,
          [seedCitaId, pacId, docId]
        );

        await client.query(
          `INSERT INTO public.bloques_citas (id_bloque, id_cita)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING;`,
          [blockStart, seedCitaId]
        );
      }
    }

    console.log('✅ Citas del mes de Octubre 2026 registradas.');

    await client.query('COMMIT');
    console.log('🎉 Seeding completado exitosamente en base de datos PostgreSQL.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error ejecutando seeding:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
