import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { BrandMark } from './brand';
import { AppShell, ScrollBody } from './ui';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell>
      <ScrollBody>
        <View className="mb-lg mt-md items-center">
          <BrandMark size={48} />
        </View>
        <Text className="mb-lg text-center text-[26px] font-bold text-ink">{title}</Text>
        {children}
      </ScrollBody>
    </AppShell>
  );
}
