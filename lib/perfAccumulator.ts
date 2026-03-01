const samples = new Map<string, number[]>();

export function recordSample(endpoint: string, durationMs: number) {
  let arr = samples.get(endpoint);
  if (!arr) {
    arr = [];
    samples.set(endpoint, arr);
  }
  arr.push(durationMs);
}

export function getStats() {
  const result: Record<
    string,
    { count: number; avg: number; min: number; max: number; p50: number }
  > = {};

  for (const [endpoint, durations] of samples) {
    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mid = Math.floor(count / 2);
    const p50 = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    result[endpoint] = {
      count,
      avg: Math.round(sum / count),
      min: sorted[0],
      max: sorted[count - 1],
      p50: Math.round(p50),
    };
  }

  return result;
}

export function resetStats() {
  samples.clear();
}
