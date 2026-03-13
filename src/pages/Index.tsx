import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WebcamFeed } from "@/components/WebcamFeed";
import { EmotionBar } from "@/components/EmotionBar";
import { EmotionTimeline } from "@/components/EmotionTimeline";
import { EmotionRadar } from "@/components/EmotionRadar";
import { SessionStats } from "@/components/SessionStats";
import { AudioCapture } from "@/components/AudioCapture";
import { AudioEmotionPanel } from "@/components/AudioEmotionPanel";
import { Activity, Brain, Zap, TrendingUp, Radar, BarChart3, Mic, Eye } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface EmotionResult {
  emotions: Record<string, number>;
  dominant: string;
  summary: string;
}

interface ToneResult {
  tones: Record<string, number>;
  dominant_tone: string;
  sentiment: string;
  sentiment_score: number;
  energy_level: number;
  summary: string;
}

interface EmotionSnapshot {
  timestamp: number;
  emotions: Record<string, number>;
  dominant: string;
}

const CAPTURE_INTERVAL = 12000;
const AUDIO_ANALYZE_INTERVAL = 15000;

const EMOTION_ORDER = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral", "contempt", "confused", "excited"];

const defaultEmotions: EmotionResult = {
  emotions: Object.fromEntries(EMOTION_ORDER.map((e) => [e, 0])),
  dominant: "none",
  summary: "Waiting for analysis...",
};

const EMOJI_MAP: Record<string, string> = {
  happy: "😊", sad: "😢", angry: "😠", surprised: "😲", fearful: "😨",
  disgusted: "🤢", neutral: "😐", contempt: "😏", confused: "😕", excited: "🤩",
};

const Index = () => {
  const [isActive, setIsActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<EmotionResult>(defaultEmotions);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [history, setHistory] = useState<EmotionSnapshot[]>([]);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"bars" | "radar" | "timeline">("bars");
  const [activePanel, setActivePanel] = useState<"video" | "audio">("video");
  const rateLimitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio state
  const [toneResult, setToneResult] = useState<ToneResult | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const lastTranscriptRef = useRef("");
  const lastAnalyzedRef = useRef("");
  const audioAnalyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live duration ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive || !sessionStart) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive, sessionStart]);

  // Periodic audio analysis
  useEffect(() => {
    if (!isActive) {
      if (audioAnalyzeTimerRef.current) clearInterval(audioAnalyzeTimerRef.current);
      return;
    }

    audioAnalyzeTimerRef.current = setInterval(async () => {
      const transcript = lastTranscriptRef.current;
      if (!transcript || transcript === lastAnalyzedRef.current || transcript.trim().length < 10) return;
      if (isAnalyzingAudio || rateLimited) return;

      setIsAnalyzingAudio(true);
      lastAnalyzedRef.current = transcript;

      try {
        const { data, error } = await supabase.functions.invoke("analyze-audio-emotion", {
          body: { transcript },
        });

        if (error) {
          const msg = error?.message || "";
          if (msg.includes("429") || msg.includes("rate")) {
            setRateLimited(true);
            toast.warning("Rate limited — pausing analysis for 30s");
            rateLimitTimer.current = setTimeout(() => setRateLimited(false), 30000);
            return;
          }
          console.error("Audio analysis error:", error);
          return;
        }

        if (data?.error) {
          if (data.error.includes("Rate limited")) {
            setRateLimited(true);
            toast.warning("Rate limited — pausing analysis for 30s");
            rateLimitTimer.current = setTimeout(() => setRateLimited(false), 30000);
            return;
          }
          return;
        }

        if (data?.tones) {
          setToneResult(data);
        }
      } catch (err) {
        console.error("Audio analysis error:", err);
      } finally {
        setIsAnalyzingAudio(false);
      }
    }, AUDIO_ANALYZE_INTERVAL);

    return () => {
      if (audioAnalyzeTimerRef.current) clearInterval(audioAnalyzeTimerRef.current);
    };
  }, [isActive, isAnalyzingAudio, rateLimited]);

  const handleTranscript = useCallback((text: string) => {
    lastTranscriptRef.current = text;
  }, []);

  const handleCapture = useCallback(async (imageBase64: string) => {
    if (rateLimited) return;

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-emotion", {
        body: { imageBase64 },
      });

      if (error) {
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
        setHistory((prev) => [
          ...prev.slice(-29),
          { timestamp: Date.now(), emotions: data.emotions, dominant: data.dominant },
        ]);
      }
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [rateLimited]);

  const handleToggle = useCallback(() => {
    setIsActive((a) => {
      if (a) {
        setResult(defaultEmotions);
        setRateLimited(false);
        setSessionStart(null);
        setToneResult(null);
        lastTranscriptRef.current = "";
        lastAnalyzedRef.current = "";
        if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
      } else {
        setHistory([]);
        setAnalysisCount(0);
        setSessionStart(Date.now());
      }
      return !a;
    });
  }, []);

  const topEmotions = [...EMOTION_ORDER]
    .map((e) => ({ name: e, value: result.emotions[e] || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .filter((e) => e.value > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border px-6 py-4 relative z-10 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse-neon">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight font-mono">EMOTION.AI</h1>
              <p className="text-xs text-muted-foreground font-mono">Multimodal Emotion Recognition</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            {isAnalyzingAudio && (
              <div className="flex items-center gap-1.5 text-accent">
                <Mic className="w-3 h-3 animate-pulse" />
                ANALYZING
              </div>
            )}
            {rateLimited && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 text-destructive"
              >
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                COOLDOWN
              </motion.div>
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
      <main className="max-w-7xl mx-auto p-6 relative z-10">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Video feed column */}
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
              onToggle={handleToggle}
            />

            {/* Audio capture */}
            <AudioCapture isActive={isActive} onTranscript={handleTranscript} />

            {/* Quick emotion badges */}
            <AnimatePresence>
              {isActive && topEmotions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 flex-wrap"
                >
                  {topEmotions.map((e) => (
                    <motion.span
                      key={e.name}
                      layout
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-mono"
                    >
                      <span>{EMOJI_MAP[e.name]}</span>
                      <span className="capitalize text-foreground">{e.name}</span>
                      <span className="text-primary font-bold">{e.value}%</span>
                    </motion.span>
                  ))}
                  {toneResult && (
                    <motion.span
                      layout
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-accent/30 text-xs font-mono"
                    >
                      <Mic className="w-3 h-3 text-accent" />
                      <span className="capitalize text-foreground">{toneResult.dominant_tone}</span>
                      <span className={`font-bold ${toneResult.sentiment === "positive" ? "text-emotion-happy" : toneResult.sentiment === "negative" ? "text-emotion-angry" : "text-muted-foreground"}`}>
                        {toneResult.sentiment}
                      </span>
                    </motion.span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Summary */}
            <motion.div
              className="rounded-lg border border-border bg-card p-4"
              initial={false}
              animate={{ borderColor: result.dominant !== "none" ? "hsl(180, 100%, 50%, 0.2)" : "hsl(220, 15%, 18%)" }}
            >
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Analysis Summary</p>
              <p className="text-sm text-secondary-foreground">{result.summary}</p>
              {toneResult && (
                <p className="text-sm text-secondary-foreground mt-2 pt-2 border-t border-border">
                  🎤 {toneResult.summary}
                </p>
              )}
            </motion.div>

            {/* Session Stats */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                Session Stats
              </div>
              <SessionStats history={history} sessionStart={sessionStart} isActive={isActive} />
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Panel switcher: Video / Audio */}
            <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
              <button
                onClick={() => setActivePanel("video")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono transition-all ${
                  activePanel === "video" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Visual Emotion
              </button>
              <button
                onClick={() => setActivePanel("audio")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono transition-all ${
                  activePanel === "audio" ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Voice Tone
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activePanel === "video" ? (
                <motion.div
                  key="video-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Dominant emotion */}
                  <motion.div
                    className="rounded-lg border border-border bg-card p-5 text-center relative overflow-hidden"
                    animate={{ borderColor: result.dominant !== "none" ? "hsl(180, 100%, 50%, 0.3)" : "hsl(220, 15%, 18%)" }}
                  >
                    {result.dominant !== "none" && (
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                    )}
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2 relative">Dominant Emotion</p>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={result.dominant}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                        className="relative"
                      >
                        <p className="text-4xl font-bold text-primary font-mono capitalize">
                          {result.dominant === "none" ? "—" : result.dominant}
                        </p>
                        {result.dominant !== "none" && (
                          <p className="text-3xl mt-1">{EMOJI_MAP[result.dominant] || ""}</p>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>

                  {/* Tab switcher */}
                  <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
                    {([
                      { id: "bars" as const, label: "Bars", icon: BarChart3 },
                      { id: "radar" as const, label: "Radar", icon: Radar },
                      { id: "timeline" as const, label: "Timeline", icon: TrendingUp },
                    ]).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono transition-all ${
                          activeTab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTab === "bars" && (
                        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">Confidence Scores</p>
                          {EMOTION_ORDER.map((emotion) => (
                            <EmotionBar key={emotion} emotion={emotion} value={result.emotions[emotion] || 0} isDominant={result.dominant === emotion} />
                          ))}
                        </div>
                      )}
                      {activeTab === "radar" && (
                        <div className="rounded-lg border border-border bg-card p-5">
                          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">Emotion Radar</p>
                          <EmotionRadar emotions={result.emotions} />
                        </div>
                      )}
                      {activeTab === "timeline" && (
                        <div className="rounded-lg border border-border bg-card p-5">
                          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">Emotion Timeline</p>
                          <EmotionTimeline history={history} visibleEmotions={["happy", "sad", "angry", "surprised", "neutral", "excited"]} />
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="audio-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <AudioEmotionPanel result={toneResult} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
