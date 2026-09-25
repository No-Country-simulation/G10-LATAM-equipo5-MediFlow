import { useState, useMemo } from 'react';
import { Files, Inbox } from 'lucide-react';
import { MOCK_TRIAGE_DOCUMENTS } from '../components/dashboard/triageData';
import DocumentFilters from '../components/documents/DocumentFilters';
import DocumentRepositoryCard from '../components/documents/DocumentRepositoryCard';
import type { DocumentCategoryFilter, DocumentDestinationFilter } from '../types/documents';

const DocumentsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategoryFilter>('ALL');
  const [selectedDestination, setSelectedDestination] =
    useState<DocumentDestinationFilter>('ALL');

  const filteredDocs = useMemo(() => {
    return MOCK_TRIAGE_DOCUMENTS.filter((doc) => {
      if (
        selectedCategory === 'RECETAS' &&
        doc.clasificacion.tipo_documento !== 'Receta Médica'
      ) {
        return false;
      }
      if (
        selectedCategory === 'IMAGENES' &&
        doc.clasificacion.tipo_documento !== 'Informe de Estudio por Imágenes'
      ) {
        return false;
      }
      if (
        selectedCategory === 'LABORATORIO' &&
        doc.clasificacion.tipo_documento !== 'Laboratorio'
      ) {
        return false;
      }
      if (
        selectedCategory === 'PROCEDIMIENTOS' &&
        doc.clasificacion.tipo_documento !== 'Orden de Solicitud de Procedimiento'
      ) {
        return false;
      }
      if (
        selectedCategory === 'EPICRISIS' &&
        doc.clasificacion.tipo_documento !== 'Epicrisis / Informe de Alta'
      ) {
        return false;
      }
      if (
        selectedCategory === 'CERTIFICADOS' &&
        doc.clasificacion.tipo_documento !== 'Certificado Médico'
      ) {
        return false;
      }

      if (
        selectedDestination === 'FARMACIA' &&
        doc.decision_enrutamiento.destino_principal !== 'Farmacia_Hospitalaria'
      ) {
        return false;
      }
      if (
        selectedDestination === 'URGENCIAS' &&
        doc.decision_enrutamiento.destino_principal !== 'Cola_Emergencia_Medica'
      ) {
        return false;
      }
      if (
        selectedDestination === 'AUTORIZACIONES' &&
        doc.decision_enrutamiento.destino_principal !== 'Auditoria_Autorizaciones'
      ) {
        return false;
      }
      if (
        selectedDestination === 'FICHA_CLINICA' &&
        doc.decision_enrutamiento.destino_principal !== 'Historia_Clinica_Electronica'
      ) {
        return false;
      }

      return true;
    });
  }, [selectedCategory, selectedDestination]);

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Expedientes y Flujos Documentales</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
              Repositorio Clínico
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión centralizada del repositorio clínico, trazabilidad de derivaciones y archivo
            digital asistencial.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-1.5">
            <Files className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Total listados:</span>
            <span className="font-mono font-bold text-white">{filteredDocs.length}</span>
          </div>
        </div>
      </div>

      <DocumentFilters
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedDestination={selectedDestination}
        onSelectDestination={setSelectedDestination}
      />

      <div className="space-y-3">
        {filteredDocs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">
              No se encontraron expedientes
            </h3>
            <p className="text-xs text-slate-400">
              No hay documentos clínicos que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <DocumentRepositoryCard key={doc.documento_id} doc={doc} />
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;
