import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import DocumentDetailProvider from '../documents/DocumentDetailProvider';

const AppLayout = () => {
  return (
    <DocumentDetailProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative pb-12">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </DocumentDetailProvider>
  );
};

export default AppLayout;
