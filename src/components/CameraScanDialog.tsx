import { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Person = Tables<"persons">;

interface CameraScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPersons: Person[];
  onMatchResults: (persons: Person[]) => void;
}

const MAX_DIM = 600;

const CameraScanDialog = ({ open, onOpenChange, allPersons, onMatchResults }: CameraScanDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast.error("Could not access camera");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open && !captured) startCamera();
    if (!open) {
      stopCamera();
      setCaptured(null);
      setScanning(false);
      setProgress(0);
      setStatusText("");
      setElapsed(0);
      stopTimer();
    }
    return () => { stopCamera(); stopTimer(); };
  }, [open, captured, startCamera, stopCamera, stopTimer]);

  const resizeToCanvas = (source: HTMLVideoElement | HTMLImageElement): string => {
    const canvas = document.createElement("canvas");
    const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    const scale = Math.min(MAX_DIM / w, MAX_DIM / h, 1);
    canvas.width = w * scale;
    canvas.height = h * scale;
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  const scanWithImage = useCallback(async (imageData: string) => {
    setScanning(true);
    setProgress(5);
    setElapsed(0);
    setStatusText("Preparing…");

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 500);

    const withPhotos = allPersons
      .filter((p) => p.photo_path)
      .map((p) => ({
        id: p.id,
        photoUrl: supabase.storage.from("person-photos").getPublicUrl(p.photo_path!).data.publicUrl,
      }));

    if (withPhotos.length === 0) {
      toast.error("No person photos in database to compare against");
      setScanning(false);
      stopTimer();
      return;
    }

    setProgress(20);
    setStatusText(`Matching against ${withPhotos.length} photos…`);

    try {
      const { data, error } = await supabase.functions.invoke("face-match", {
        body: { capturedImage: imageData, personPhotos: withPhotos },
      });

      stopTimer();

      if (error) { toast.error("Scan failed: " + error.message); setScanning(false); return; }
      if (data?.error) { toast.error(data.error); setScanning(false); return; }

      setProgress(95);
      setStatusText("Processing results…");

      const matchedIds: string[] = data?.matchedIds || [];
      const stats = data?.stats;

      if (matchedIds.length === 0) {
        toast.info("No matching persons found");
      } else {
        const statsMsg = stats
          ? ` (${stats.totalPhotos} photos, ${stats.finalMatches} confirmed)`
          : "";
        toast.success(`Found ${matchedIds.length} match(es)${statsMsg}`);
      }

      const matched = allPersons.filter((p) => matchedIds.includes(p.id));
      onMatchResults(matched);
      setProgress(100);
      onOpenChange(false);
    } catch (e: any) {
      stopTimer();
      toast.error("Scan error: " + (e?.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  }, [allPersons, onMatchResults, onOpenChange, stopTimer]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const img = resizeToCanvas(video);
    setCaptured(img);
    stopCamera();
    setTimeout(() => scanWithImage(img), 100);
  };

  const retake = () => {
    setCaptured(null);
    setStatusText("");
    setElapsed(0);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const dataUrl = resizeToCanvas(img);
        setCaptured(dataUrl);
        setTimeout(() => scanWithImage(dataUrl), 100);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scan = async () => {
    if (!captured) return;
    setScanning(true);
    setProgress(5);
    setElapsed(0);
    setStatusText("Preparing photos…");

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 500);

    const withPhotos = allPersons
      .filter((p) => p.photo_path)
      .map((p) => ({
        id: p.id,
        photoUrl: supabase.storage.from("person-photos").getPublicUrl(p.photo_path!).data.publicUrl,
      }));

    if (withPhotos.length === 0) {
      toast.error("No person photos in database to compare against");
      setScanning(false);
      stopTimer();
      return;
    }

    setProgress(20);
    setStatusText(`Matching against ${withPhotos.length} photos…`);

    try {
      const { data, error } = await supabase.functions.invoke("face-match", {
        body: { capturedImage: captured, personPhotos: withPhotos },
      });

      stopTimer();

      if (error) {
        toast.error("Scan failed: " + error.message);
        setScanning(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setScanning(false);
        return;
      }

      setProgress(95);
      setStatusText("Processing results…");

      const matchedIds: string[] = data?.matchedIds || [];
      const stats = data?.stats;

      if (matchedIds.length === 0) {
        toast.info("No matching persons found");
      } else {
        const statsMsg = stats
          ? ` (scanned ${stats.totalPhotos}, ${stats.pass1Candidates} candidates, ${stats.finalMatches} confirmed)`
          : "";
        toast.success(`Found ${matchedIds.length} match(es)${statsMsg}`);
      }

      const matched = allPersons.filter((p) => matchedIds.includes(p.id));
      onMatchResults(matched);
      setProgress(100);
      onOpenChange(false);
    } catch (e: any) {
      stopTimer();
      toast.error("Scan error: " + (e?.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Camera Scan Search
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {!captured ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-64 rounded-lg bg-muted object-cover"
              />
              <div className="flex gap-2">
                <Button onClick={capture}>
                  <Camera className="mr-1 h-4 w-4" /> Capture
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" /> Upload Photo
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </>
          ) : (
            <>
              <img src={captured} alt="Captured" className="w-full max-h-64 rounded-lg object-cover" />
              {scanning && (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{statusText}</span>
                    <span className="font-mono">{formatTime(elapsed)}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={retake} disabled={scanning}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Retake
                </Button>
                <Button onClick={scan} disabled={scanning}>
                  {scanning ? "Scanning…" : "Scan & Match"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraScanDialog;
