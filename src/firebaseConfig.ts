export type FirebaseEnvironmentName = 'development' | 'beta'

export interface FirebaseClientConfiguration {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export type FirebaseConfigurationRegistry = Record<
  FirebaseEnvironmentName,
  FirebaseClientConfiguration | null
>

export const firebaseProjectConfigurations = {
  development: {
    apiKey: "AIzaSyDlbphupyfLU7ul46LWnK-bjFq8sOotcPw",
    authDomain: "marathoner-d9bf9.firebaseapp.com",
    projectId: "marathoner-d9bf9",
    storageBucket: "marathoner-d9bf9.firebasestorage.app",
    messagingSenderId: "677998037771",
    appId: "1:677998037771:web:9269b3b5f82909ccc3b00e",
  },
  beta: null,
} satisfies FirebaseConfigurationRegistry
