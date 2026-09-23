import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { auth } from "./firebaseClient";

export type AuthUser = Pick<User, "uid" | "email">;

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
    throw new Error(
      error instanceof Error ? error.message : "An unexpected error occurred",
    );
  }
};

export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "An unexpected error occurred",
    );
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
