import { UploadCloud, FileText, Loader2, AlertTriangle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";

import { procesarDocumento, type TriajeFinalSchema } from "../services/api";

interface FileUploadProps {
  onProcessed: (resultado: TriajeFinalSchema) => void;
}

export default function FileUpload({ onProcessed }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      setLastFileName(file.name);
      try {
        const resultado = await procesarDocumento(file);
        onProcessed(resultado);
      } catch {
        setError("No se pudo procesar el documento. Verifica la conexion con el backend.");
      } finally {
        setIsUploading(false);
      }
    },
    [onProcessed],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
      event.target.value = "";
    },
    [handleFile],
  );

  return (
    <div className="file-upload">
      <div
        className={`file-upload__dropzone${isDragging ? " file-upload__dropzone--active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.json"
          className="file-upload__input"
          onChange={handleInputChange}
        />

        {isUploading ? (
          <Loader2 className="file-upload__icon file-upload__icon--spin" size={40} />
        ) : (
          <UploadCloud className="file-upload__icon" size={40} />
        )}

        <p className="file-upload__title">
          {isUploading
            ? "Procesando documento..."
            : "Arrastra un documento clinico o haz clic para seleccionarlo"}
        </p>
        <p className="file-upload__hint">Formatos soportados: PDF, TXT, JSON</p>

        {lastFileName && !isUploading && !error && (
          <p className="file-upload__filename">
            <FileText size={16} /> {lastFileName}
          </p>
        )}
      </div>

      {error && (
        <p className="file-upload__error">
          <AlertTriangle size={16} /> {error}
        </p>
      )}
    </div>
  );
}
