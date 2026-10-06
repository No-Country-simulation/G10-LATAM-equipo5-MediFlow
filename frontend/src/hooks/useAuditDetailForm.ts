import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { documentService } from '../services/documentService';
import type { AuditDetailResponse, NivelPrioridad } from '../types/medical';

export const useAuditDetailForm = (documentId: string, onClose: () => void) => {
  const [detail, setDetail] = useState<AuditDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    rut_paciente: '',
    nombre_paciente: '',
    edad_paciente: '' as string | number,
    medico_nombre: '',
    medico_rut: '',
    tipo_documento: '',
    nivel_prioridad: 'Rutina' as NivelPrioridad,
    diagnostico_principal: '',
    cie10_sugerido: '',
    destino_enrutamiento: '',
    especialidad: '',
    audit_notes: '',
    motivo_descarte: '',
  });

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await documentService.getAuditDetail(documentId);
        setDetail(data);
        setFormData({
          rut_paciente: data.rut_paciente || '',
          nombre_paciente: data.nombre_paciente || '',
          edad_paciente: data.edad_paciente || '',
          medico_nombre: data.medico_nombre || '',
          medico_rut: data.medico_rut || '',
          tipo_documento: data.tipo_documento,
          nivel_prioridad: data.nivel_prioridad,
          diagnostico_principal: data.diagnostico_principal || '',
          cie10_sugerido: data.cie10_sugerido || '',
          destino_enrutamiento: data.destino_enrutamiento || '',
          especialidad: data.especialidad || '',
          audit_notes: '',
          motivo_descarte: '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el detalle');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [documentId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResolve = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.audit_notes.trim()) {
      setError('Las notas de auditoría son obligatorias.');
      return;
    }
    setSubmitting(true);
    try {
      await documentService.resolveAudit(documentId, {
        rut_paciente: formData.rut_paciente,
        nombre_paciente: formData.nombre_paciente,
        edad_paciente: formData.edad_paciente ? Number(formData.edad_paciente) : null,
        medico_nombre: formData.medico_nombre,
        medico_rut: formData.medico_rut,
        tipo_documento: formData.tipo_documento,
        nivel_prioridad: formData.nivel_prioridad,
        diagnostico_principal: formData.diagnostico_principal,
        cie10_sugerido: formData.cie10_sugerido,
        destino_enrutamiento: formData.destino_enrutamiento,
        especialidad: formData.especialidad,
        audit_notes: formData.audit_notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al resolver el caso');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!formData.motivo_descarte.trim()) {
      setError('El motivo de descarte es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      await documentService.discardAudit(documentId, { motivo: formData.motivo_descarte });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descartar el caso');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await documentService.releaseAuditCase(documentId);
    } catch (err) {
      console.error('Error liberando el caso', err);
    }
    onClose();
  };

  return { detail, loading, error, submitting, formData, handleChange, handleResolve, handleDiscard, handleCancel };
};
