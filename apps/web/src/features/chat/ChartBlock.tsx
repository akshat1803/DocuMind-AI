import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartSpec } from './chart-spec';

const CHART_COLORS = ['#0284c7', '#7c3aed', '#059669', '#ea580c'];

interface ChartBlockProps {
  spec: ChartSpec;
}

export default function ChartBlock({ spec }: ChartBlockProps) {
  const commonAxis = <><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey={spec.xKey} tick={{ fontSize: 12 }} stroke="#64748b" /><YAxis tick={{ fontSize: 12 }} stroke="#64748b" /><Tooltip /><Legend /></>;
  let chart: React.ReactNode;

  if (spec.type === 'bar') {
    chart = <BarChart data={spec.data}>{commonAxis}{spec.series.map((series, index) => <Bar key={series.key} dataKey={series.key} name={series.name} fill={CHART_COLORS[index]} radius={[5, 5, 0, 0]} />)}</BarChart>;
  } else if (spec.type === 'line') {
    chart = <LineChart data={spec.data}>{commonAxis}{spec.series.map((series, index) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.name} stroke={CHART_COLORS[index]} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}</LineChart>;
  } else if (spec.type === 'area') {
    chart = <AreaChart data={spec.data}>{commonAxis}{spec.series.map((series, index) => <Area key={series.key} type="monotone" dataKey={series.key} name={series.name} stroke={CHART_COLORS[index]} fill={CHART_COLORS[index]} fillOpacity={0.18} strokeWidth={2} />)}</AreaChart>;
  } else {
    const series = spec.series[0];
    chart = (
      <PieChart>
        <Pie data={spec.data} dataKey={series.key} nameKey={spec.xKey} cx="50%" cy="48%" outerRadius="72%" label>
          {spec.data.map((_row, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    );
  }

  return (
    <figure className="my-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" role="img" aria-label={spec.title}>
      <figcaption className="mb-4">
        <h3 className="font-semibold text-slate-950">{spec.title}</h3>
        {spec.description && <p className="mt-1 text-xs leading-5 text-slate-500">{spec.description}</p>}
      </figcaption>
      <div className="h-80 min-w-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      </div>
    </figure>
  );
}
