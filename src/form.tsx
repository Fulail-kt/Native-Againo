import { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Controller,
  FormProvider,
  useForm,
  type Control,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
  useFormContext,
} from 'react-hook-form';
import type { ZodType } from 'zod';
import type { AppIcon } from './icons';
import { Btn } from './ui';
import { colors } from './theme';
import { clip, type InputKind } from './sanitize';

export function useAppForm<T extends FieldValues>(schema: ZodType<unknown>, defaultValues: DefaultValues<T>) {
  return useForm<T>({
    resolver: zodResolver(schema as never),
    defaultValues,
    mode: 'onChange',
  });
}

export function Form<T extends FieldValues>({
  form,
  children,
}: {
  form: UseFormReturn<T>;
  children: ReactNode;
}) {
  return <FormProvider {...form}>{children}</FormProvider>;
}

type InputProps = {
  label: string;
  hint?: string;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  tight?: boolean;
  hideLabel?: boolean;
  autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'off';
  kind?: InputKind;
  maxLength?: number;
  look?: 'otp';
};

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  secure,
  keyboardType,
  multiline,
  tight,
  hideLabel,
  autoComplete,
  kind,
  maxLength,
  look,
}: InputProps & {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const kb =
    keyboardType ??
    (kind === 'digits' ? 'numeric' : kind === 'decimal' ? 'decimal-pad' : undefined);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className={tight ? 'mb-0 flex-1' : 'mb-md'}>
          {hideLabel ? null : <Text className="mb-sm text-[14px] font-semibold text-ink">{label}</Text>}
          <TextInput
            className={`${
              look === 'otp'
                ? 'rounded-lg border bg-surface py-4 text-center text-[24px] font-bold text-ink'
                : 'rounded-lg border bg-surface px-md py-3.5 text-[16px] text-ink'
            } ${fieldState.error ? 'border-danger' : 'border-border'}${multiline ? ' min-h-[88px]' : ''}`}
            style={
              look === 'otp'
                ? { letterSpacing: 10 }
                : multiline
                  ? { textAlignVertical: 'top' }
                  : undefined
            }
            placeholderTextColor={colors.muted}
            autoCapitalize={kind === 'alnum' ? 'characters' : 'none'}
            value={field.value == null ? '' : String(field.value)}
            onChangeText={(t) => field.onChange(clip(kind, t))}
            onBlur={field.onBlur}
            placeholder={placeholder}
            secureTextEntry={secure}
            keyboardType={kb}
            multiline={multiline}
            autoComplete={autoComplete}
            maxLength={maxLength}
          />
          {fieldState.error ? (
            <Text className="mt-xs text-[12px] font-semibold text-danger">{fieldState.error.message}</Text>
          ) : hint ? (
            <Text className="mt-xs text-[12px] text-muted">{hint}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

export function FormSubmit<T extends FieldValues>({
  label,
  onValid,
  busy,
  variant = 'primary',
  icon,
  inset,
  requireDirty = true,
}: {
  label: string;
  onValid: (data: T) => void | Promise<void>;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: AppIcon;
  inset?: boolean;
  requireDirty?: boolean;
}) {
  const {
    handleSubmit,
    formState: { isValid, isDirty },
  } = useFormContext<T>();
  return (
    <Btn
      label={label}
      onPress={handleSubmit(onValid)}
      disabled={busy || !isValid || (requireDirty && !isDirty)}
      busy={busy}
      variant={variant}
      icon={icon}
      inset={inset}
    />
  );
}
