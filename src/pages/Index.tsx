import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WebcamFeed } from "@/components/WebcamFeed";
import { EmotionBar } from "@/components/EmotionBar";
import { Activity, Brain, Zap } from "lucide-react";
import { toast } from "sonner";

interface EmotionResult {
  emotions: Record<string, number>;
  dominant: string;
  summary: string;
}

const CAPTURE_INTERVAL = 12000;

const EMOTION_ORDER = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral", "contempt", "confused", "excited"];

const defaultEmotions: EmotionResult = {
  emotions: Object.fromEntries(EMOTION_ORDER.map((e) => [e, 0])),
  dominant: "none",
  summary: "Waiting for analysis...",
};

const Index = () => {
  const [isActive, setIsActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<EmotionResult>(defaultEmotions);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const rateLimitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCapture = useCallback(async (imageBase64: string) => {
    if (rateLimited) return; // skip while cooling down

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-emotion", {
        body: { imageBase64 },
      });

      if (error) {
        // Check for rate limit (429)
        const msg = error?.message || "";
        if (msg.includes("429") || msg.includes("rate")) {
          setRateLimited(true);
          toast.warning("Rate limited — pausing analysis for 30s");
          rateLimitTimer.current = setTimeout(() => setRateLimited(false), 30000);
          return;
        }
        console.error("Analysis error:", error);
        return;
      }

      if (data?.error) {
        if (data.error.includes("Rate limited")) {
          setRateLimited(true);
          toast.warning("Rate limited — pausing analysis for 30s");
          rateLimitTimer.current = setTimeout(() => setRateLimited(false), 30000);
          return;
        }
        toast.error(data.error);
        return;
      }

      if (data?.emotions) {
        setResult(data);
        setAnalysisCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [rateLimited]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse-neon">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight font-mono">EMOTION.AI</h1>
              <p className="text-xs text-muted-foreground font-mono">Real-time Emotion Recognition</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            {rateLimited && (
              <div className="flex items-center gap-1.5 text-destructive">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                COOLDOWN
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isActive ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
              {isActive ? "LIVE" : "OFFLINE"}
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              {analysisCount} scans
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Video feed */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 text-primary" />
              Video Feed
            </div>
            <WebcamFeed
              onCapture={handleCapture}
              isAnalyzing={isAnalyzing || rateLimited}
              captureInterval={CAPTURE_INTERVAL}
              isActive={isActive}
              onToggle={() => {
                setIsActive((a) => !a);
                if (isActive) {
                  setResult(defaultEmotions);
                  setRateLimited(false);
                  if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
                }
              }}
            />
            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Analysis Summary</p>
              <p className="text-sm text-secondary-foreground">{result.summary}</p>
            </div>
          </div>

          {/* Emotion panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
              <Brain className="w-3.5 h-3.5 text-primary" />
              Emotion Analysis
            </div>

            {/* Dominant emotion */}
            <div className="rounded-lg border border-border bg-card p-5 text-center">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Dominant Emotion</p>
              <p className="text-4xl font-bold text-primary font-mono capitalize">
                {result.dominant === "none" ? "—" : result.dominant}
              </p>
              {result.dominant !== "none" && (
                <p className="text-2xl mt-1">
                  {({ happy: "😊", sad: "😢", angry: "😠", surprised: "😲", fearful: "😨", disgusted: "🤢", neutral: "😐", contempt: "😏", confused: "😕", excited: "🤩" } as Record<string, string>)[result.dominant] || ""}
                </p>
              )}
            </div>

            {/* Bars */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">Confidence Scores</p>
              {EMOTION_ORDER.map((emotion) => (
                <EmotionBar
                  key={emotion}
                  emotion={emotion}
                  value={result.emotions[emotion] || 0}
                  isDominant={result.dominant === emotion}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
