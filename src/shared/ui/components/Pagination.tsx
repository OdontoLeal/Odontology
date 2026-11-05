// src/shared/ui/components/Pagination.tsx
import React from 'react';

export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  /** Ej. "paciente registrado" / "pacientes registrados". */
  singularLabel: string;
  pluralLabel: string;
  onPageChange: (page: number) => void;
}

const BUTTON_BASE =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-[13px] font-semibold text-[#1E242B] transition-colors hover:border-[#D4AF37] hover:bg-[#FBF3D5]/40 disabled:cursor-not-allowed disabled:opacity-35';

/** Paginación inferior unificada (Pacientes, Doctores, Roles). */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  singularLabel,
  pluralLabel,
  onPageChange,
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <nav
      aria-label="Paginación"
      className="mt-5 flex flex-col items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white px-5 py-3 sm:flex-row"
    >
      <p className="text-[13px] text-[#64748B]">
        Mostrando{' '}
        <strong className="text-[#1E242B]">
          {start}–{end}
        </strong>{' '}
        de <strong className="text-[#1E242B]">{totalItems}</strong>{' '}
        {totalItems === 1 ? singularLabel : pluralLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          aria-label="Página anterior"
          className={BUTTON_BASE}
        >
          <span aria-hidden="true">←</span>
          <span>Anterior</span>
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const isActive = pageNum === safePage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                aria-label={`Ir a la página ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
                className={`h-9 min-w-9 rounded-lg px-2.5 text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'bg-[#111111] text-white'
                    : 'border border-[#E2E8F0] bg-white text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF3D5]/40'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          aria-label="Página siguiente"
          className={BUTTON_BASE}
        >
          <span>Siguiente</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </nav>
  );
};
