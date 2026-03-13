import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface EmotionRadarProps {
  emotions: Record<string, number>;
}

export function EmotionRadar({ emotions }: EmotionRadarProps) {
  const data = Object.entries(emotions).map(([key, value]) => ({
    emotion: key.charAt(0).toUpperCase() + key.slice(1),
    value,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="hsl(220, 15%, 18%)" />
        <PolarAngleAxis
          dataKey="emotion"
          tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
        />
        <Radar
          dataKey="value"
          stroke="hsl(180, 100%, 50%)"
          fill="hsl(180, 100%, 50%)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
