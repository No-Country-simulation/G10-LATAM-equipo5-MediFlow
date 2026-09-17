"""Extraccion de texto crudo desde archivos subidos (PDF u otros formatos)."""

from __future__ import annotations

import io
import logging

from pypdf import PdfReader

logger = logging.getLogger(__name__)


def _is_pdf(filename: str, file_bytes: bytes) -> bool:
    """Determina si el archivo es un PDF por extension o por firma binaria."""
    if filename.lower().endswith(".pdf"):
        return True
    return file_bytes.startswith(b"%PDF-")


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extrae el texto de todas las paginas de un PDF."""
    reader = PdfReader(io.BytesIO(file_bytes))
    paginas_texto = []
    for pagina in reader.pages:
        texto_pagina = pagina.extract_text() or ""
        paginas_texto.append(texto_pagina)
    return "\n".join(paginas_texto).strip()


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extrae texto de un archivo clinico.

    Si el archivo es un PDF, utiliza `pypdf` para extraer el texto de cada pagina.
    En caso contrario, se asume contenido de texto plano y se decodifica directamente.
    """
    if not file_bytes:
        return ""

    if _is_pdf(filename, file_bytes):
        try:
            return _extract_text_from_pdf(file_bytes)
        except Exception:
            logger.exception("Fallo al extraer texto del PDF '%s'", filename)
            return ""

    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace")
