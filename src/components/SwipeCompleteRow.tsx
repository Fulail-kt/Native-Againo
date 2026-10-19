import { ReactNode, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, View } from 'react-native';

const MAX = 112;
const FIRE = 64;
const AXIS = 6;

function clampComplete(dx: number) {
  if (dx >= 0) return 0;
  if (dx >= -MAX) return dx;
  return -MAX + (dx + MAX) * 0.18;
}

function clampReopen(dx: number) {
  if (dx <= 0) return 0;
  if (dx <= MAX) return dx;
  return MAX + (dx - MAX) * 0.18;
}

export function SwipeCompleteRow({
  canComplete,
  canReopen,
  onComplete,
  onReopen,
  onPress,
  children,
}: {
  canComplete?: boolean;
  canReopen?: boolean;
  onComplete?: () => void;
  onReopen?: () => void;
  onPress?: () => void;
  children: ReactNode;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const pos = useRef(0);
  const dragging = useRef(false);
  const completeRef = useRef(onComplete);
  const reopenRef = useRef(onReopen);
  completeRef.current = onComplete;
  reopenRef.current = onReopen;
  const canCompleteRef = useRef(!!canComplete);
  const canReopenRef = useRef(!!canReopen);
  canCompleteRef.current = !!canComplete;
  canReopenRef.current = !!canReopen;

  const active = canComplete || canReopen;

  const labelOpacity = canComplete
    ? x.interpolate({
        inputRange: [-MAX, -24, 0],
        outputRange: [1, 0.35, 0],
        extrapolate: 'clamp',
      })
    : x.interpolate({
        inputRange: [0, 24, MAX],
        outputRange: [0, 0.35, 1],
        extrapolate: 'clamp',
      });

  function snapHome() {
    Animated.timing(x, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      pos.current = 0;
    });
  }

  function move(dx: number) {
    const next = canCompleteRef.current ? clampComplete(dx) : clampReopen(dx);
    pos.current = next;
    x.setValue(next);
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dx) < AXIS && Math.abs(g.dy) < AXIS) return false;
        if (Math.abs(g.dx) <= Math.abs(g.dy)) return false;
        if (g.dx < 0) return canCompleteRef.current;
        return canReopenRef.current;
      },
      onPanResponderTerminationRequest: () => !dragging.current,
      onPanResponderGrant: () => {
        dragging.current = true;
        x.stopAnimation((v) => {
          pos.current = v;
        });
      },
      onPanResponderMove: (_, g) => move(g.dx),
      onPanResponderRelease: (_, g) => {
        const p = pos.current;
        const v = g.vx;
        if (canCompleteRef.current && (p <= -FIRE || v < -0.4)) completeRef.current?.();
        else if (canReopenRef.current && (p >= FIRE || v > 0.4)) reopenRef.current?.();
        snapHome();
        requestAnimationFrame(() => {
          dragging.current = false;
        });
      },
      onPanResponderTerminate: () => {
        snapHome();
        dragging.current = false;
      },
    }),
  ).current;

  if (!active) return <View className="mb-sm">{children}</View>;

  const action = canComplete ? (
    <View className="absolute inset-0 z-0 items-end justify-center bg-success pr-xl">
      <Animated.Text className="text-[15px] font-extrabold tracking-[0.3px] text-white" style={{ opacity: labelOpacity }}>
        Done
      </Animated.Text>
    </View>
  ) : (
    <View className="absolute inset-0 z-0 items-start justify-center bg-primary pl-xl">
      <Animated.Text className="text-[15px] font-extrabold tracking-[0.3px] text-white" style={{ opacity: labelOpacity }}>
        Reopen
      </Animated.Text>
    </View>
  );

  return (
    <View className="mb-sm overflow-hidden rounded-md" collapsable={false} {...pan.panHandlers}>
      <View className="relative bg-surface" collapsable={false}>
        {action}
        <Animated.View
          className="z-[2] w-full bg-surface"
          style={{
            transform: [{ translateX: x }],
            elevation: Platform.OS === 'android' ? 4 : 0,
          }}
        >
          <Pressable
            className="w-full bg-surface"
            onPress={() => {
              if (dragging.current || Math.abs(pos.current) > 2) return;
              onPress?.();
            }}
            delayPressIn={120}
          >
            {children}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
