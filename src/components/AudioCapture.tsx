import { useRef, useEffect, useState, useCallback } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AudioCaptureProps {
  isActive: boolean;
  onTranscript: (text: string) => void;
}

// Extend Window for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export function AudioCapture({ isActive, onTranscript }: AudioCaptureProps) {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const transcriptBufferRef = useRef("");

  const startAudioLevel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, avg * 1.5));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Audio level visualization not critical
    }
  }, []);

  const stopAudioLevel = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const startRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (final) {
        transcriptBufferRef.current += final;
        onTranscript(transcriptBufferRef.current.trim());
      }
      setLiveTranscript(interim || final);
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech") return; // Ignore no-speech errors
      if (e.error === "aborted") return;
      console.error("Speech recognition error:", e.error);
      setError(`Mic error: ${e.error}`);
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (isActive && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("Failed to start speech recognition");
    }
  }, [isActive, onTranscript]);

  useEffect(() => {
    if (isActive) {
      transcriptBufferRef.current = "";
      startRecognition();
      startAudioLevel();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopAudioLevel();
      setIsListening(false);
      setLiveTranscript("");
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopAudioLevel();
    };
  }, [isActive, startRecognition, startAudioLevel, stopAudioLevel]);

  // Audio level bars
  const bars = 12;
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const threshold = (i / bars) * 100;
    return audioLevel > threshold ? Math.min(100, audioLevel - threshold + 30) : 10;
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isListening ? "bg-primary/20" : "bg-muted"}`}>
            {isListening ? (
              <Mic className="w-4 h-4 text-primary" />
            ) : (
              <MicOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Microphone</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {isListening ? "Listening..." : "Inactive"}
            </p>
          </div>
        </div>
        {isListening && (
          <div className="flex items-center gap-0.5 h-6">
            {barHeights.map((h, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-primary"
                animate={{ height: `${Math.max(4, h * 0.24)}px` }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive text-xs font-mono mb-2">{error}</p>
      )}

      <AnimatePresence>
        {liveTranscript && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 mt-2"
          >
            <Volume2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground font-mono italic truncate">
              "{liveTranscript}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
