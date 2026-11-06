// src/modules/consents/ui/views/PrivacyNoticePage.tsx
import React from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { usePrivacyNotice } from '../hooks/usePrivacyNotice';
import { formatColombiaDate } from '../../../../shared/domain/colombia-format';
import { PublicNavbar } from '../../../../shared/ui/components/PublicNavbar';

export interface PrivacyNoticePageProps {
  onBack: () => void;
  onNavigateToPublicBooking?: () => void;
}

/** RQNF-SEG-006: aviso de privacidad y política de tratamiento de datos, sin sesión. */
export const PrivacyNoticePage: React.FC<PrivacyNoticePageProps> = ({ onBack, onNavigateToPublicBooking }) => {
  const { notice, isLoading, error } = usePrivacyNotice();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E242B] flex flex-col justify-between">
      <PublicNavbar
        onNavigateToBooking={onNavigateToPublicBooking}
        bookingLabel="Solicitar una cita"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex justify-center items-start">
        <article className="max-w-3xl w-full rounded-3xl bg-white border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] p-6 sm:p-8 shadow-sm space-y-5">
          <header className="space-y-1">
            <p className="text-[13px] font-bold uppercase tracking-widest text-[#D4AF37]">
              Ley 1581 de 2012 · Decreto 1377 de 2013
            </p>
            <h1 className="text-2xl font-extrabold text-[#1E242B]">
              {notice?.nombre ?? 'Aviso de privacidad y política de tratamiento de datos'}
            </h1>
            {notice && (
              <p className="text-xs text-[#64748B]">
                Versión {notice.version}
                {notice.fechaPublicacion ? ` · publicada el ${formatColombiaDate(String(notice.fechaPublicacion).slice(0, 10))}` : ''}
              </p>
            )}
          </header>

          {isLoading && <p className="text-sm text-[#64748B]">Cargando el aviso de privacidad...</p>}
          {error && (
            <p role="alert" className="text-sm text-[#DC2626]">
              {error}
            </p>
          )}
          {notice && (
            <div className="whitespace-pre-line text-sm leading-relaxed text-[#1E242B]">{notice.texto}</div>
          )}

          <footer className="flex flex-wrap gap-3 pt-4 border-t border-[#E2E6EA]">
            <Button variant="outline" onClick={onBack}>
              Volver
            </Button>
            {onNavigateToPublicBooking && (
              <Button variant="primary" onClick={onNavigateToPublicBooking}>
                Solicitar una cita
              </Button>
            )}
          </footer>
        </article>
      </main>

      <footer className="border-t border-[#E2E6EA] bg-white py-5 px-4 text-center text-xs text-[#64748B]">
        © 2026 OdontoLeal • Consultorio Odontológico Dr. Eduar Leal Álvarez • Todos los derechos reservados.
      </footer>
    </div>
  );
};
