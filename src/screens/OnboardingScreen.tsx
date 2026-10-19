import { useState } from 'react';
import { api } from '../api';
import { useAuth, type User } from '../auth';
import { Form, FormField, FormSubmit, useAppForm } from '../form';
import { INDUSTRY } from '../industry';
import { pop } from '../pop';
import { onboardingSchema, type OnboardingValues } from '../schemas';
import { AppShell, Btn, Header, ScrollBody, Section, Segmented } from '../ui';

export function OnboardingScreen() {
  const { token, setSession, logout } = useAuth();
  const [kind, setKind] = useState<'GYM' | 'BARBER'>('GYM');
  const form = useAppForm(onboardingSchema, { companyName: '', kind: 'GYM' });

  async function submit(values: OnboardingValues) {
    try {
      const res = await api<{ accessToken: string; user: User }>('/auth/onboarding', {
        method: 'POST',
        token,
        body: { ...values, kind },
      });
      await setSession(res.accessToken, res.user);
    } catch (e) {
      pop.err(e);
    }
  }

  return (
    <AppShell>
      <Header title="Company" brand />
      <ScrollBody>
        <Form form={form}>
          <Section title="What do you run?">
            <Segmented
              options={[
                { key: 'GYM', label: INDUSTRY.GYM.label },
                { key: 'BARBER', label: INDUSTRY.BARBER.label },
              ]}
              value={kind}
              onChange={(k) => {
                const next = k as 'GYM' | 'BARBER';
                setKind(next);
                form.setValue('kind', next);
              }}
            />
            <FormField
              control={form.control}
              name="companyName"
              label="Company name"
              placeholder={INDUSTRY[kind].placeholder}
              maxLength={80}
            />
          </Section>
          <FormSubmit
            label="Continue"
            onValid={submit}
            busy={form.formState.isSubmitting}
          />
        </Form>
        <Btn label="Use a different email" variant="ghost" onPress={logout} />
      </ScrollBody>
    </AppShell>
  );
}
