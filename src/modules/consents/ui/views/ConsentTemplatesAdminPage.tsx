// src/modules/consents/ui/views/ConsentTemplatesAdminPage.tsx
import React, { useState } from 'react';
import { useConsents, ConsentTemplateItem } from '../hooks/useConsents';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Input } from '../../../../shared/ui/components/Input';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export const ConsentTemplatesAdminPage: React.FC = () => {
  const { templates, toggleTemplateStatus, saveTemplate } = useConsents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplateItem | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formRequiresDocSign, setFormRequiresDocSign] = useState(true);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormBody('');
    setFormRequiresDocSign(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: ConsentTemplateItem) => {
    setEditingTemplate(t);
    setFormTitle(t.titulo);
    setFormBody(t.cuerpoTexto);
    setFormRequiresDocSign(t.requiereFirmaProfesional);
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
      requiereFirmaProfesional: formRequiresDocSign,
    });
    setIsModalOpen(false);
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

      {/* Grid de Plantillas */}
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
                <Badge
                  label={tpl.activo ? 'Activa' : 'Inactiva'}
                  variant={tpl.activo ? 'success' : 'neutral'}
                  size="sm"
                />
              </div>

              <h3 className="text-base font-extrabold text-[#1E242B]">
                {tpl.titulo}
              </h3>

              <p className="text-xs text-[#687380] line-clamp-3 leading-relaxed">
                {tpl.cuerpoTexto}
              </p>

              <div className="text-[11px] text-[#8F99A3] pt-2">
                Fecha creación: {tpl.fechaCreacion} • {tpl.requiereFirmaProfesional ? 'Requiere firma del odontólogo' : 'Solo firma paciente'}
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
            placeholder="Ej: Consentimiento para Cirugía de Terceros Molares"
          />

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
              Cuerpo Legal del Documento <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              rows={8}
              required
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Describa el procedimiento, objetivos, riesgos previsibles, molestias comunes, contraindicaciones y cuidados postoperatorios..."
              className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs leading-relaxed text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1E242B]">
            <input
              type="checkbox"
              checked={formRequiresDocSign}
              onChange={(e) => setFormRequiresDocSign(e.target.checked)}
              className="h-4 w-4 rounded text-[#D4AF37]"
            />
            Requiere incrustación de firma digital del odontólogo tratante (RF-DOC-004)
          </label>

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
