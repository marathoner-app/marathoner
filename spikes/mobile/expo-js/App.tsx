import { SDK_VERSION } from 'firebase/app';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { inspectFirebaseEnvironment } from './src/firebaseBoundary.mjs';

const firebaseStatus = inspectFirebaseEnvironment({
  EXPO_PUBLIC_FIREBASE_API_KEY:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>DISPOSABLE ARCHITECTURE SPIKE</Text>
        <Text style={styles.title}>Marathoner</Text>
        <Text style={styles.subtitle}>Expo + Firebase JS candidate</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Remote writes are disabled</Text>
          <Text style={styles.statusCopy}>
            This candidate proves dependency and bundle compatibility only. It
            does not initialize Firebase Authentication, Firestore, or any
            beta service.
          </Text>
        </View>

        <View style={styles.details}>
          <Text style={styles.detail}>Firebase JS SDK: {SDK_VERSION}</Text>
          <Text style={styles.detail}>
            Development configuration: {firebaseStatus.label}
          </Text>
          {firebaseStatus.missingKeys.length > 0 && (
            <Text style={styles.missing}>
              Fail-closed boundary: {firebaseStatus.missingKeys.length}{' '}
              required values absent
            </Text>
          )}
        </View>

        <Text style={styles.footer}>
          No training guidance. No production data. Issue #152.
        </Text>
        <StatusBar style="light" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d1b2a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 40,
    backgroundColor: '#0d1b2a',
  },
  eyebrow: {
    color: '#7ed6c2',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
  },
  subtitle: {
    color: '#c5d5e4',
    fontSize: 20,
    marginTop: 6,
  },
  statusCard: {
    backgroundColor: '#16324f',
    borderColor: '#7ed6c2',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 40,
    padding: 20,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  statusCopy: {
    color: '#d8e4ee',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  details: {
    gap: 8,
    marginTop: 28,
  },
  detail: {
    color: '#c5d5e4',
    fontSize: 15,
  },
  missing: {
    color: '#f7c873',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    color: '#8399ad',
    fontSize: 13,
    marginTop: 'auto',
  },
});
