import { ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { explain } from './err';
import { CircleAlert, CircleCheck, Info } from './icons';
import { ModalSafe } from './safe';
import { colors, space } from './theme';

type AskOpts = {
  confirm?: string;
  cancel?: string;
  danger?: boolean;
};

type ToastItem = { kind: 'ok'; title: string; body?: string };
type DialogItem = {
  kind: 'err' | 'info' | 'ask';
  title: string;
  body?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type Listener = (toast: ToastItem | null, dialog: DialogItem | null) => void;

let listener: Listener | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toast: ToastItem | null = null;
let dialog: DialogItem | null = null;
const queue: DialogItem[] = [];

function bodyOf(v?: unknown) {
  if (v == null || v === '') return undefined;
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  return String(v);
}

function emit() {
  listener?.(toast, dialog);
}

function pushDialog(item: Omit<DialogItem, 'resolve'>) {
  return new Promise<boolean>((resolve) => {
    queue.push({ ...item, resolve });
    pump();
  });
}

function pump() {
  if (dialog) return;
  const next = queue.shift();
  if (!next) {
    emit();
    return;
  }
  dialog = next;
  emit();
}

function closeDialog(ok: boolean) {
  const cur = dialog;
  dialog = null;
  cur?.resolve(ok);
  pump();
}

function showToast(title: string, body?: string) {
  if (toastTimer) clearTimeout(toastTimer);
  toast = { kind: 'ok', title, body };
  emit();
  toastTimer = setTimeout(() => {
    toast = null;
    toastTimer = null;
    emit();
  }, 2400);
}

export const pop = {
  ok(title: string, body?: unknown) {
    showToast(title, bodyOf(body));
  },
  err(title: unknown, body?: unknown) {
    const msg = explain(body !== undefined ? body : title);
    return pushDialog({ kind: 'err', title: msg, confirm: 'OK' });
  },
  info(title: string, body?: unknown) {
    return pushDialog({
      kind: 'info',
      title,
      body: bodyOf(body),
      confirm: 'OK',
    });
  },
  ask(title: string, body?: unknown, opts?: AskOpts) {
    return pushDialog({
      kind: 'ask',
      title,
      body: bodyOf(body),
      confirm: opts?.confirm ?? 'Confirm',
      cancel: opts?.cancel ?? 'Cancel',
      danger: opts?.danger,
    });
  },
};

export function PopupHost({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [t, setT] = useState<ToastItem | null>(null);
  const [d, setD] = useState<DialogItem | null>(null);

  useEffect(() => {
    listener = (nextToast, nextDialog) => {
      setT(nextToast);
      setD(nextDialog);
    };
    emit();
    return () => {
      listener = null;
    };
  }, []);

  const Icon = d?.kind === 'err' ? CircleAlert : d?.kind === 'ask' ? CircleAlert : Info;
  const iconColor =
    d?.kind === 'err' || d?.danger ? colors.danger : d?.kind === 'ask' ? colors.warning : colors.primary;

  return (
    <View className="flex-1">
      {children}

      {t ? (
        <View
          pointerEvents="none"
          className="absolute inset-0 z-[80] px-md"
          style={{ paddingTop: insets.top + space.sm, elevation: 80 }}
        >
          <View className="flex-row items-start gap-sm rounded-md border border-success bg-surface p-md">
            <CircleCheck size={18} color={colors.success} />
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-bold text-ink">{t.title}</Text>
              {t.body ? <Text className="mt-0.5 text-[13px] leading-[18px] text-muted">{t.body}</Text> : null}
            </View>
          </View>
        </View>
      ) : null}

      <Modal
        visible={!!d}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (d && d.kind !== 'ask') closeDialog(true);
        }}
      >
        {d ? (
          <ModalSafe bg="transparent">
          <View className="flex-1 items-center justify-center p-lg">
            <Pressable
              className="absolute inset-0 bg-black/60"
              onPress={() => {
                if (d.kind !== 'ask') closeDialog(true);
              }}
            />
            <View className="w-full max-w-[360px] rounded-lg border border-border bg-surface p-lg">
              <View className="mb-md h-10 w-10 items-center justify-center rounded-md" style={{ backgroundColor: `${iconColor}22` }}>
                <Icon size={22} color={iconColor} />
              </View>
              <Text className="text-[17px] font-bold text-ink">{d.title}</Text>
              {d.body ? <Text className="mt-sm text-[14px] leading-5 text-muted">{d.body}</Text> : null}
              <View className="mt-lg flex-row justify-end gap-sm">
                {d.kind === 'ask' ? (
                  <Pressable
                    className="h-[42px] items-center justify-center rounded-md border border-border bg-surface2 px-lg"
                    onPress={() => closeDialog(false)}
                  >
                    <Text className="text-[14px] font-semibold text-ink">{d.cancel}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  className={`h-[42px] items-center justify-center rounded-md px-lg ${d.danger ? 'bg-danger' : 'bg-primary'}`}
                  onPress={() => closeDialog(true)}
                >
                  <Text className="text-[14px] font-bold text-white">{d.confirm}</Text>
                </Pressable>
              </View>
            </View>
          </View>
          </ModalSafe>
        ) : (
          <View />
        )}
      </Modal>
    </View>
  );
}
