import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface EmotionSnapshot {
  timestamp: number;
  emotions: Record<string, number>;
  dominant: string;
}

interface EmotionTimelineProps {
  history: EmotionSnapshot[];
  visibleEmotions?: string[];
}

const EMOTION_COLORS: Record<string, string> = {
  happy: "hsl(50, 100%, 55%)",
  sad: "hsl(220, 80%, 55%)",
  angry: "hsl(0, 80%, 55%)",
  surprised: "hsl(35, 100%, 55%)",
  fearful: "hsl(270, 60%, 55%)",
  disgusted: "hsl(140, 50%, 40%)",
  neutral: "hsl(220, 10%, 50%)",
  contempt: "hsl(15, 60%, 50%)",
  confused: "hsl(200, 50%, 55%)",
  excited: "hsl(320, 80%, 60%)",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs font-mono text-muted-foreground mb-2">{label}</p>
      {payload
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5)
        .map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs font-mono">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="capitalize text-foreground">{entry.name}</span>
            <span className="ml-auto text-muted-foreground">{entry.value}%</span>
          </div>
        ))}
    </div>
  );
};

export function EmotionTimeline({ history, visibleEmotions }: EmotionTimelineProps) {
  const chartData = useMemo(() => {
    return history.map((snap, i) => {
      const time = new Date(snap.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return { time, scan: i + 1, ...snap.emotions };
    });
  }, [history]);

  const emotions = visibleEmotions || Object.keys(EMOTION_COLORS);

  if (history.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm font-mono">
        Need at least 2 scans to show timeline...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 15%)" />
        <XAxis dataKey="scan" tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }} axisLine={{ stroke: "hsl(220, 15%, 18%)" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }} axisLine={{ stroke: "hsl(220, 15%, 18%)" }} />
        <Tooltip content={<CustomTooltip />} />
        {emotions.map((emotion) => (
          <Line
            key={emotion}
            type="monotone"
            dataKey={emotion}
            stroke={EMOTION_COLORS[emotion]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
