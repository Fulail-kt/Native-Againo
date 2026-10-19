import { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '../icons';
import { colors, space } from '../theme';

function metrics() {
  const H = Dimensions.get('window').height;
  return {
    min: H * 0.38,
    mid: H * 0.58,
    max: H * 0.94,
    dismiss: H * 0.32,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  expand = 'auto',
  fill,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  expand?: 'auto' | 'full';
  fill?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const m = useRef(metrics()).current;
  const heightAnim = useRef(new Animated.Value(m.mid)).current;
  const dragStart = useRef(m.mid);
  const currentH = useRef(m.mid);
  const grew = useRef(false);

  useEffect(() => {
    if (!open) return;
    const next = metrics();
    Object.assign(m, next);
    grew.current = expand === 'full';
    const start = expand === 'full' ? next.max : next.mid;
    currentH.current = start;
    dragStart.current = start;
    heightAnim.setValue(start);
  }, [open, expand, heightAnim, m]);

  function close() {
    const next = metrics();
    currentH.current = next.mid;
    heightAnim.setValue(next.mid);
    grew.current = false;
    onClose();
  }

  function snapHeight(current: number, velocityY: number) {
    const { min, mid, max, dismiss } = m;
    if (current < dismiss || (current < mid * 0.85 && velocityY > 0.8)) {
      return 'dismiss' as const;
    }
    if (velocityY < -0.6 || current > (mid + max) / 2) return max;
    if (velocityY > 0.6 || current < (min + mid) / 2) return min;
    return mid;
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        dragStart.current = currentH.current;
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(dragStart.current - g.dy, m.min * 0.75, m.max);
        currentH.current = next;
        heightAnim.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const end = clamp(dragStart.current - g.dy, m.min * 0.75, m.max);
        const target = snapHeight(end, g.vy);
        if (target === 'dismiss') {
          close();
          return;
        }
        currentH.current = target;
        Animated.spring(heightAnim, {
          toValue: target,
          useNativeDriver: false,
          damping: 22,
          stiffness: 220,
        }).start();
      },
    }),
  ).current;

  function onBodySize(_w: number, h: number) {
    if (!open || expand === 'full' || grew.current) return;
    const chrome = 132 + insets.bottom;
    if (h + chrome > m.mid + 32) {
      grew.current = true;
      currentH.current = m.max;
      Animated.spring(heightAnim, {
        toValue: m.max,
        useNativeDriver: false,
        damping: 22,
        stiffness: 220,
      }).start();
    }
  }

  if (!open) return null;

  return (
    <View className="absolute inset-0 z-20 justify-end" style={{ elevation: 20 }} pointerEvents="box-none">
      <Pressable className="absolute inset-0 bg-black/55" onPress={close} />
      <Animated.View className="w-full" style={{ height: heightAnim }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 rounded-t-lg border border-b-0 border-border bg-surface"
          style={{ paddingBottom: insets.bottom + space.sm }}
        >
          <View className="items-center border-b border-border pb-xs pt-sm" {...pan.panHandlers}>
            <View className="w-full items-center py-md">
              <View className="h-[5px] w-12 rounded-pill bg-muted" />
            </View>
          </View>

          <View className="flex-row items-start border-b border-border px-lg pb-md pt-sm">
            <View className="flex-1">
              <Text className="text-[18px] font-bold text-ink">{title}</Text>
              {subtitle ? <Text className="mt-0.5 text-[13px] text-muted">{subtitle}</Text> : null}
            </View>
            <Pressable
              className="ml-md h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface2"
              onPress={close}
              hitSlop={8}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          {fill ? (
            <View className="flex-1">{children}</View>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerClassName="p-lg pb-xxl"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onContentSizeChange={onBodySize}
            >
              {children}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}
