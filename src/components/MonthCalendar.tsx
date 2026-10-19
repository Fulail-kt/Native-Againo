import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, ChevronRight } from '../icons';
import { colors } from '../theme';

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type CalDay = {
  date: string;
  weekday: number;
  inMonth: boolean;
  gymOpen: boolean;
  checkedIn: boolean;
  workout: { name: string; status: string; extraCount: number } | null;
};

export function MonthCalendar({
  title,
  days,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  title: string;
  days: CalDay[];
  selected?: string;
  onSelect: (day: CalDay) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View>
      <View className="mb-md flex-row items-center justify-between">
        <Pressable
          onPress={onPrev}
          className="h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface"
          hitSlop={8}
        >
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text className="text-[16px] font-bold text-ink">{title}</Text>
        <Pressable
          onPress={onNext}
          className="h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface"
          hitSlop={8}
        >
          <ChevronRight size={18} color={colors.text} />
        </Pressable>
      </View>
      <View className="mb-sm flex-row">
        {LABELS.map((l, i) => (
          <Text key={`${l}-${i}`} className="flex-1 text-center text-[11px] font-bold text-muted">
            {l}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {days.map((d, i) => {
          if (!d.inMonth) {
            return <View key={`e-${i}`} className="mb-0.5 aspect-square w-[14.28%] items-center justify-center rounded-sm" />;
          }
          const on = d.date === selected;
          const closed = !d.gymOpen;
          return (
            <Pressable
              key={d.date}
              className={`mb-0.5 aspect-square w-[14.28%] items-center justify-center rounded-sm${on ? ' bg-primary' : ''}${closed ? ' opacity-45' : ''}`}
              onPress={() => onSelect(d)}
            >
              <Text
                className={`text-[13px] font-semibold ${on ? 'text-white' : closed ? 'text-muted' : 'text-ink'}`}
              >
                {Number(d.date.slice(-2))}
              </Text>
              <View className="mt-0.5 h-[6px] flex-row gap-[3px]">
                {d.checkedIn ? <View className="h-[5px] w-[5px] rounded-[3px] bg-success" /> : null}
                {d.workout ? <View className="h-[5px] w-[5px] rounded-[3px] bg-accent" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-md flex-row flex-wrap gap-md">
        <Text className="text-[11px] font-semibold text-success">● Check-in</Text>
        <Text className="text-[11px] font-semibold text-primary">● Workout</Text>
        <Text className="text-[11px] font-semibold text-muted">Grey = gym closed</Text>
      </View>
    </View>
  );
}
