import { useMemo } from "react";
import { Clock, BarChart3, TrendingUp, Flame } from "lucide-react";

interface EmotionSnapshot {
  timestamp: number;
  emotions: Record<string, number>;
  dominant: string;
}

interface SessionStatsProps {
  history: EmotionSnapshot[];
  sessionStart: number | null;
  isActive: boolean;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function SessionStats({ history, sessionStart, isActive }: SessionStatsProps) {
  const stats = useMemo(() => {
    if (history.length === 0) return null;

    // Average emotions
    const totals: Record<string, number> = {};
    history.forEach((snap) => {
      Object.entries(snap.emotions).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + v;
      });
    });
    const avgEmotions = Object.entries(totals)
      .map(([k, v]) => ({ emotion: k, avg: Math.round(v / history.length) }))
      .sort((a, b) => b.avg - a.avg);

    // Most dominant emotion
    const dominantCounts: Record<string, number> = {};
    history.forEach((snap) => {
      if (snap.dominant !== "none") {
        dominantCounts[snap.dominant] = (dominantCounts[snap.dominant] || 0) + 1;
      }
    });
    const topDominant = Object.entries(dominantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

    // Mood trend (compare first half vs second half)
    const half = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, half);
    const secondHalf = history.slice(half);
    const avgPositive = (snaps: EmotionSnapshot[]) =>
      snaps.reduce((sum, s) => sum + (s.emotions.happy || 0) + (s.emotions.excited || 0), 0) / (snaps.length || 1);
    const trend = avgPositive(secondHalf) - avgPositive(firstHalf);
    const trendLabel = trend > 5 ? "Improving" : trend < -5 ? "Declining" : "Stable";

    return { avgEmotions, topDominant, trendLabel, peakEmotion: avgEmotions[0] };
  }, [history]);

  const duration = sessionStart && isActive ? Date.now() - sessionStart : 0;

  const EMOJI_MAP: Record<string, string> = {
    happy: "😊", sad: "😢", angry: "😠", surprised: "😲", fearful: "😨",
    disgusted: "🤢", neutral: "😐", contempt: "😏", confused: "😕", excited: "🤩",
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Clock className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Duration</p>
          <p className="text-sm font-bold font-mono text-foreground">{duration > 0 ? formatDuration(duration) : "—"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Scans</p>
          <p className="text-sm font-bold font-mono text-foreground">{history.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Flame className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Top Mood</p>
          <p className="text-sm font-bold font-mono text-foreground capitalize">
            {stats ? `${EMOJI_MAP[stats.topDominant] || ""} ${stats.topDominant}` : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Trend</p>
          <p className="text-sm font-bold font-mono text-foreground">{stats?.trendLabel || "—"}</p>
        </div>
      </div>
    </div>
  );
}
