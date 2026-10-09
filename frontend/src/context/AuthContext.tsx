import type { ReactNode } from 'react';
import { useAuthSession } from '../hooks/useAuthSession';
import { AuthContext } from './authContextInstance';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const session = useAuthSession();

  return (
    <AuthContext.Provider value={session}>
      {children}
    </AuthContext.Provider>
  );
};
