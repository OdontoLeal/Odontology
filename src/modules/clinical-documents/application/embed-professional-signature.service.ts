import {
  ClinicalDocumentDetails,
  ConsultationContextData,
  ModoFirmaDocumento,
  TipoDocumentoClinico,
} from '../domain/clinical-document.repository.interface';

export interface AuthenticatedProfessionalActor {
  idUsuario: number;
  nombreCompleto: string;
  roles: string[];
  firmaImagenUrl?: string | null;
}

export interface PdfGenerationPayload {
  tipoDocumento: TipoDocumentoClinico;
  encabezadoConsultorio: {
    nombreConsultorio: string;
    logotipoAsset: string;
    marcaDeAguaTexto: string;
  };
  paciente: {
    nombreCompleto: string;
    documentoIdentidad: string;
    edad: number;
    sexo: string;
  };
  detalles: ClinicalDocumentDetails;
  firmaProfesional: {
    modoFirma: ModoFirmaDocumento;
    nombreProfesional: string;
    imagenFirmaUrl: string | null;
    aplicarFlatten: boolean;
    mostrarCampoEnBlanco: boolean;
  };
  fechaExpedicionColombia: string;
  horaExpedicionColombia: string;
}

export interface IPdfFlattenPort {
  renderAndFlattenClinicalPdf(payload: PdfGenerationPayload): Promise<{ archivoPdfUrl: string }>;
}

export interface EmbeddedSignatureResult {
  archivoPdfUrl: string;
  modoFirmaAplicado: ModoFirmaDocumento;
  firmaFusionada: boolean;
  aviso?: string;
  fechaExpedicionColombia: string;
  horaExpedicionColombia: string;
}

export class EmbedProfessionalSignatureService {
  constructor(private readonly pdfFlattenPort?: IPdfFlattenPort) {}

  /**
   * Valida que el actor sea el profesional responsable (ROL-ODO o ROL-ESP) y que
   * la cita se encuentre "En consulta" o dentro del mismo día calendario hasta las 23:59 (UTC-5).
   */
  public validarPermisoYVentanaTemporal(
    actor: AuthenticatedProfessionalActor,
    contexto: ConsultationContextData,
    ahora: Date = new Date()
  ): void {
    const tieneRolProfesional = actor.roles.some(
      (rol) => rol === 'ROL-ODO' || rol === 'ROL-ESP'
    );

    if (!tieneRolProfesional) {
      throw new Error('No tiene permiso para realizar esta acción');
    }

    // Regla de Negocio 5 y 9: Solo el profesional responsable de la cita prescribe y firma con su propia cuenta
    if (actor.idUsuario !== contexto.cita.idProfesionalResponsable) {
      throw new Error('No tiene permiso para realizar esta acción');
    }

    const estadoCita = contexto.cita.estado;
    if (estadoCita === 'En consulta') {
      return;
    }

    // RQNF-FUN-001: Hasta las 23:59 (hora Colombia UTC-5) del día de la cita atendida/en curso
    const estadosPermitidosMismoDia = ['En consulta', 'Atendida'];
    if (!estadosPermitidosMismoDia.includes(estadoCita)) {
      throw new Error(
        'Solo se pueden generar documentos clínicos mientras la cita está "En consulta" o hasta las 23:59 del día de la atención.'
      );
    }

    if (contexto.cita.fechaInicioCita) {
      const esMismoDia = this.esMismoDiaCalendarioColombia(
        new Date(contexto.cita.fechaInicioCita),
        ahora
      );
      if (!esMismoDia) {
        throw new Error(
          'El plazo para generar documentos clínicos en esta consulta venció a las 23:59 del día de la cita.'
        );
      }
    }
  }

  /**
   * RF-DOC-004: Inserta la firma registrada del profesional fusionándola (flatten) con el PDF,
   * o deja el campo de firma en blanco si eligió "FIRMA_MANUSCRITA" o no tiene firma registrada.
   */
  public async generarPdfConFirma(params: {
    actor: AuthenticatedProfessionalActor;
    contexto: ConsultationContextData;
    tipoDocumento: TipoDocumentoClinico;
    pacienteEdad: number;
    detalles: ClinicalDocumentDetails;
    modoFirma?: ModoFirmaDocumento;
    archivoPdfUrlPreexistente?: string;
    ahora?: Date;
  }): Promise<EmbeddedSignatureResult> {
    const fechaActual = params.ahora ?? new Date();
    const { fechaDDMMAAAA, hora12h } = this.formatearFechaHoraColombia(fechaActual);

    const modoSolicitado: ModoFirmaDocumento =
      params.modoFirma ?? 'CON_FIRMA_REGISTRADA';

    const urlFirmaProfesional =
      params.actor.firmaImagenUrl ?? params.contexto.cita.firmaProfesionalUrl ?? null;

    let firmaFusionada = false;
    let mostrarCampoEnBlanco = false;
    let aviso: string | undefined;

    if (modoSolicitado === 'FIRMA_MANUSCRITA') {
      mostrarCampoEnBlanco = true;
    } else if (!urlFirmaProfesional) {
      // RF-DOC-004: Si no tiene imagen registrada, sale con el campo de firma en blanco y un aviso
      mostrarCampoEnBlanco = true;
      aviso =
        'El profesional no tiene una imagen de firma registrada. El documento se generó con el campo de firma en blanco para firma manuscrita.';
    } else {
      firmaFusionada = true;
    }

    const pdfPayload: PdfGenerationPayload = {
      tipoDocumento: params.tipoDocumento,
      encabezadoConsultorio: {
        nombreConsultorio: 'Consultorio Odontológico Dr. Eduar Leal Álvarez',
        logotipoAsset: 'assets/branding/logo-odontoleal.png',
        marcaDeAguaTexto: 'ODONTOLEAL - DOCUMENTO CLÍNICO OFICIAL',
      },
      paciente: {
        nombreCompleto: params.contexto.paciente.nombreCompleto,
        documentoIdentidad: params.contexto.paciente.documentoIdentidad,
        edad: params.pacienteEdad,
        sexo: params.contexto.paciente.sexo ?? '',
      },
      detalles: params.detalles,
      firmaProfesional: {
        modoFirma: modoSolicitado,
        nombreProfesional: params.actor.nombreCompleto,
        imagenFirmaUrl: firmaFusionada ? urlFirmaProfesional : null,
        aplicarFlatten: firmaFusionada,
        mostrarCampoEnBlanco,
      },
      fechaExpedicionColombia: fechaDDMMAAAA,
      horaExpedicionColombia: hora12h,
    };

    let archivoPdfUrl = params.archivoPdfUrlPreexistente?.trim() || '';

    if (this.pdfFlattenPort) {
      const generado = await this.pdfFlattenPort.renderAndFlattenClinicalPdf(pdfPayload);
      archivoPdfUrl = generado.archivoPdfUrl;
    } else if (!archivoPdfUrl) {
      const slugTipo = params.tipoDocumento.toLowerCase().replace(/_/g, '-');
      archivoPdfUrl = `/storage/clinical-documents/${params.contexto.paciente.idPaciente}/cita-${params.contexto.cita.idCita}-${slugTipo}-${Date.now()}-flattened.pdf`;
    }

    return {
      archivoPdfUrl,
      modoFirmaAplicado: firmaFusionada ? 'CON_FIRMA_REGISTRADA' : 'FIRMA_MANUSCRITA',
      firmaFusionada,
      aviso,
      fechaExpedicionColombia: fechaDDMMAAAA,
      horaExpedicionColombia: hora12h,
    };
  }

  public formatearFechaHoraColombia(fecha: Date): {
    fechaDDMMAAAA: string;
    hora12h: string;
  } {
    const offsetColombiaMs = -5 * 60 * 60 * 1000;
    const colDate = new Date(fecha.getTime() + offsetColombiaMs);

    const dia = String(colDate.getUTCDate()).padStart(2, '0');
    const mes = String(colDate.getUTCMonth() + 1).padStart(2, '0');
    const ano = colDate.getUTCFullYear();

    let horas = colDate.getUTCHours();
    const minutos = String(colDate.getUTCMinutes()).padStart(2, '0');
    const periodo = horas >= 12 ? 'p. m.' : 'a. m.';
    horas = horas % 12;
    if (horas === 0) horas = 12;

    return {
      fechaDDMMAAAA: `${dia}/${mes}/${ano}`,
      hora12h: `${String(horas).padStart(2, '0')}:${minutos} ${periodo}`,
    };
  }

  private esMismoDiaCalendarioColombia(fechaA: Date, fechaB: Date): boolean {
    const offsetColombiaMs = -5 * 60 * 60 * 1000;
    const colA = new Date(fechaA.getTime() + offsetColombiaMs);
    const colB = new Date(fechaB.getTime() + offsetColombiaMs);

    return (
      colA.getUTCFullYear() === colB.getUTCFullYear() &&
      colA.getUTCMonth() === colB.getUTCMonth() &&
      colA.getUTCDate() === colB.getUTCDate()
    );
  }
}