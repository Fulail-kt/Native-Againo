import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../api';
import { AuthLayout } from '../auth-ui';
import { useAuth, type User } from '../auth';
import { Form, FormField, FormSubmit, useAppForm } from '../form';
import { pop } from '../pop';
import {
  loginSchema,
  ownerRegisterSchema,
  type LoginValues,
  type OwnerRegisterValues,
} from '../schemas';
import { Btn, Segmented } from '../ui';

WebBrowser.maybeCompleteAuthSession();

const googleWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleAndroid = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleAndroidGuid = (googleAndroid ?? '').replace(/\.apps\.googleusercontent\.com$/i, '');
const googleRedirect = makeRedirectUri({
  scheme: 'againo',
  path: 'oauthredirect',
  native: googleAndroidGuid
    ? `com.googleusercontent.apps.${googleAndroidGuid}:/oauthredirect`
    : undefined,
});

type Mode = 'login' | 'signup';

function GoogleBtn({ onToken }: { onToken: (idToken: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleWeb || 'missing.apps.googleusercontent.com',
    webClientId: googleWeb || undefined,
    androidClientId: googleAndroid || undefined,
    iosClientId: googleIos || undefined,
    redirectUri: googleRedirect,
    selectAccount: true,
  });

  useEffect(() => {
    if (!response || response.type === 'dismiss' || response.type === 'cancel') return;
    if (response.type !== 'success') {
      pop.err('Google sign-in didn’t finish. Try again.');
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) {
      pop.err('Google sign-in didn’t finish. Try again.');
      return;
    }
    setBusy(true);
    onToken(idToken).finally(() => setBusy(false));
  }, [response]);

  if (!googleWeb) return null;

  return (
    <>
      <View className="my-md flex-row items-center gap-md">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-[12px] text-muted">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
      <Btn
        label="Continue with Google"
        variant="secondary"
        disabled={!request}
        busy={busy}
        inset
        onPress={() => promptAsync().catch((e) => pop.err(e))}
      />
    </>
  );
}

function AuthFormBody({
  mode,
  setSession,
}: {
  mode: Mode;
  setSession: (token: string, user: User) => Promise<void>;
}) {
  const schema = mode === 'login' ? loginSchema : ownerRegisterSchema;
  const form = useAppForm(
    schema as typeof loginSchema,
    mode === 'login' ? { email: '', password: '' } : { email: '', password: '', name: '' },
  );

  async function submit(values: LoginValues | OwnerRegisterValues) {
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await api<{ accessToken: string; user: User }>(path, {
        method: 'POST',
        body: values,
      });
      await setSession(res.accessToken, res.user);
    } catch (e) {
      pop.err(e);
    }
  }

  const googleToken = useCallback(
    async (idToken: string) => {
      try {
        const res = await api<{ accessToken: string; user: User }>('/auth/google', {
          method: 'POST',
          body: { idToken },
        });
        await setSession(res.accessToken, res.user);
      } catch (e) {
        pop.err(e);
      }
    },
    [setSession],
  );

  return (
    <Form form={form}>
      {mode === 'signup' ? (
        <FormField
          control={form.control}
          name="name"
          label="Full name"
          placeholder="Jane Owner"
          autoComplete="name"
          maxLength={80}
        />
      ) : null}
      <FormField
        control={form.control}
        name="email"
        label={mode === 'login' ? 'Email or phone' : 'Email'}
        placeholder={mode === 'login' ? 'you@email.com or 9876543210' : 'you@email.com'}
        keyboardType={mode === 'login' ? 'default' : 'email-address'}
        autoComplete="email"
        maxLength={120}
      />
      <FormField
        control={form.control}
        name="password"
        label="Password"
        placeholder="At least 6 characters"
        secure
        autoComplete={mode === 'login' ? 'password' : 'new-password'}
        maxLength={72}
      />
      <FormSubmit
        label={mode === 'login' ? 'Sign in' : 'Create account'}
        onValid={submit}
        busy={form.formState.isSubmitting}
        inset
      />
      <GoogleBtn onToken={googleToken} />
    </Form>
  );
}

export function AuthScreen() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  return (
    <AuthLayout title={mode === 'login' ? 'Sign in' : 'Create account'}>
      <Segmented
        options={[
          { key: 'login', label: 'Sign in' },
          { key: 'signup', label: 'Sign up' },
        ]}
        value={mode}
        onChange={(k) => setMode(k as Mode)}
      />
      <AuthFormBody key={mode} mode={mode} setSession={setSession} />
    </AuthLayout>
  );
}
