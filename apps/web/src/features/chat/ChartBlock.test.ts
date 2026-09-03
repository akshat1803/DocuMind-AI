import { describe, expect, it } from 'vitest';
import { parseChartSpec } from './chart-spec';

describe('chart response validation', () => {
  it('accepts a bounded chart with numeric source data', () => {
    const result = parseChartSpec(JSON.stringify({
      type: 'bar', title: 'Revenue', xKey: 'year',
      series: [{ key: 'revenue', name: 'Revenue' }],
      data: [{ year: '2025', revenue: 120 }, { year: '2026', revenue: 180 }],
    }));
    expect(result?.type).toBe('bar');
    expect(result?.data).toHaveLength(2);
  });

  it('rejects executable, malformed, or non-numeric chart payloads', () => {
    expect(parseChartSpec('{not-json}')).toBeNull();
    expect(parseChartSpec(JSON.stringify({
      type: 'bar', title: 'Bad chart', xKey: 'label', script: 'alert(1)',
      series: [{ key: 'value', name: 'Value' }], data: [{ label: 'A', value: 'not numeric' }],
    }))).toBeNull();
  });
});
