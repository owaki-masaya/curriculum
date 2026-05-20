import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { DailySummary } from '../types';

interface Props {
  summaries: DailySummary[];
  targetCalories: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

interface ChartEntry {
  date: string;
  label: string;
  カロリー: number;
  isSelected: boolean;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function formatLabel(dateStr: string) {
  const d = new Date(dateStr);
  const day = DAY_LABELS[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${day})`;
}

export function WeeklyChart({ summaries, targetCalories, selectedDate, onSelectDate }: Props) {
  const data: ChartEntry[] = summaries.map((s) => ({
    date: s.date,
    label: formatLabel(s.date),
    カロリー: s.totalCalories,
    isSelected: s.date === selectedDate,
  }));

  return (
    <div className="weekly-chart">
      <h3>週間カロリー推移</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`${value} kcal`, 'カロリー']}
          />
          <ReferenceLine
            y={targetCalories}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: '目標', position: 'right', fontSize: 11, fill: '#f59e0b' }}
          />
          <Bar
            dataKey="カロリー"
            radius={[4, 4, 0, 0]}
            onClick={(entry) => onSelectDate((entry as unknown as ChartEntry).date)}
            style={{ cursor: 'pointer' }}
            fill="#6366f1"
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-hint">バーをクリックして日付を選択</p>
    </div>
  );
}
