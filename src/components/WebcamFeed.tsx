import { useRef, useEffect, useCallback, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WebcamFeedProps {
  onCapture: (base64: string) => void;
  isAnalyzing: boolean;
  captureInterval: number;
  isActive: boolean;
  onToggle: () => void;
}

export function WebcamFeed({ onCapture, isAnalyzing, captureInterval, isActive, onToggle }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [isActive, startCamera, stopCamera]);

  // Periodic capture
  useEffect(() => {
    if (!isActive || isAnalyzing) return;
    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      if (!base64 || base64.length < 100) return;
      onCapture(base64);
    }, captureInterval);
    return () => clearInterval(interval);
  }, [isActive, isAnalyzing, captureInterval, onCapture]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-card">
      {/* Scan line overlay */}
      {isActive && isAnalyzing && (
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          <div className="w-full h-1 bg-primary/60 animate-scan-line shadow-[0_0_20px_hsl(var(--neon-glow)/0.8)]" />
        </div>
      )}

      {/* Corner brackets */}
      {isActive && (
        <div className="absolute inset-0 z-10 pointer-events-none p-4">
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary" />
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full aspect-video object-cover ${isActive ? "block" : "hidden"}`}
      />

      {!isActive && (
        <div className="w-full aspect-video flex items-center justify-center bg-muted">
          <div className="text-center space-y-3">
            <CameraOff className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground text-sm font-mono">Camera inactive</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
          <p className="text-destructive text-sm text-center px-4">{error}</p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
        <Button
          onClick={onToggle}
          variant={isActive ? "destructive" : "default"}
          size="sm"
          className={!isActive ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_hsl(var(--neon-glow)/0.4)]" : ""}
        >
          {isActive ? <><CameraOff className="w-4 h-4 mr-2" /> Stop</> : <><Camera className="w-4 h-4 mr-2" /> Start</>}
        </Button>
      </div>
    </div>
  );
}
