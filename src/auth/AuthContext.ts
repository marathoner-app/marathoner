import { createContext } from "react";
import type { AuthUser } from "../services/authService";

export type AuthSession =
  | { status: "loading"; user: null }
  | { status: "error"; user: null; message: string }
  | { status: "signedOut"; user: null }
  | { status: "signedIn"; user: AuthUser };

export type AuthContextValue = AuthSession & {
  logout: () => Promise<void>;
  retrySession: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
