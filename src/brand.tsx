import { Image, Text, View } from 'react-native';

export const AGAIN_NAME = 'Againo';
export const AGAIN_LOGO = require('../public/Assets/Againo-icon.png');

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={AGAIN_LOGO}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="Againo"
    />
  );
}

export function BrandLockup({ subtitle }: { subtitle?: string }) {
  return (
    <View className="flex-row items-center gap-sm">
      <BrandMark size={36} />
      <View className="flex-1">
        <Text className="text-[22px] font-bold text-ink">{AGAIN_NAME}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-muted">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
