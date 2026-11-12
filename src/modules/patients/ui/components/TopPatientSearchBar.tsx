// src/modules/patients/ui/components/TopPatientSearchBar.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PatientListItem } from '../hooks/usePatients';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface TopPatientSearchBarProps {
  onSelectPatient: (patient: PatientListItem) => void;
  placeholder?: string;
}

export const TopPatientSearchBar: React.FC<TopPatientSearchBarProps> = ({
  onSelectPatient,
  placeholder = 'Buscar paciente por nombre o CC...',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PatientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Búsqueda remota con Debounce y AbortController para alto rendimiento
  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/patients?q=${encodeURIComponent(searchTerm)}`, {
        signal: controller.signal,
      });

      if (res.ok) {
        const json = await res.json();
        const rawData: any[] = json?.data || [];
        const mapped: PatientListItem[] = rawData.map((p) => {
          let edadCalc: number | undefined = undefined;
          if (p.fechaNacimiento) {
            const b = new Date(p.fechaNacimiento);
            if (!isNaN(b.getTime())) {
              const today = new Date();
              let age = today.getFullYear() - b.getFullYear();
              const m = today.getMonth() - b.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
              edadCalc = age >= 0 ? age : undefined;
            }
          }

          return {
            idPaciente: p.idPaciente,
            nombreCompleto: p.nombreCompleto,
            documentoIdentidad: p.documentoIdentidad,
            fechaNacimiento: p.fechaNacimiento || '',
            sexo: p.sexo || 'Ambiguo',
            correo: p.correo || '',
            telefono: p.telefono || '',
            datosIncompletos: Boolean(p.datosIncompletos),
            edad: edadCalc,
          };
        });

        setSuggestions(mapped.slice(0, 6));
        setIsOpen(true);
        setSelectedIndex(-1);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error buscando pacientes en la barra superior:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val.trim());
    }, 220);
  };

  const handleSelect = (patient: PatientListItem) => {
    setIsOpen(false);
    setQuery('');
    setSuggestions([]);
    onSelectPatient(patient);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0 md:max-w-md">
      {/* Icono Buscador / Spinner */}
      <span
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]"
        aria-hidden="true"
      >
        {isLoading ? (
          <div className="h-4 w-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </span>

      {/* Input de Búsqueda */}
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0 && query.trim().length >= 2) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        role="combobox"
        className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-[#F8F9FA]/70 pl-10 pr-9 py-2 text-[13px] sm:text-sm text-[#1E242B] placeholder-[#94A3B8] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all shadow-2xs"
      />

      {/* Botón de limpiar búsqueda */}
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda rápida"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] hover:text-[#1E242B] hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      )}

      {/* Dropdown Flotante de Sugerencias */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[#E2E6EA] bg-white shadow-2xl overflow-hidden animate-fadeIn">
          {/* Header de sugerencias */}
          <div className="px-4 py-2 bg-[#F8F9FA] border-b border-[#E2E6EA] flex items-center justify-between text-[13px] font-bold text-[#8F99A3]">
            <span>Sugerencias de pacientes</span>
            <span>{suggestions.length} {suggestions.length === 1 ? 'coincidencia' : 'coincidencias'}</span>
          </div>

          {/* Listado de sugerencias */}
          {suggestions.length > 0 ? (
            <div className="max-h-72 overflow-y-auto divide-y divide-[#E2E6EA]/60">
              {suggestions.map((patient, idx) => {
                const isSelected = idx === selectedIndex;
                const initials = patient.nombreCompleto
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={patient.idPaciente}
                    onClick={() => handleSelect(patient)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                    className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#FBF6E6]/60 border-l-4 border-l-[#D4AF37]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Avatar Iniciales */}
                    <div className="h-9 w-9 rounded-full bg-[#1E242B] text-[#D4AF37] font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      {initials}
                    </div>

                    {/* Información Principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-extrabold text-[#1E242B] truncate block">
                          {patient.nombreCompleto}
                        </strong>
                        <Badge label={`CC ${patient.documentoIdentidad}`} variant="neutral" size="sm" />
                        {patient.edad !== undefined && (
                          <span className="text-[13px] text-[#687380] font-semibold">
                            ({patient.edad} años)
                          </span>
                        )}
                        {patient.datosIncompletos && (
                          <Badge label="Incompleto" variant="warning" size="sm" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[13px] text-[#687380] mt-0.5 truncate">
                        {patient.telefono && <span>📞 +57 {patient.telefono}</span>}
                        {patient.correo && <span className="truncate">✉️ {patient.correo}</span>}
                      </div>
                    </div>

                    {/* Indicador de Selección */}
                    <span className="text-xs font-bold text-[#D4AF37] shrink-0 opacity-0 group-hover:opacity-100">
                      Ver Ficha →
                    </span>
                  </div>
                );
              })}
            </div>
          ) : !isLoading ? (
            <div className="p-6 text-center text-xs text-[#8F99A3] space-y-1">
              <span className="text-xl block">🔍</span>
              <p className="font-bold text-[#1E242B]">No se encontraron pacientes</p>
              <p className="text-[13px]">
                No hay resultados para "{query}". Verifique el documento o nombre ingresado.
              </p>
            </div>
          ) : null}

          {/* Footer de Ayuda */}
          {suggestions.length > 0 && (
            <div className="px-4 py-1.5 bg-[#F8F9FA] border-t border-[#E2E6EA] text-[13px] text-[#94A3B8] flex justify-between items-center">
              <span>Navegue con ↑ ↓ y presione Enter</span>
              <span className="font-semibold text-[#D4AF37]">OdontoLeal Búsqueda Rápida</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
