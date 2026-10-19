import { ReactNode, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AppIcon } from './icons';
import { ArrowLeft, ChevronRight, Info } from './icons';
import { BrandMark } from './brand';
import { useFrameInsets } from './safe';
import { colors, space, useTheme, type ThemePref } from './theme';
import { Switch } from '@/components/ui/switch';
import { clip, type InputKind } from './sanitize';

type Anchor = { x: number; y: number; w: number; h: number };

function HelpPopover({
  title,
  body,
  anchor,
  onClose,
}: {
  title: string;
  body: string;
  anchor: Anchor;
  onClose: () => void;
}) {
  const screenW = Dimensions.get('window').width;
  const bubbleW = Math.min(280, screenW - space.lg * 2);
  const left = Math.min(
    Math.max(space.lg, anchor.x + anchor.w / 2 - bubbleW / 2),
    screenW - bubbleW - space.lg,
  );
  const top = anchor.y + anchor.h + space.sm;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1">
        <Pressable className="absolute inset-0 bg-black/15" onPress={onClose} />
        <View
          className="absolute rounded-md border border-border bg-surface p-md shadow-lg"
          style={{ top, left, width: bubbleW, elevation: 12 }}
        >
          <Text className="text-[13px] font-bold text-ink">{title}</Text>
          <Text className="mt-1 text-[12px] leading-[17px] text-muted">{body}</Text>
        </View>
      </View>
    </Modal>
  );
}

export function HelpTrigger({ title, body }: { title: string; body: string }) {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  function open() {
    ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }

  return (
    <>
      <View ref={ref} collapsable={false}>
        <Pressable onPress={open} hitSlop={10} className="p-1">
          <Info size={16} color={anchor ? colors.primary : colors.muted} />
        </Pressable>
      </View>
      {anchor ? (
        <HelpPopover title={title} body={body} anchor={anchor} onClose={() => setAnchor(null)} />
      ) : null}
    </>
  );
}

export function AppShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useFrameInsets();
  return (
    <View
      className="flex-1 bg-bg"
      style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: footer ? 0 : insets.bottom,
      }}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="relative flex-1">
          <View className="flex-1">{children}</View>
          {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Header({
  title,
  subtitle,
  right,
  brand,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  brand?: boolean;
}) {
  return (
    <View className="flex-row items-center border-b border-border px-lg pb-md pt-sm">
      {brand ? (
        <View className="mr-sm">
          <BrandMark size={36} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="text-[22px] font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function ScrollBody({
  children,
  fabPad,
}: {
  children: ReactNode;
  fabPad?: boolean;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="p-lg pb-xxl"
      contentContainerStyle={fabPad ? { paddingBottom: 96 } : undefined}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Fab({
  label,
  onPress,
  icon: Icon,
}: {
  label: string;
  onPress: () => void;
  icon?: AppIcon;
}) {
  return (
    <View className="absolute bottom-md left-0 right-0 z-10 items-center" pointerEvents="box-none">
      <Pressable
        className="flex-row items-center gap-sm rounded-pill bg-primary px-xl py-3"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
        onPress={onPress}
      >
        {Icon ? <Icon size={18} color="#fff" strokeWidth={2.4} /> : null}
        <Text className="text-[15px] font-bold text-white">{label}</Text>
      </Pressable>
    </View>
  );
}

export function BackHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center border-b border-border px-lg pb-md pt-sm">
      <Pressable
        className="mr-md h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface"
        onPress={onBack}
        hitSlop={8}
      >
        <ArrowLeft size={22} color={colors.text} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-[22px] font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-muted">{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function NextStep({ text }: { text: string }) {
  return (
    <View className="mb-lg flex-row items-center gap-sm rounded-md border border-primary bg-surface2 p-md">
      <ChevronRight size={18} color={colors.primary} />
      <Text className="flex-1 text-[14px] font-semibold text-ink">{text}</Text>
    </View>
  );
}

/** Tap (i) → anchored popover. Tap outside close. */
export function Hint({ title, body }: { title: string; body: string }) {
  return <HelpTrigger title={title} body={body} />;
}

export function Panel({ children }: { children: ReactNode }) {
  return <View className="mb-lg rounded-lg border border-border bg-surface p-lg">{children}</View>;
}

export function Section({
  title,
  help,
  action,
  children,
}: {
  title?: string;
  help?: { title: string; body: string };
  action?: ReactNode;
  children: ReactNode;
}) {
  const head = title || help || action;
  return (
    <View className="mb-xl">
      {head ? (
        <View className="mb-sm flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-xs">
            {title ? (
              <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-muted">{title}</Text>
            ) : null}
            {help ? <HelpTrigger title={help.title} body={help.body} /> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  multiline,
  tight,
  hideLabel,
  onSubmitEditing,
  returnKeyType,
  kind,
  maxLength,
}: {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  tight?: boolean;
  hideLabel?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'search' | 'done' | 'go';
  kind?: InputKind;
  maxLength?: number;
}) {
  const kb =
    keyboardType ??
    (kind === 'digits' ? 'numeric' : kind === 'decimal' ? 'decimal-pad' : undefined);
  return (
    <View className={tight ? 'mb-0 flex-1' : 'mb-md'}>
      {hideLabel ? null : <Text className="mb-sm text-[14px] font-semibold text-ink">{label}</Text>}
      <TextInput
        className={`rounded-lg border border-border bg-surface px-md py-3.5 text-[16px] text-ink${multiline ? ' min-h-[88px]' : ''}`}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
        placeholderTextColor={colors.muted}
        autoCapitalize={kind === 'alnum' ? 'characters' : 'none'}
        value={value}
        onChangeText={(t) => onChangeText(clip(kind, t))}
        placeholder={placeholder}
        secureTextEntry={secure}
        keyboardType={kb}
        multiline={multiline}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        maxLength={maxLength}
      />
      {hint ? <Text className="mt-xs text-[12px] text-muted">{hint}</Text> : null}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Btn({
  label,
  onPress,
  busy,
  variant = 'primary',
  disabled,
  icon: Icon,
  inset,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: BtnVariant;
  disabled?: boolean;
  icon?: AppIcon;
  /** Inside panel/sheet — tighter vertical spacing */
  inset?: boolean;
}) {
  const bg =
    variant === 'secondary'
      ? 'border border-border bg-surface2'
      : variant === 'danger'
        ? 'bg-danger'
        : variant === 'ghost'
          ? 'bg-transparent'
          : 'bg-primary';
  const text =
    variant === 'secondary' ? 'text-ink' : variant === 'ghost' ? 'text-primary' : 'text-white';

  return (
    <Pressable
      className={`items-center rounded-lg py-[14px] ${inset ? 'my-sm' : 'my-md'} ${bg} ${disabled || busy ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={disabled || busy}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <View className="flex-row items-center gap-sm">
          {Icon ? (
            <Icon
              size={18}
              color={
                variant === 'ghost'
                  ? colors.primary
                  : variant === 'secondary'
                    ? colors.text
                    : '#fff'
              }
            />
          ) : null}
          <Text className={`text-[15px] font-bold ${text}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PairCtas({
  hint,
  left,
  right,
}: {
  hint?: string;
  left?: ReactNode;
  right: ReactNode;
}) {
  return (
    <View>
      {hint ? <Text className="mb-sm text-[12px] leading-[16px] text-muted">{hint}</Text> : null}
      <View className="flex-row gap-sm">
        {left ? <View className="min-w-0 flex-1">{left}</View> : null}
        <View className="min-w-0 flex-1">{right}</View>
      </View>
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  compact,
  end,
}: {
  options: { key: string; label: string; icon?: AppIcon }[];
  value: string;
  onChange: (key: string) => void;
  /** Text/icon tabs + underline — no pill box */
  compact?: boolean;
  end?: { key: string; label: string; icon?: AppIcon }[];
}) {
  function tabs(opts: { key: string; label: string; icon?: AppIcon }[]) {
    return opts.map((o) => {
      const on = o.key === value;
      return (
        <Pressable
          key={o.key}
          className="pb-0.5"
          accessibilityLabel={o.label}
          accessibilityState={{ selected: on }}
          onPress={() => onChange(o.key)}
        >
          <Text className={`text-[12px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>
            {o.label}
          </Text>
          {on ? <View className="mt-0.5 h-0.5 rounded-full bg-primary" /> : <View className="mt-0.5 h-0.5" />}
        </Pressable>
      );
    });
  }

  if (compact) {
    if (end?.length) {
      return (
        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-md">{tabs(options)}</View>
          <View className="flex-row gap-md">{tabs(end)}</View>
        </View>
      );
    }
    return <View className="flex-row gap-md">{tabs(options)}</View>;
  }

  return (
    <View className="mb-lg flex-row rounded-lg border border-border bg-surface2 p-1">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            className={`flex-1 items-center rounded-md py-2.5 ${on ? 'bg-surface' : ''}`}
            onPress={() => onChange(o.key)}
          >
            <Text className={`text-[13px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppearanceSettings() {
  const { pref, setPref } = useTheme();
  return (
    <Section title="Appearance">
      <Segmented
        options={[
          { key: 'system', label: 'System' },
          { key: 'light', label: 'Light' },
          { key: 'dark', label: 'Dark' },
        ]}
        value={pref}
        onChange={(k) => setPref(k as ThemePref)}
      />
    </Section>
  );
}

export function BottomNav({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string; Icon: AppIcon }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View className="flex-row border-t border-border bg-surface pt-sm">
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable key={item.key} className="flex-1 items-center gap-0.5 py-xs" onPress={() => onChange(item.key)}>
            <item.Icon size={22} color={on ? colors.primary : colors.muted} strokeWidth={on ? 2.5 : 2} />
            <Text className={`text-[11px] font-semibold ${on ? 'text-primary' : 'text-muted'}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatGrid({
  items,
}: {
  items: { label: string; value: string | number; lines?: { label: string; value: string }[] }[];
}) {
  return (
    <View className="flex-row flex-wrap gap-md">
      {items.map((item) => (
        <View key={item.label} className="min-w-[45%] flex-1 rounded-lg border border-border bg-surface p-lg">
          <Text className="text-[28px] font-extrabold text-ink">{item.value}</Text>
          <Text className="mt-xs text-[13px] text-muted">{item.label}</Text>
          {item.lines?.length ? (
            <View className="mt-sm gap-xs border-t border-border pt-sm">
              {item.lines.map((line) => (
                <View key={line.label} className="flex-row items-center justify-between gap-sm">
                  <Text className="min-w-0 flex-1 text-[12px] text-muted" numberOfLines={1}>
                    {line.label}
                  </Text>
                  <Text className="text-[12px] font-bold text-ink">{line.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

type DayStatTone = 'primary' | 'success' | 'warning' | 'muted';

function dayStatToneClass(tone: DayStatTone) {
  if (tone === 'success') return 'text-success';
  if (tone === 'warning') return 'text-warning';
  if (tone === 'primary') return 'text-primary';
  return 'text-muted';
}

function TallStatCard({
  label,
  value,
  tone = 'primary',
  lines,
}: {
  label: string;
  value: string | number;
  tone?: DayStatTone;
  lines?: { label: string; value: string | number; tone?: DayStatTone }[];
}) {
  const tint =
    tone === 'success'
      ? 'border-success/30 bg-success/10'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning/10'
        : 'border-primary/30 bg-primary/10';

  return (
    <View className="flex-1 overflow-hidden rounded-lg border border-border bg-surface">
      <View className={`items-center px-sm py-sm ${tint}`}>
        <Text className="text-[10px] font-bold uppercase tracking-[0.5px] text-muted">{label}</Text>
        <Text className="text-[22px] font-extrabold leading-none text-ink">{value}</Text>
      </View>
      {lines?.length ? (
        <View className="gap-0.5 border-t border-border bg-surface2 px-sm py-xs">
          {lines.map((line) => (
            <View key={line.label} className="flex-row items-center justify-between gap-sm py-0.5">
              <Text className="min-w-0 flex-1 text-[11px] text-muted" numberOfLines={1}>
                {line.label}
              </Text>
              <Text className={`text-[11px] font-bold ${dayStatToneClass(line.tone ?? 'muted')}`}>
                {line.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function DayOverviewGrid({
  booking,
  revenue,
  footer,
}: {
  booking: {
    value: string | number;
    lines: { label: string; value: string | number; tone?: DayStatTone }[];
  };
  revenue: {
    value: string;
    lines?: { label: string; value: string }[];
  };
  footer: { label: string; value: string | number }[];
}) {
  return (
    <View className="gap-sm">
      <View className="flex-row gap-sm">
        <TallStatCard label="Today's bookings" value={booking.value} tone="primary" lines={booking.lines} />
        <TallStatCard label="Revenue" value={revenue.value} tone="success" lines={revenue.lines} />
      </View>
      <View className="flex-row gap-sm">
        {footer.map((item) => (
          <View
            key={item.label}
            className="flex-1 flex-row items-center justify-between rounded-lg border border-border bg-surface px-md py-sm"
          >
            <Text className="text-[11px] font-semibold text-muted">{item.label}</Text>
            <Text className="text-[15px] font-extrabold text-ink">{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Card({
  title,
  body,
  badge,
  onPress,
  footer,
}: {
  title: string;
  body?: string;
  badge?: string;
  onPress?: () => void;
  footer?: ReactNode;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper className="mb-md rounded-lg border border-border bg-surface p-lg" onPress={onPress as () => void}>
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 text-[16px] font-bold text-ink">{title}</Text>
        {badge ? (
          <View className="ml-sm rounded-pill bg-surface2 px-sm py-1">
            <Text className="text-[11px] font-bold text-accent">{badge}</Text>
          </View>
        ) : null}
      </View>
      {body ? <Text className="mt-sm text-[14px] leading-5 text-muted">{body}</Text> : null}
      {footer}
    </Wrapper>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  selected,
  trailing,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  selected?: boolean;
  trailing?: ReactNode;
}) {
  const box = `mb-sm flex-row items-center rounded-md border p-md ${selected ? 'border-primary bg-surface2' : 'border-border bg-surface'}`;
  const body = (
    <>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-muted">{subtitle}</Text> : null}
      </View>
      {right ? <Text className="ml-sm text-[12px] font-bold text-primary">{right}</Text> : null}
    </>
  );
  if (trailing) {
    return (
      <View className={box}>
        <Pressable className="min-w-0 flex-1 flex-row items-center" onPress={onPress} disabled={!onPress}>
          {body}
        </Pressable>
        <View className="ml-md">{trailing}</View>
      </View>
    );
  }
  return (
    <Pressable className={box} onPress={onPress} disabled={!onPress}>
      {body}
    </Pressable>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center rounded-lg border border-dashed border-border bg-surface p-xl">
      <Text className="mb-sm text-[16px] font-bold text-ink">{title}</Text>
      <Text className="text-center text-[14px] leading-5 text-muted">{body}</Text>
    </View>
  );
}

export function CheckRow({
  label,
  body,
  checked,
  onToggle,
}: {
  label: string;
  body?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="mb-sm flex-row items-center gap-md py-md">
      <Pressable
        className="min-w-0 flex-1"
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
      >
        <Text className="text-[15px] font-semibold text-ink">{label}</Text>
        {body ? (
          <Text className="mt-0.5 text-[12px] leading-[16px] text-muted" numberOfLines={2}>
            {body}
          </Text>
        ) : null}
      </Pressable>
      <Switch checked={checked} onCheckedChange={() => onToggle()} accessibilityLabel={label} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      className={`mb-sm mr-sm rounded-pill border px-md py-sm ${selected ? 'border-primary bg-primary' : 'border-border bg-surface2'} ${disabled ? 'opacity-35' : ''}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className={`text-[13px] font-semibold ${selected ? 'text-white' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

export function RestBanner({ seconds }: { seconds: number }) {
  return (
    <View className="mb-lg items-center rounded-lg border border-warning bg-[#422006] p-lg">
      <Text className="text-[13px] font-bold text-warning">Rest before next set</Text>
      <Text className="mt-xs text-[36px] font-extrabold text-[#fde68a]">{seconds}s</Text>
    </View>
  );
}
