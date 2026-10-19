import { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { ModalSafe } from '../../safe';
import { Btn, Header } from '../../ui';

type Ok = { type: 'ok'; code: string; wabaId?: string; phoneNumberId?: string };

function payloadFromUrl(url: string): Ok | { type: 'cancel' } | null {
  try {
    const u = new URL(url);
    if (!u.pathname.includes('/integrations/whatsapp/oauth-return')) return null;
    const code = u.searchParams.get('code');
    if (code) {
      return {
        type: 'ok',
        code,
        wabaId: u.searchParams.get('waba_id') || undefined,
        phoneNumberId: u.searchParams.get('phone_number_id') || undefined,
      };
    }
    if (u.searchParams.get('error')) return { type: 'cancel' };
  } catch {
    /* ignore */
  }
  return null;
}

export function WhatsAppSignup({
  ticket,
  oauthUrl,
  onDone,
  onCancel,
}: {
  ticket: string | null;
  oauthUrl?: string | null;
  onDone: (payload: Omit<Ok, 'type'>) => void;
  onCancel: () => void;
}) {
  const webRef = useRef<WebView>(null);
  const done = useRef(false);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    done.current = false;
    setUri(null);
  }, [ticket]);

  function handleNav(nav: WebViewNavigation) {
    if (done.current) return;
    const parsed = payloadFromUrl(nav.url);
    if (parsed?.type === 'ok') {
      done.current = true;
      onDone({ code: parsed.code, wabaId: parsed.wabaId, phoneNumberId: parsed.phoneNumberId });
    }
  }

  return (
    <Modal visible={!!ticket} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <ModalSafe>
        <Header
          title="Connect WhatsApp"
          right={<Btn label="Close" variant="ghost" onPress={onCancel} />}
        />
        {uri ? (
          <WebView
            ref={webRef}
            style={{ flex: 1 }}
            source={{ uri }}
            onNavigationStateChange={handleNav}
            onOpenWindow={(e) => {
              const url = e.nativeEvent.targetUrl;
              webRef.current?.injectJavaScript(
                `window.location.href = ${JSON.stringify(url)}; true;`,
              );
            }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        ) : (
          <View className="gap-md p-lg">
            <Text className="text-[15px] leading-[22px] text-muted">
              Connect this shop to your WhatsApp Business account. Meta opens next.
            </Text>
            <Btn
              label="Continue with Meta"
              onPress={() => oauthUrl && setUri(oauthUrl)}
              disabled={!oauthUrl}
            />
          </View>
        )}
      </ModalSafe>
    </Modal>
  );
}
