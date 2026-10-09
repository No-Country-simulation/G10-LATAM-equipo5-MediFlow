import type { ReactNode } from 'react';
import {
  Activity,
  Pill,
  Microscope,
  Syringe,
  ArrowLeftRight,
  FileText,
  FolderArchive,
} from 'lucide-react';

export interface ColumnConfig {
  id: string;
  title: string;
  icon: ReactNode;
  borderClass: string;
  badgeClass: string;
  code: string;
}

export const QUEUE_VISUALS: Record<string, { icon: ReactNode; borderClass: string; badgeClass: string }> = {
  Cola_Emergencia_Medica: {
    icon: <Activity className="w-4 h-4 text-rose-400" />,
    borderClass: 'border-rose-500/30 bg-rose-950/10',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  Farmacia_Hospitalaria: {
    icon: <Pill className="w-4 h-4 text-emerald-400" />,
    borderClass: 'border-emerald-500/30 bg-emerald-950/10',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  Cola_Oncologia: {
    icon: <Microscope className="w-4 h-4 text-pink-400" />,
    borderClass: 'border-pink-500/30 bg-pink-950/10',
    badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  },
  Gestion_Procedimientos: {
    icon: <Syringe className="w-4 h-4 text-amber-400" />,
    borderClass: 'border-amber-500/30 bg-amber-950/10',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  Gestion_Interconsultas: {
    icon: <ArrowLeftRight className="w-4 h-4 text-sky-400" />,
    borderClass: 'border-sky-500/30 bg-sky-950/10',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  },
  Ficha_Clinica: {
    icon: <FileText className="w-4 h-4 text-purple-400" />,
    borderClass: 'border-purple-500/30 bg-purple-950/10',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
};

export const DEFAULT_QUEUE_VISUAL = {
  icon: <FileText className="w-4 h-4 text-slate-400" />,
  borderClass: 'border-slate-700/30 bg-slate-900/10',
  badgeClass: 'bg-slate-700/20 text-slate-300 border-slate-700/30',
};

export const OTHER_COLUMN: ColumnConfig = {
  id: 'otros',
  title: 'Otras Derivaciones',
  icon: <FolderArchive className="w-4 h-4 text-slate-400" />,
  borderClass: 'border-slate-600/30 bg-slate-800/10',
  badgeClass: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
  code: 'OTRO',
};
