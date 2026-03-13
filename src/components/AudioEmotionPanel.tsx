import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ToneResult {
  tones: Record<string, number>;
  dominant_tone: string;
  sentiment: string;
  sentiment_score: number;
  energy_level: number;
  summary: string;
}

interface AudioEmotionPanelProps {
  result: ToneResult | null;
}

const TONE_EMOJIS: Record<string, string> = {
  calm: "😌",
  stressed: "😰",
  joyful: "😄",
  irritated: "😤",
  confident: "💪",
  hesitant: "🤔",
  enthusiastic: "🔥",
  melancholic: "😔",
};

const TONE_COLORS: Record<string, string> = {
  calm: "hsl(180, 60%, 50%)",
  stressed: "hsl(0, 70%, 55%)",
  joyful: "hsl(50, 100%, 55%)",
  irritated: "hsl(15, 80%, 50%)",
  confident: "hsl(140, 60%, 45%)",
  hesitant: "hsl(270, 50%, 55%)",
  enthusiastic: "hsl(35, 100%, 55%)",
  melancholic: "hsl(220, 60%, 50%)",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-emotion-happy",
  negative: "text-emotion-angry",
  neutral: "text-muted-foreground",
};

function AnimatedBar({ value, color, label, emoji }: { value: number; color: string; label: string; emoji: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 50);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className={`flex items-center gap-2 transition-opacity duration-300 ${value < 1 ? "opacity-30" : "opacity-100"}`}>
      <span className="text-sm w-5">{emoji}</span>
      <span className="text-[10px] uppercase tracking-widest w-20 font-mono text-muted-foreground">{label}</span>
      <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, width: `${width}%` }}
          initial={false}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right text-muted-foreground">{value}%</span>
    </div>
  );
}

export function AudioEmotionPanel({ result }: AudioEmotionPanelProps) {
  if (!result) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-center">
        <p className="text-xs font-mono text-muted-foreground">Waiting for speech input...</p>
      </div>
    );
  }

  const sentimentColor = SENTIMENT_COLORS[result.sentiment] || "text-muted-foreground";

  return (
    <div className="space-y-3">
      {/* Dominant tone + sentiment */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          className="rounded-lg border border-border bg-card p-4 text-center relative overflow-hidden"
          animate={{ borderColor: "hsl(180, 100%, 50%, 0.2)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 relative">Tone</p>
          <p className="text-xl font-bold text-primary font-mono capitalize relative">{result.dominant_tone}</p>
          <p className="text-lg mt-0.5 relative">{TONE_EMOJIS[result.dominant_tone] || "🎤"}</p>
        </motion.div>

        <div className="rounded-lg border border-border bg-card p-4 text-center space-y-2">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Sentiment</p>
            <p className={`text-lg font-bold font-mono capitalize ${sentimentColor}`}>{result.sentiment}</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${((result.sentiment_score + 100) / 200) * 100}%`,
                  background: `linear-gradient(90deg, hsl(0, 70%, 55%), hsl(50, 100%, 55%), hsl(140, 60%, 45%))`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Energy level */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Energy Level</p>
          <span className="text-xs font-mono text-primary font-bold">{result.energy_level}%</span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-primary"
            initial={false}
            animate={{ width: `${result.energy_level}%` }}
            transition={{ duration: 0.7 }}
          />
        </div>
      </div>

      {/* Tone bars */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Tone Breakdown</p>
        {Object.entries(result.tones)
          .sort((a, b) => b[1] - a[1])
          .map(([tone, value]) => (
            <AnimatedBar
              key={tone}
              value={value}
              color={TONE_COLORS[tone] || "hsl(220, 10%, 50%)"}
              label={tone}
              emoji={TONE_EMOJIS[tone] || "🎤"}
            />
          ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Voice Analysis</p>
        <p className="text-xs text-secondary-foreground">{result.summary}</p>
      </div>
    </div>
  );
}
