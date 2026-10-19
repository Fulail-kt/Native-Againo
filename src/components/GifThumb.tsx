import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius } from '../theme';

export function GifThumb({
  uri,
  size = 48,
  width,
  height,
  style,
}: {
  uri?: string | null;
  size?: number;
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <View
      className="overflow-hidden bg-surface2"
      style={[
        {
          width: w,
          height: h,
          borderRadius: typeof w === 'number' ? Math.min(radius.md, Number(w) / 5) : radius.md,
        },
        style,
      ]}
    >
      {uri ? <Image source={{ uri }} className="h-full w-full" resizeMode="contain" /> : null}
    </View>
  );
}
