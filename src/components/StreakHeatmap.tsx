import { Text, View } from 'react-native';
import { Flame } from '../icons';
import { colors } from '../theme';

type Cell = { date: string; state: 'done' | 'missed' | 'rest' | 'today' };

function fill(state?: Cell['state'] | null) {
  if (state === 'done') return colors.success;
  if (state === 'today') return colors.primary;
  if (state === 'missed') return colors.surface2;
  if (state === 'rest') return colors.border;
  return 'transparent';
}

export function StreakHeatmap({
  cells,
  current,
  best,
}: {
  cells: Cell[];
  current: number;
  best: number;
}) {
  if (!cells.length) return null;
  const pad = new Date(`${cells[0].date}T12:00:00`).getDay();
  const padded: (Cell | null)[] = [...Array(pad).fill(null), ...cells];
  const cols = Math.ceil(padded.length / 7);
  const rows: (Cell | null)[][] = [];
  for (let r = 0; r < 7; r++) {
    const row: (Cell | null)[] = [];
    for (let c = 0; c < cols; c++) row.push(padded[c * 7 + r] ?? null);
    rows.push(row);
  }

  return (
    <View className="mb-lg rounded-lg border border-border bg-surface p-lg">
      <View className="mb-md flex-row items-center gap-sm">
        <Flame size={18} color={colors.warning} />
        <Text className="flex-1 text-[16px] font-bold text-ink">{current} day streak</Text>
        <Text className="text-[12px] font-semibold text-muted">best {best}</Text>
      </View>
      <View className="gap-[3px]">
        {rows.map((row, ri) => (
          <View key={ri} className="flex-row gap-[3px]">
            {row.map((cell, ci) => (
              <View
                key={`${ri}-${ci}`}
                className="aspect-square flex-1 rounded-[2px]"
                style={{ backgroundColor: fill(cell?.state) }}
              />
            ))}
          </View>
        ))}
      </View>
      <Text className="mt-md text-[11px] text-muted">Green = trained · grey = missed · dim = rest day</Text>
    </View>
  );
}
