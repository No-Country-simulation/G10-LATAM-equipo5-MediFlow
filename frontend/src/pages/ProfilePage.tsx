import { UserCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/common/PageHeader';
import { ProfileInfoCard } from '../components/profile/ProfileInfoCard';
import { ChangePasswordForm } from '../components/profile/ChangePasswordForm';

/** Panel personal del usuario conectado. Usa el perfil de la sesión, que se refresca con /auth/me al iniciar. */
const ProfilePage = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <PageHeader
        icon={UserCircle}
        title="Mi Perfil"
        subtitle="Tus datos de cuenta en MediFlow y el cambio de tu contraseña"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ProfileInfoCard user={user} />
        <ChangePasswordForm />
      </div>
    </div>
  );
};

export default ProfilePage;
