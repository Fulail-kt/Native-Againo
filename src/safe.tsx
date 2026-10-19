import { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';

/** iOS notch / Android 3-button / Safari home bar. Web needs viewport-fit=cover first. */
export function fitWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  const content =
    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
  if (meta) meta.setAttribute('content', content);
  else {
    const el = document.createElement('meta');
    el.name = 'viewport';
    el.content = content;
    document.head.appendChild(el);
  }
}

export function useFrameInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: Math.max(insets.top, 0),
    bottom: Math.max(insets.bottom, 0),
    left: Math.max(insets.left, 0),
    right: Math.max(insets.right, 0),
  };
}

/** RN Modal renders outside the tree on Android — own provider or insets are 0. */
export function ModalSafe({ children, bg = colors.bg }: { children: ReactNode; bg?: string }) {
  return (
    <SafeAreaProvider>
      <ModalSafeInner bg={bg}>{children}</ModalSafeInner>
    </SafeAreaProvider>
  );
}

function ModalSafeInner({ children, bg }: { children: ReactNode; bg: string }) {
  const { top, bottom, left, right } = useFrameInsets();
  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: bg,
        paddingTop: top,
        paddingBottom: bottom,
        paddingLeft: left,
        paddingRight: right,
      }}
    >
      {children}
    </View>
  );
}
