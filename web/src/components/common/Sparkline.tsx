/** Biểu đồ đường nhỏ (SVG) có tô nền + chấm điểm cuối. */
export function Sparkline({ data, color, w = 116, h = 88 }: { data: number[] | null | undefined; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const pad = 4;
  const mn = Math.min(...data);
  const rg = Math.max(...data) - mn || 1;
  const X = (i: number) => pad + (i / (data.length - 1)) * (w - 2 * pad);
  const Y = (v: number) => h - pad - ((v - mn) / rg) * (h - 2 * pad);
  const line = data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const last = data.length - 1;
  const area = `${line} L ${X(last).toFixed(1)} ${h - pad} L ${X(0).toFixed(1)} ${h - pad} Z`;
  return (
    <svg className="spk" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={color} fillOpacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(last)} cy={Y(data[last])} r={2.4} fill={color} />
    </svg>
  );
}
