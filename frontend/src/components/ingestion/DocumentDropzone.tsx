import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { ALLOWED_EXTENSIONS } from '../../services/ingestionService';

interface DocumentDropzoneProps {
  onSelectFile: (file: File) => void;
  disabled?: boolean;
}

const DocumentDropzone = ({ onSelectFile, disabled = false }: DocumentDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!disabled && file) onSelectFile(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
    // Reset so the same file can be re-selected after "Cambiar archivo".
    e.target.value = '';
  };

  const stateClass = disabled
    ? 'opacity-60 cursor-not-allowed border-slate-800 bg-slate-900/30'
    : isDragging
      ? 'border-emerald-400 bg-emerald-500/10 cursor-pointer'
      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 cursor-pointer';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${stateClass}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleInputChange}
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
          <p className="text-xs text-slate-400 mt-1">Formatos admitidos: PDF, PNG, JPG, JPEG (máx. 10 MB)</p>
        </div>
      </div>
    </div>
  );
};

export default DocumentDropzone;
