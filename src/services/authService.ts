import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "./firebaseClient";

export type AuthUser = Pick<User, "uid" | "email">;

export type AuthenticationErrorCode =
  | "invalid_email"
  | "weak_password"
  | "email_in_use"
  | "invalid_credentials"
  | "account_disabled"
  | "too_many_requests"
  | "network_unavailable"
  | "unknown";

const authenticationErrorMessages: Record<AuthenticationErrorCode, string> = {
  invalid_email: "Enter a valid email address.",
  weak_password: "Choose a stronger password that meets the password requirements.",
  email_in_use: "An account already uses this email address. Try logging in instead.",
  invalid_credentials: "The email or password is incorrect.",
  account_disabled: "This account is disabled. Contact support if you need help.",
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

export const signIn = async (
  email: string,
  password: string,
): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return userCredential.user;
  } catch (error) {
    throw toAuthenticationError(error);
  }
};

export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw toAuthenticationError(error);
  }
};

export const subscribeToAuthState = (
  onChange: (user: AuthUser | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe =>
  onAuthStateChanged(
    auth,
    (user) => {
      onChange(user ? { uid: user.uid, email: user.email } : null);
    },
    onError,
  );
