import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { selectedFirebaseEnvironment } from "../selectedFirebaseEnvironment";

export const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(selectedFirebaseEnvironment.config);

export const auth = getAuth(firebaseApp);
