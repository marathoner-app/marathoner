import { useEffect, useState, type ReactNode } from "react";
import {
  logOut,
  requiresNewSignIn,
  subscribeToAuthState,
} from "../services/authService";
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
    let subscriptionIsCurrent = true;

    setSession({ status: "loading", user: null });

    const timeout = window.setTimeout(() => {
      if (!subscriptionIsCurrent) return;

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
        if (!subscriptionIsCurrent) return;

        window.clearTimeout(timeout);
        setSession((currentSession) => {
          if (user) return { status: "signedIn", user };

          return currentSession.status === "signedOut" && currentSession.notice
            ? currentSession
            : { status: "signedOut", user: null };
        });
      },
      (error) => {
        if (!subscriptionIsCurrent) return;

        window.clearTimeout(timeout);

        if (requiresNewSignIn(error)) {
          setSession({
            status: "signedOut",
            user: null,
            notice: error.message,
          });
          void logOut().catch(() => undefined);
          return;
        }

        setSession({
          status: "error",
          user: null,
          message:
            "We couldn't restore your session. Check your connection and try again.",
        });
      },
    );

    return () => {
      subscriptionIsCurrent = false;
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
