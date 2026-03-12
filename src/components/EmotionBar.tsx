import { useEffect, useState } from "react";

const emotionColors: Record<string, string> = {
  happy: "bg-emotion-happy",
  sad: "bg-emotion-sad",
  angry: "bg-emotion-angry",
  surprised: "bg-emotion-surprised",
  fearful: "bg-emotion-fearful",
  disgusted: "bg-emotion-disgusted",
  neutral: "bg-emotion-neutral",
  contempt: "bg-emotion-contempt",
  confused: "bg-emotion-confused",
  excited: "bg-emotion-excited",
};

const emotionEmojis: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  surprised: "😲",
  fearful: "😨",
  disgusted: "🤢",
  neutral: "😐",
  contempt: "😏",
  confused: "😕",
  excited: "🤩",
};

interface EmotionBarProps {
  emotion: string;
  value: number;
  isDominant: boolean;
}

export function EmotionBar({ emotion, value, isDominant }: EmotionBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 50);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className={`flex items-center gap-3 transition-opacity duration-300 ${value < 1 ? "opacity-30" : "opacity-100"}`}>
      <span className="text-lg w-6">{emotionEmojis[emotion]}</span>
      <span className={`text-xs uppercase tracking-widest w-20 font-mono ${isDominant ? "text-primary font-bold" : "text-muted-foreground"}`}>
        {emotion}
      </span>
      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${emotionColors[emotion]} ${isDominant ? "shadow-[0_0_12px_hsl(var(--neon-glow)/0.5)]" : ""}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${isDominant ? "text-primary" : "text-muted-foreground"}`}>
        {value}%
      </span>
    </div>
  );
}
