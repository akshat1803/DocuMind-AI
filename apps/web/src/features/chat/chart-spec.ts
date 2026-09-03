import { z } from 'zod';

const ChartValueSchema = z.union([z.string(), z.number(), z.null()]);

export const ChartSpecSchema = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(300).optional(),
  xKey: z.string().trim().min(1).max(60),
  series: z.array(z.object({
    key: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(80),
  })).min(1).max(4),
  data: z.array(z.record(ChartValueSchema)).min(1).max(50),
}).strict();

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export function parseChartSpec(value: string): ChartSpec | null {
  try {
    const parsed = ChartSpecSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    const keys = new Set(parsed.data.series.map((series) => series.key));
    const containsNumericValue = parsed.data.data.some((row) => [...keys].some((key) => typeof row[key] === 'number'));
    return containsNumericValue ? parsed.data : null;
  } catch {
    return null;
  }
}
