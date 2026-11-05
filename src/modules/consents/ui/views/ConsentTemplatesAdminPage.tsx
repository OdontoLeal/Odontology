// src/modules/consents/ui/views/ConsentTemplatesAdminPage.tsx
import React, { useMemo, useState } from 'react';
import { useConsents, ConsentTemplateItem, ConsentTemplateTipo } from '../hooks/useConsents';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Input } from '../../../../shared/ui/components/Input';
import { PageLayout } from '../../../../shared/ui/components/PageLayout';
import {
  PageHeader,
  PageHeaderAction,
  PlusIcon,
} from '../../../../shared/ui/components/PageHeader';
import {
  PageToolbar,
  ToolbarSearch,
  ToolbarSegmented,
} from '../../../../shared/ui/components/PageToolbar';
import { ListState } from '../../../../shared/ui/components/PageList';
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

const TEMPLATE_STATUS_OPTIONS = [
  { id: 'ALL', label: 'Todas' },
  { id: 'ACTIVE', label: 'Activas' },
  { id: 'INACTIVE', label: 'Inactivas' },
] as const;

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const ConsentTemplatesAdminPage: React.FC = () => {
  const { templates, toggleTemplateStatus, saveTemplate, isLoading } = useConsents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplateItem | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTipo, setFormTipo] = useState<ConsentTemplateTipo>('PROCEDIMIENTO');
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const filteredTemplates = useMemo(() => {
    const query = normalizeText(searchQuery.trim());
    return templates.filter((tpl) => {
      if (statusFilter === 'ACTIVE' && !tpl.activo) return false;
      if (statusFilter === 'INACTIVE' && tpl.activo) return false;
      return !query || normalizeText(tpl.titulo).includes(query);
    });
  }, [templates, searchQuery, statusFilter]);

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
        message:
          'El título del consentimiento y el texto legal del cuerpo son obligatorios (RF-CON-004).',
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
      .catch((err: Error) =>
        showAlert({ title: 'No se guardó la plantilla', message: err.message, type: 'error' })
      );
  };

  return (
    <PageLayout>
      <AlertModalComponent />

      <PageHeader
        eyebrow="Gestión Documental"
        eyebrowDetail="Modelos Médico-Legales (ROL-ADM)"
        title="Consentimientos"
        subtitle="Plantillas con versionamiento incremental (v1.0 → v2.0) e inactivación de modelos médico-legales."
        actions={
          <PageHeaderAction variant="primary" onClick={handleOpenCreate} leftIcon={<PlusIcon />}>
            Nueva Plantilla
          </PageHeaderAction>
        }
      />

      <PageToolbar aria-label="Filtros de plantillas de consentimiento">
        <ToolbarSearch
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar plantilla por nombre..."
          aria-label="Buscar plantilla por nombre"
        />

        <ToolbarSegmented
          aria-label="Filtrar plantillas por estado"
          value={statusFilter}
          onChange={setStatusFilter}
          options={TEMPLATE_STATUS_OPTIONS}
        />
      </PageToolbar>

      {/* Estado de carga */}
      {isLoading && (
        <ListState>
          <p className="text-xs font-semibold text-[#64748B]">
            Cargando plantillas de consentimiento desde la base de datos...
          </p>
        </ListState>
      )}

      {/* Estado vacío informativo cuando no hay plantillas en BD */}
      {!isLoading && templates.length === 0 && (
        <div className="space-y-4 rounded-xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FBF3D5] text-2xl text-[#B8942A]">
            📋
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-[#1E242B]">
              No hay plantillas de consentimientos en la base de datos
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Actualmente no existen plantillas de consentimiento informadas registradas. Para que
              los odontólogos y auxiliares puedan tomar consentimientos desde la ficha de los
              pacientes (RF-CON-001), registre al menos un modelo médico-legal.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={handleLoadSampleTemplate} leftIcon={<span>⚡</span>}>
              Cargar Plantilla Sugerida (Blanqueamiento Dental)
            </Button>
          </div>
        </div>
      )}

      {/* Sin coincidencias para el filtro actual */}
      {!isLoading && templates.length > 0 && filteredTemplates.length === 0 && (
        <ListState role="status">
          <p className="text-base font-bold text-[#1E242B]">Ninguna coincidencia encontrada</p>
          <p className="text-[13px] text-[#64748B]">
            No se encontraron plantillas que coincidan con los criterios seleccionados.
          </p>
        </ListState>
      )}

      {/* Grid de Plantillas */}
      {!isLoading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredTemplates.map((tpl) => (
            <article
              key={tpl.idPlantilla}
              className={`flex min-w-0 flex-col justify-between gap-3 rounded-xl border bg-white px-5 py-4 transition-colors ${
                tpl.activo
                  ? 'border-[#E2E8F0] hover:border-[#D4AF37]/50'
                  : 'border-dashed border-[#CBD5E1] opacity-70'
              }`}
            >
              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge label={`Versión v${tpl.version}.0`} variant="neutral" size="sm" />
                  {tpl.tipo !== 'PROCEDIMIENTO' && (
                    <Badge
                      label={
                        tpl.tipo === 'AUTORIZACION_DATOS'
                          ? 'Autorización de datos'
                          : 'Menores de edad'
                      }
                      variant="gold"
                      size="sm"
                      className="whitespace-nowrap"
                    />
                  )}
                  <Badge
                    label={tpl.activo ? 'Activa' : 'Inactiva'}
                    variant={tpl.activo ? 'success' : 'neutral'}
                    size="sm"
                  />
                </div>

                <h2
                  title={tpl.titulo}
                  className="truncate text-[15px] font-bold leading-snug text-[#1E242B]"
                >
                  {tpl.titulo}
                </h2>

                <p className="text-[13px] text-[#64748B] line-clamp-3 leading-relaxed whitespace-pre-line">
                  {tpl.cuerpoTexto}
                </p>

                <div className="text-[11px] text-[#64748B]">
                  Fecha actualización: {tpl.fechaCreacion}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => toggleTemplateStatus(tpl.idPlantilla)}
                  className="text-xs font-bold text-[#64748B] hover:text-[#1E242B] underline"
                >
                  {tpl.activo ? 'Inactivar Plantilla' : 'Activar Plantilla'}
                </button>

                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(tpl)}>
                  Editar (Genera v{tpl.version + 1}.0)
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {/* Modal de Creación / Edición */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingTemplate
            ? `Editar Plantilla (Crea Versión v${editingTemplate.version + 1}.0)`
            : 'Nueva Plantilla de Consentimiento'
        }
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
                <option value="AUTORIZACION_DATOS">
                  Autorización de tratamiento de datos (aviso de privacidad)
                </option>
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
              {editingTemplate
                ? `Guardar y Publicar v${editingTemplate.version + 1}.0`
                : 'Crear Plantilla v1.0'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
};
