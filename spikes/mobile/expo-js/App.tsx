import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import type { SharedRecordProof } from '@marathoner/training-contract';
import { resolveFirebaseConfiguration } from './src/firebaseBoundary.mjs';
import { createMobileAuth } from './src/firebaseClient';
import {
  createExpoSharedRecordClient,
  type ExpoSharedRecordClient,
} from './src/sharedRecordClient';

type AuthSetup =
  | { status: 'ready'; auth: Auth }
  | { status: 'blocked'; message: string };

type Session =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: User };

type RecordState =
  | { status: 'loading'; record: null }
  | { status: 'missing'; record: null }
  | { status: 'ready'; record: SharedRecordProof }
  | { status: 'error'; record: null };

const authSetup = prepareAuth();

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {authSetup.status === 'ready' ? (
          <AuthProof auth={authSetup.auth} />
        ) : (
          <ConfigurationBlocked message={authSetup.message} />
        )}
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AuthProof({ auth }: { auth: Auth }) {
  const sharedRecordClient = useMemo(
    () => createExpoSharedRecordClient(auth.app),
    [auth],
  );
  const [session, setSession] = useState<Session>({
    status: 'loading',
    user: null,
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(
        auth,
        (user) => {
          setSession(
            user
              ? { status: 'signedIn', user }
              : { status: 'signedOut', user: null },
          );
          setError(null);
        },
        () => {
          setSession({ status: 'signedOut', user: null });
          setError('Unable to restore the authentication session.');
        },
      ),
    [auth],
  );

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter the existing test account email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch {
      setError('Sign-in failed. Check the test account and network, then retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await signOut(auth);
    } catch {
      setError('Logout failed. Check the network, then retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Authentication state</Text>

        {session.status === 'loading' && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#7ed6c2" />
            <Text style={styles.copy}>Loading your session...</Text>
          </View>
        )}

        {session.status === 'signedOut' && (
          <View style={styles.form}>
            <Text style={styles.copy}>
              Signed out. Use an existing development account.
            </Text>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#71869a"
              style={styles.input}
              value={email}
            />
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={() => void handleSignIn()}
              placeholder="Password"
              placeholderTextColor="#71869a"
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <ActionButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Signing in...' : 'Log in'}
              onPress={() => void handleSignIn()}
            />
          </View>
        )}

        {session.status === 'signedIn' && (
          <View style={styles.form}>
            <Text style={styles.success}>Signed in</Text>
            <Text style={styles.copy}>
              {session.user.email ?? 'Marathoner test account'}
            </Text>
            <SharedRecordControls
              client={sharedRecordClient}
              userId={session.user.uid}
            />
            <ActionButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Logging out...' : 'Log out'}
              onPress={() => void handleLogout()}
            />
          </View>
        )}

        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
      <Text style={styles.footer}>
        Development proof only. No production training or beta data.
      </Text>
    </View>
  );
}

function SharedRecordControls({
  client,
  userId,
}: {
  client: ExpoSharedRecordClient;
  userId: string;
}) {
  const [recordState, setRecordState] = useState<RecordState>({
    status: 'loading',
    record: null,
  });
  const [isChanging, setIsChanging] = useState(false);

  const refresh = useCallback(async () => {
    setRecordState({ status: 'loading', record: null });

    try {
      const record = await client.read(userId);
      setRecordState(
        record
          ? { status: 'ready', record }
          : { status: 'missing', record: null },
      );
    } catch {
      setRecordState({ status: 'error', record: null });
    }
  }, [client, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const write = async () => {
    setIsChanging(true);

    try {
      const record = await client.write(userId);
      setRecordState({ status: 'ready', record });
    } catch {
      setRecordState({ status: 'error', record: null });
    } finally {
      setIsChanging(false);
    }
  };

  const remove = async () => {
    setIsChanging(true);

    try {
      await client.delete(userId);
      setRecordState({ status: 'missing', record: null });
    } catch {
      setRecordState({ status: 'error', record: null });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>Isolated sample record</Text>

      {recordState.status === 'loading' && (
        <Text style={styles.copy}>Reading the shared record...</Text>
      )}
      {recordState.status === 'missing' && (
        <Text style={styles.copy}>No sample record exists.</Text>
      )}
      {recordState.status === 'error' && (
        <Text accessibilityRole="alert" style={styles.error}>
          The sample record request failed. Check the network and retry.
        </Text>
      )}
      {recordState.status === 'ready' && (
        <View style={styles.recordDetails}>
          <Text style={styles.copy}>
            Last writer: {recordState.record.sourceClient}
          </Text>
          <Text style={styles.copy}>
            Sample run: {recordState.record.sampleRunId}
          </Text>
          <Text style={styles.copy}>
            Distance: {recordState.record.distanceMeters} meters
          </Text>
        </View>
      )}

      <View style={styles.recordActions}>
        <ActionButton
          disabled={isChanging}
          label="Write as expo"
          onPress={() => void write()}
        />
        <ActionButton
          disabled={isChanging}
          label="Refresh"
          onPress={() => void refresh()}
        />
        <ActionButton
          disabled={isChanging}
          label="Delete sample"
          onPress={() => void remove()}
        />
      </View>
    </View>
  );
}

function ConfigurationBlocked({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.blockedCard}>
        <Text style={styles.cardTitle}>Authentication disabled</Text>
        <Text style={styles.copy}>{message}</Text>
        <Text style={styles.blockedCopy}>
          Add the local development configuration before running this proof.
        </Text>
      </View>
      <Text style={styles.footer}>No Firebase connection was attempted.</Text>
    </View>
  );
}

function Header() {
  return (
    <View>
      <Text style={styles.eyebrow}>ISSUE #87 · SHARED RECORD PROOF</Text>
      <Text style={styles.title}>Marathoner</Text>
      <Text style={styles.subtitle}>Expo + Firebase JS candidate</Text>
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function prepareAuth(): AuthSetup {
  try {
    const config = resolveFirebaseConfiguration({
      EXPO_PUBLIC_FIREBASE_API_KEY:
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      EXPO_PUBLIC_FIREBASE_PROJECT_ID:
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      EXPO_PUBLIC_FIREBASE_APP_ID:
        process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    });

    return { status: 'ready', auth: createMobileAuth(config) };
  } catch (error) {
    return {
      status: 'blocked',
      message:
        error instanceof Error
          ? error.message
          : 'Firebase authentication configuration is invalid.',
    };
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d1b2a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
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
  card: {
    backgroundColor: '#16324f',
    borderColor: '#7ed6c2',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 40,
    padding: 20,
  },
  blockedCard: {
    backgroundColor: '#3a2630',
    borderColor: '#f7c873',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 40,
    padding: 20,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  copy: {
    color: '#d8e4ee',
    fontSize: 16,
    lineHeight: 24,
  },
  blockedCopy: {
    color: '#f7c873',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  form: {
    gap: 12,
  },
  recordCard: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0d253a',
  },
  recordTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  recordDetails: {
    gap: 4,
  },
  recordActions: {
    gap: 8,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderColor: '#8aa3b8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    color: '#0d1b2a',
    fontSize: 16,
  },
  button: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#7ed6c2',
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    color: '#0d1b2a',
    fontSize: 16,
    fontWeight: '700',
  },
  success: {
    color: '#7ed6c2',
    fontSize: 18,
    fontWeight: '700',
  },
  error: {
    color: '#ffd2d2',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
  },
  footer: {
    color: '#8399ad',
    fontSize: 13,
    marginTop: 'auto',
  },
});
