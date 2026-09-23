import type { ReactNode } from 'react';
import { AuthContext } from '../../../../src/auth/AuthContext';

type AuthProviderProps = {
  children: ReactNode;
};

const signedOutSpikeSession = {
  status: 'signedOut' as const,
  user: null,
  logout: async () => undefined,
};

export default function AuthProvider({ children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={signedOutSpikeSession}>
      {children}
    </AuthContext.Provider>
  );
}
