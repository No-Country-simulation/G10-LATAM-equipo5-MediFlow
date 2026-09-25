import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { CLINICAL_SAMPLES, type ClinicalSample } from '../../types/ingestion';

interface DocumentDropzoneProps {
  selectedFile: ClinicalSample | null;
  onSelectFile: (file: ClinicalSample) => void;
  disabled?: boolean;
}

const DocumentDropzone = ({
  selectedFile,
  onSelectFile,
  disabled = false,
}: DocumentDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>, status: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(status);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const isPng = file.type === 'image/png';
      const isJpg = file.type === 'image/jpeg';
      onSelectFile({
        name: file.name,
        category: 'Documento clínico digital',
        format: isPng ? 'PNG' : isJpg ? 'JPG' : 'PDF',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      });
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const isPng = file.type === 'image/png';
      const isJpg = file.type === 'image/jpeg';
      onSelectFile({
        name: file.name,
        category: 'Documento clínico digital',
        format: isPng ? 'PNG' : isJpg ? 'JPG' : 'PDF',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-slate-800 bg-slate-900/30'
            : isDragging
              ? 'border-emerald-400 bg-emerald-500/10 cursor-pointer'
              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg"
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Arrastre y suelte el documento clínico aquí o haga clic para examinar
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Formatos admitidos: PDF, PNG, JPG (informes de laboratorio, recetas u órdenes médicas)
            </p>
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">{selectedFile.name}</div>
              <div className="text-[11px] text-slate-400">
                {selectedFile.category} • {selectedFile.format} ({selectedFile.size})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Documento seleccionado</span>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Documentos clínicos de muestra para pruebas rápidas:</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {CLINICAL_SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={disabled}
              onClick={() => onSelectFile(sample)}
              className={`text-left p-3 rounded-xl border transition-all text-xs cursor-pointer disabled:opacity-50 ${
                selectedFile?.name === sample.name
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-slate-900/50 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-slate-200 truncate">{sample.name}</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">{sample.category}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                {sample.format} • {sample.size}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentDropzone;
