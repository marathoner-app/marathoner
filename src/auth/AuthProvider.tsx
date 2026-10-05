import { useEffect, useState, type ReactNode } from "react";
import { logOut, subscribeToAuthState } from "../services/authService";
import { AuthContext, type AuthSession } from "./AuthContext";

export const authSessionTimeoutMs = 10_000;

type AuthProviderProps = {
  children: ReactNode;
};

export default function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession>({
    status: "loading",
    user: null,
  });
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);

  useEffect(() => {
    setSession({ status: "loading", user: null });

    const timeout = window.setTimeout(() => {
      setSession((currentSession) =>
        currentSession.status === "loading"
          ? {
              status: "error",
              user: null,
              message:
                "We couldn't restore your session. Check your connection and try again.",
            }
          : currentSession,
      );
    }, authSessionTimeoutMs);

    const unsubscribe = subscribeToAuthState(
      (user) => {
        window.clearTimeout(timeout);
        setSession(
          user
            ? { status: "signedIn", user }
            : { status: "signedOut", user: null },
        );
      },
      () => {
        window.clearTimeout(timeout);
        setSession({
          status: "error",
          user: null,
          message:
            "We couldn't restore your session. Check your connection and try again.",
        });
      },
    );

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [subscriptionAttempt]);

  const retrySession = () => {
    setSubscriptionAttempt((attempt) => attempt + 1);
  };

  return (
    <AuthContext.Provider
      value={{ ...session, logout: logOut, retrySession }}
    >
      {children}
    </AuthContext.Provider>
  );
}
