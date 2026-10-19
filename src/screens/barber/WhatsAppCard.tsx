import { MessageCircle } from '../../icons';
import { Form, FormField, FormSubmit, useAppForm } from '../../form';
import { waTestSchema } from '../../schemas';
import { Btn, Card } from '../../ui';

export function WhatsAppCard({
  wa,
  busy,
  onConnect,
  onDisconnect,
  onTest,
}: {
  wa: any;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: (phone: string) => void | Promise<void>;
}) {
  const form = useAppForm(waTestSchema, { phone: '' });

  if (!wa) {
    return <Card title="WhatsApp" body="Loading…" />;
  }
  if (!wa.configured) {
    return (
      <Card
        title="WhatsApp Business"
        body={wa.setupHint || 'Server missing Meta keys. See Nest/WHATSAPP.md.'}
      />
    );
  }
  if (wa.status === 'CONNECTED') {
    return (
      <>
        <Card
          title="WhatsApp Business"
          badge="Connected"
          body={[wa.verifiedName, wa.displayPhoneNumber].filter(Boolean).join(' · ') || 'Ready to send'}
        />
        <Form form={form}>
          <FormField
            control={form.control}
            name="phone"
            label="Test phone"
            placeholder="9876543210"
            kind="digits"
            maxLength={15}
          />
          <FormSubmit
            label="Send test message"
            icon={MessageCircle}
            busy={busy}
            onValid={(v) => onTest(v.phone)}
          />
        </Form>
        <Btn label="Disconnect" variant="ghost" onPress={onDisconnect} />
      </>
    );
  }
  if (wa.status === 'ERROR' || wa.status === 'EXPIRED') {
    return (
      <>
        <Card
          title="WhatsApp Business"
          badge="Needs attention"
          body={wa.lastError || 'Reconnect WhatsApp.'}
        />
        <Btn label="Reconnect WhatsApp" icon={MessageCircle} onPress={onConnect} busy={busy} />
      </>
    );
  }
  return (
    <>
      <Card
        title="WhatsApp Business"
        body="Connect your WhatsApp Business account to send booking confirmations."
      />
      <Btn label="Connect WhatsApp" icon={MessageCircle} onPress={onConnect} busy={busy} />
    </>
  );
}
