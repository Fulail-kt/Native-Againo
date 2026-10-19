import { Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { AuthLayout } from '../auth-ui';
import { useAuth, type User } from '../auth';
import { Form, FormField, FormSubmit, useAppForm } from '../form';
import { pop } from '../pop';
import { verifyEmailSchema, type VerifyEmailValues } from '../schemas';

export function VerifyEmailScreen() {
  const { token, user, setSession, logout } = useAuth();
  const form = useAppForm(verifyEmailSchema, { code: '' });

  async function submit(values: VerifyEmailValues) {
    try {
      const res = await api<{ accessToken: string; user: User }>('/auth/verify-email', {
        method: 'POST',
        token,
        body: values,
      });
      await setSession(res.accessToken, res.user);
    } catch (e) {
      pop.err(e);
    }
  }

  async function resend() {
    try {
      await api('/auth/resend-verify', { method: 'POST', token });
      pop.ok('Code sent');
    } catch (e) {
      pop.err(e);
    }
  }

  return (
    <AuthLayout title="Verify email">
      <Text className="mb-lg text-center text-[14px] text-muted">
        Code sent to <Text className="font-semibold text-ink">{user?.email ?? ''}</Text>
      </Text>
      <Form form={form}>
        <FormField
          control={form.control}
          name="code"
          label="6-digit code"
          look="otp"
          placeholder="000000"
          keyboardType="numeric"
          kind="digits"
          maxLength={6}
        />
        <FormSubmit
          label="Verify"
          onValid={submit}
          busy={form.formState.isSubmitting}
          requireDirty={false}
          inset
        />
      </Form>
      <View className="mt-md flex-row items-center justify-center gap-md">
        <Pressable onPress={resend} hitSlop={8}>
          <Text className="text-[14px] font-semibold text-primary">Resend code</Text>
        </Pressable>
        <Text className="text-muted">·</Text>
        <Pressable onPress={logout} hitSlop={8}>
          <Text className="text-[14px] font-semibold text-muted">Use a different email</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
