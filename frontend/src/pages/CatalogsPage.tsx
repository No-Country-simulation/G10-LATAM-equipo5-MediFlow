import { useSearchParams } from 'react-router-dom';
import { Database } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/common/PageHeader';
import { CatalogManager } from '../components/catalogs/CatalogManager';
import { catalogsForRole } from '../components/catalogs/catalogConfig';

const TAB_PARAM = 'tab';

const CatalogsPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogs = catalogsForRole(user?.role);
  const active = catalogs.find((c) => c.key === searchParams.get(TAB_PARAM)) ?? catalogs[0];

  if (!active) return null;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={Database}
        title="Catálogos"
        badge="Tablas Maestras"
        subtitle="Tipos de documento, áreas y colas que usan la IA, el triaje y el registro de usuarios"
      />

      <div role="tablist" aria-label="Catálogos" className="flex flex-wrap items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 w-fit">
        {catalogs.map((catalog) => {
          const Icon = catalog.icon;
          const isActive = catalog.key === active.key;
          return (
            <button
              key={catalog.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSearchParams({ [TAB_PARAM]: catalog.key }, { replace: true })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{catalog.label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {/* `key`: cada catálogo arranca con su propio estado (filtros, formulario, avisos). */}
        <CatalogManager key={active.key} definition={active} />
      </div>
    </div>
  );
};

export default CatalogsPage;
