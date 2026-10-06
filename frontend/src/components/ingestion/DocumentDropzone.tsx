import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import type { ClinicalSample } from '../../types/ingestion';
import { ClinicalSampleList } from './ClinicalSampleList';

interface DocumentDropzoneProps {
  selectedFile: ClinicalSample | null;
  onSelectFile: (file: ClinicalSample) => void;
  disabled?: boolean;
}

function fileFormat(mimeType: string): 'PNG' | 'JPG' | 'PDF' {
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/jpeg') return 'JPG';
  return 'PDF';
}

function fileToClinicalSample(file: File): ClinicalSample {
  return {
    name: file.name,
    category: 'Documento clínico digital',
    format: fileFormat(file.type),
    size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    file,
  };
}

const DocumentDropzone = ({
  selectedFile,
  onSelectFile,
  disabled = false,
}: DocumentDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!disabled && file) onSelectFile(fileToClinicalSample(file));
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(fileToClinicalSample(file));
  };

  const dropzoneClass = `border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
    disabled
      ? 'opacity-60 cursor-not-allowed border-slate-800 bg-slate-900/30'
      : isDragging
        ? 'border-emerald-400 bg-emerald-500/10 cursor-pointer'
        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 cursor-pointer'
  }`;

  return (
    <div className="space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={dropzoneClass}
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

      <ClinicalSampleList
        selectedFileName={selectedFile?.name}
        onSelectFile={onSelectFile}
        disabled={disabled}
      />
    </div>
  );
};

export default DocumentDropzone;
