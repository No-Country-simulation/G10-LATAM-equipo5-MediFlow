import { ClipboardCheck, Stethoscope, type LucideIcon } from 'lucide-react';

interface DemoProfile {
  id: string;
  username: string;
  label: string;
  icon: LucideIcon;
  borderHover: string;
  textHover: string;
  iconBg: string;
  iconText: string;
  iconBorder: string;
}

const DEMO_PROFILES: DemoProfile[] = [
  {
    id: 'auditor',
    username: 'auditor_demo',
    label: 'Auditor',
    icon: ClipboardCheck,
    borderHover: 'hover:border-rose-500/40',
    textHover: 'group-hover:text-rose-400',
    iconBg: 'bg-rose-500/10',
    iconText: 'text-rose-400',
    iconBorder: 'border-rose-500/20',
  },
  {
    id: 'medico',
    username: 'medico_demo',
    label: 'Médico',
    icon: Stethoscope,
    borderHover: 'hover:border-sky-500/40',
    textHover: 'group-hover:text-sky-400',
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-400',
    iconBorder: 'border-sky-500/20',
  },
];

interface DemoAccountsProps {
  onSelectDemo: (username: string, password: string) => void;
  disabled?: boolean;
}

const DemoAccounts = ({ onSelectDemo, disabled = false }: DemoAccountsProps) => {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Acceso Rápido Demo
        </span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DEMO_PROFILES.map((profile) => {
          const Icon = profile.icon;
          return (
            <button
              key={profile.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDemo(profile.username, 'demo_password')}
              className={`flex items-center justify-center gap-2.5 p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 ${profile.borderHover} transition-all group disabled:opacity-50 cursor-pointer`}
            >
              <div
                className={`p-1.5 rounded-lg ${profile.iconBg} ${profile.iconText} border ${profile.iconBorder} group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`text-xs font-semibold text-slate-200 ${profile.textHover} transition-colors`}
              >
                {profile.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DemoAccounts;
