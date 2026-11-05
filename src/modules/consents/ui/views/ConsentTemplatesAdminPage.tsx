// src/modules/consents/ui/views/ConsentTemplatesAdminPage.tsx
import React, { useState } from 'react';
import { useConsents, ConsentTemplateItem, ConsentTemplateTipo } from '../hooks/useConsents';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Input } from '../../../../shared/ui/components/Input';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { AVAILABLE_TEMPLATE_PLACEHOLDERS } from '../../domain/consent-template-interpolator';

const SAMPLE_BLANQUEAMIENTO_TITLE =
  'Consentimiento Informado para Tratamiento de Blanqueamiento Dental';

const SAMPLE_BLANQUEAMIENTO_BODY = `CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE BLANQUEAMIENTO DENTAL
CONSULTORIO ODONTOLÓGICO DR. EDUAR LEAL ÁLVAREZ

Yo, {{nombre_paciente}}, identificado(a) con documento de identidad N.º {{documento_paciente}}, en pleno uso de mis facultades mentales, manifiesto que he sido informado(a) de manera clara, comprensible y oportuna por parte del profesional tratante sobre la naturaleza, alcances, beneficios, riesgos y cuidados del procedimiento de blanqueamiento dental.

1. Declaración del Procedimiento y Riesgos:
Comprendo que el blanqueamiento dental busca aclarar el tono de los dientes mediante agentes químicos controlados. Se me ha advertido que puedo experimentar sensibilidad dental transitoria durante o después del tratamiento, así como irritación gingival leve. Entiendo que el grado de aclaramiento varía en cada paciente y que las restauraciones existentes (resinas, coronas, carillas) no cambiarán de color con este procedimiento.

2. Recomendaciones y Compromisos:
Me comprometo a seguir las instrucciones post-tratamiento indicadas por el profesional tratante, incluyendo la restricción temporal de alimentos y bebidas con alta pigmentación (café, té, vino, bebidas oscuras) y el consumo de tabaco.

3. Autorización:
Habiendo resuelto todas mis inquietudes de manera satisfactoria y sin que medie coacción alguna, autorizo expresamente la realización del procedimiento de blanqueamiento dental.

Firmante:
{{leyenda_firmante}}{{datos_acudiente}}`;

export const ConsentTemplatesAdminPage: React.FC = () => {
  const { templates, toggleTemplateStatus, saveTemplate, isLoading } = useConsents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplateItem | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTipo, setFormTipo] = useState<ConsentTemplateTipo>('PROCEDIMIENTO');
  const { showAlert, AlertModalComponent } = useAlertModal();

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormBody('');
    setFormTipo('PROCEDIMIENTO');
    setIsModalOpen(true);
  };

  const handleLoadSampleTemplate = () => {
    setEditingTemplate(null);
    setFormTitle(SAMPLE_BLANQUEAMIENTO_TITLE);
    setFormBody(SAMPLE_BLANQUEAMIENTO_BODY);
    setIsModalOpen(true);
  };

  const handleInsertVariable = (variable: string) => {
    setFormBody((prev) => (prev ? `${prev} ${variable}` : variable));
  };

  const handleOpenEdit = (t: ConsentTemplateItem) => {
    setEditingTemplate(t);
    setFormTitle(t.titulo);
    setFormBody(t.cuerpoTexto);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) {
      showAlert({
        title: 'Campos Incompletos',
        message: 'El título del consentimiento y el texto legal del cuerpo son obligatorios (RF-CON-004).',
        type: 'warning',
      });
      return;
    }

    saveTemplate({
      idPlantilla: editingTemplate?.idPlantilla,
      titulo: formTitle.trim(),
      cuerpoTexto: formBody.trim(),
      tipo: editingTemplate?.tipo ?? formTipo,
    })
      .then(() => setIsModalOpen(false))
      .catch((err: Error) => showAlert({ title: 'No se guardó la plantilla', message: err.message, type: 'error' }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <AlertModalComponent />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
              Plantillas de Consentimientos Informados
            </h1>
            <Badge label="Gestión ROL-ADM" variant="gold" size="sm" />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#687380]">
            Creación, edición con versionamiento incremental (v1.0 → v2.0) e inactivación de modelos médico-legales.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} leftIcon={<span>+</span>}>
          Nueva Plantilla
        </Button>
      </div>

      {/* Estado de carga */}
      {isLoading && (
        <div className="rounded-3xl border border-[#E2E6EA] bg-white p-12 text-center text-xs font-semibold text-[#687380] shadow-xs">
          Cargando plantillas de consentimiento desde la base de datos...
        </div>
      )}

      {/* Estado vacío informativo cuando no hay plantillas en BD */}
      {!isLoading && templates.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-[#CBD2D9] bg-white p-10 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FBF3D5] text-[#B8942A] text-2xl">
            📋
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-extrabold text-[#1E242B]">
              No hay plantillas de consentimientos en la base de datos
            </h3>
            <p className="text-xs text-[#687380] leading-relaxed">
              Actualmente no existen plantillas de consentimiento informadas registradas. Para que los odontólogos y auxiliares puedan tomar consentimientos desde la ficha de los pacientes (RF-CON-001), registre al menos un modelo médico-legal.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" onClick={handleOpenCreate} leftIcon={<span>+</span>}>
              Crear Nueva Plantilla
            </Button>
            <Button
              variant="outline"
              onClick={handleLoadSampleTemplate}
              leftIcon={<span>⚡</span>}
            >
              Cargar Plantilla Sugerida (Blanqueamiento Dental)
            </Button>
          </div>
        </div>
      )}

      {/* Grid de Plantillas */}
      {!isLoading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl.idPlantilla}
              className={`rounded-3xl border p-6 bg-white shadow-xs space-y-4 flex flex-col justify-between transition-all ${
                tpl.activo ? 'border-[#E2E6EA]' : 'border-dashed border-[#CBD2D9] opacity-70'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge label={`Versión v${tpl.version}.0`} variant="neutral" size="sm" />
                  {tpl.tipo !== 'PROCEDIMIENTO' && (
                    <Badge
                      label={tpl.tipo === 'AUTORIZACION_DATOS' ? 'Autorización de datos' : 'Menores de edad'}
                      variant="gold"
                      size="sm"
                    />
                  )}
                  <Badge
                    label={tpl.activo ? 'Activa' : 'Inactiva'}
                    variant={tpl.activo ? 'success' : 'neutral'}
                    size="sm"
                  />
                </div>

                <h3 className="text-base font-extrabold text-[#1E242B]">
                  {tpl.titulo}
                </h3>

                <p className="text-xs text-[#687380] line-clamp-3 leading-relaxed whitespace-pre-line">
                  {tpl.cuerpoTexto}
                </p>

                <div className="text-[11px] text-[#8F99A3] pt-2">
                  Fecha actualización: {tpl.fechaCreacion}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E2E6EA]">
                <button
                  type="button"
                  onClick={() => toggleTemplateStatus(tpl.idPlantilla)}
                  className="text-xs font-bold text-[#687380] hover:text-[#1E242B] underline"
                >
                  {tpl.activo ? 'Inactivar Plantilla' : 'Activar Plantilla'}
                </button>

                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(tpl)}>
                  Editar (Genera v{tpl.version + 1}.0)
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Creación / Edición */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTemplate ? `Editar Plantilla (Crea Versión v${editingTemplate.version + 1}.0)` : 'Nueva Plantilla de Consentimiento'}
        subtitle="Conforme a RF-CON-007, cualquier modificación genera una nueva versión preservando los PDFs ya suscritos."
        maxWidth="3xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Título del Consentimiento"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Ej: Consentimiento para Tratamiento de Blanqueamiento Dental"
          />

          {!editingTemplate && (
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
                Tipo de plantilla
              </label>
              <select
                value={formTipo}
                onChange={(e) => setFormTipo(e.target.value as ConsentTemplateTipo)}
                className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3 text-sm text-[#1E242B]"
              >
                <option value="PROCEDIMIENTO">Consentimiento de un procedimiento</option>
                <option value="AUTORIZACION_DATOS">Autorización de tratamiento de datos (aviso de privacidad)</option>
                <option value="MENORES">Plantilla de menores de edad (firma el acudiente)</option>
              </select>
              <p className="mt-1 text-[11px] text-[#8F99A3]">
                Solo puede haber una plantilla activa de autorización de datos y una de menores.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380]">
                Cuerpo Legal del Documento <span className="text-[#DC2626]">*</span>
              </label>
              <span className="text-[11px] text-[#8F99A3]">
                Haga clic en una variable para insertarla en el texto
              </span>
            </div>

            {/* Chips de variables disponibles (RF-CON-004) */}
            <div className="mb-2 flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
              {AVAILABLE_TEMPLATE_PLACEHOLDERS.map((v) => (
                <button
                  key={v.placeholder}
                  type="button"
                  onClick={() => handleInsertVariable(v.placeholder)}
                  title={`${v.descripcion} (Ejemplo: ${v.ejemplo})`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/40 bg-[#FBF6E6] px-2 py-1 text-[11px] font-mono font-bold text-[#B8942A] hover:bg-[#D4AF37] hover:text-[#111111] transition-colors"
                >
                  <span>{v.placeholder}</span>
                  <span className="text-[10px] opacity-70">+</span>
                </button>
              ))}
            </div>

            <textarea
              rows={9}
              required
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Describa el procedimiento, objetivos, riesgos previsibles, molestias comunes, contraindicaciones y cuidados postoperatorios. Use {{nombre_paciente}}, {{documento_paciente}}, {{leyenda_firmante}} para incrustar datos dinámicos..."
              className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs leading-relaxed text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E6EA]">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingTemplate ? `Guardar y Publicar v${editingTemplate.version + 1}.0` : 'Crear Plantilla v1.0'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
