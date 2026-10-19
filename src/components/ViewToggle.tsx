import { Pressable, View } from 'react-native';
import { LayoutGrid, LayoutList } from '../icons';
import { colors } from '../theme';

export type TileView = 'list' | 'cards';

export function ViewToggle({
  value,
  onChange,
}: {
  value: TileView;
  onChange: (v: TileView) => void;
}) {
  return (
    <View className="flex-row rounded-md border border-border bg-surface2 p-0.5">
      <Pressable
        onPress={() => onChange('list')}
        className={`h-8 w-9 items-center justify-center rounded-sm ${value === 'list' ? 'bg-surface' : ''}`}
        hitSlop={4}
      >
        <LayoutList size={18} color={value === 'list' ? colors.text : colors.muted} />
      </Pressable>
      <Pressable
        onPress={() => onChange('cards')}
        className={`h-8 w-9 items-center justify-center rounded-sm ${value === 'cards' ? 'bg-surface' : ''}`}
        hitSlop={4}
      >
        <LayoutGrid size={18} color={value === 'cards' ? colors.text : colors.muted} />
      </Pressable>
    </View>
  );
}
