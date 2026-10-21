import {
  EmailAuthProvider,
  getIdToken,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth } from "./firebaseClient";

export type AuthUser = Pick<User, "uid" | "email">;

export type AuthenticationErrorCode =
  | "invalid_email"
  | "weak_password"
  | "email_in_use"
  | "invalid_credentials"
  | "account_disabled"
  | "session_expired"
  | "too_many_requests"
  | "network_unavailable"
  | "unknown";

const authenticationErrorMessages: Record<AuthenticationErrorCode, string> = {
  invalid_email: "Enter a valid email address.",
  weak_password: "Choose a stronger password that meets the password requirements.",
  email_in_use: "An account already uses this email address. Try logging in instead.",
  invalid_credentials: "The email or password is incorrect.",
  account_disabled: "This account is disabled. Contact support if you need help.",
  session_expired: "Your session has ended. Log in again.",
  too_many_requests: "Too many attempts. Wait a moment before trying again.",
  network_unavailable:
    "We could not reach Marathoner. Check your connection and try again.",
  unknown: "We could not complete that request. Please try again.",
};

const firebaseCodeMap: Record<string, AuthenticationErrorCode> = {
  "auth/invalid-email": "invalid_email",
  "auth/weak-password": "weak_password",
  "auth/password-does-not-meet-requirements": "weak_password",
  "auth/email-already-in-use": "email_in_use",
  "auth/invalid-credential": "invalid_credentials",
  "auth/user-not-found": "invalid_credentials",
  "auth/wrong-password": "invalid_credentials",
  "auth/user-disabled": "account_disabled",
  "auth/invalid-user-token": "session_expired",
  "auth/user-token-expired": "session_expired",
  "auth/too-many-requests": "too_many_requests",
  "auth/network-request-failed": "network_unavailable",
};

export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;
  readonly firebaseCode?: string;
  readonly cause?: unknown;

  constructor(
    code: AuthenticationErrorCode,
    cause?: unknown,
    firebaseCode?: string,
  ) {
    super(authenticationErrorMessages[code]);
    this.name = "AuthenticationError";
    this.code = code;
    this.firebaseCode = firebaseCode;
    this.cause = cause;
  }
}

export const toAuthenticationError = (error: unknown): AuthenticationError => {
  if (error instanceof AuthenticationError) {
    return error;
  }

  if (error instanceof FirebaseError) {
    return new AuthenticationError(
      firebaseCodeMap[error.code] ?? "unknown",
      error,
      error.code,
    );
  }

  return new AuthenticationError("unknown", error);
};

export const requiresNewSignIn = (error: unknown): boolean =>
  error instanceof AuthenticationError &&
  (error.code === "account_disabled" || error.code === "session_expired");

const validateRestoredUser = async (user: User): Promise<AuthUser> => {
  try {
    await getIdToken(user);
    return { uid: user.uid, email: user.email };
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      error.code === "auth/user-not-found"
    ) {
      throw new AuthenticationError("session_expired", error, error.code);
    }

    throw toAuthenticationError(error);
  }
};

export const signIn = async (
  email: string,
  password: string,
): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );
    return userCredential.user;
  } catch (error) {
    throw toAuthenticationError(error);
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  } catch (error) {
    const authenticationError = toAuthenticationError(error);

    if (authenticationError.firebaseCode === "auth/user-not-found") {
      return;
    }

    throw authenticationError;
  }
};

export const logOut = async (): Promise<void> => {
  try {
    await signOut(getFirebaseAuth());
  } catch (error) {
    throw toAuthenticationError(error);
  }
};

export const reauthenticateWithPassword = async (
  password: string,
): Promise<void> => {
  const user = getFirebaseAuth().currentUser;

  if (!user?.email) {
    throw new AuthenticationError("unknown");
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    const userCredential = await reauthenticateWithCredential(user, credential);
    await getIdToken(userCredential.user, true);
  } catch (error) {
    throw toAuthenticationError(error);
  }
};

export const subscribeToAuthState = (
  onChange: (user: AuthUser | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  let active = true;
  let authEventGeneration = 0;
  const unsubscribe = onAuthStateChanged(
    getFirebaseAuth(),
    (user) => {
      const generation = authEventGeneration + 1;
      authEventGeneration = generation;

      if (user === null) {
        onChange(null);
        return;
      }

      void validateRestoredUser(user)
        .then((validatedUser) => {
          if (active && generation === authEventGeneration) {
            onChange(validatedUser);
          }
        })
        .catch((error: unknown) => {
          if (active && generation === authEventGeneration) {
            onError?.(toAuthenticationError(error));
          }
        });
    },
    (error) => {
      authEventGeneration += 1;
      if (active) onError?.(toAuthenticationError(error));
    },
  );

  return () => {
    active = false;
    authEventGeneration += 1;
    unsubscribe();
  };
};
