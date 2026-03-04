import { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, X, RotateCcw, Upload } from "lucide-react";
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

const CameraScanDialog = ({ open, onOpenChange, allPersons, onMatchResults }: CameraScanDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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

  useEffect(() => {
    if (open && !captured) startCamera();
    if (!open) {
      stopCamera();
      setCaptured(null);
      setScanning(false);
      setProgress(0);
    }
    return () => stopCamera();
  }, [open, captured, startCamera, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const maxDim = 400;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCaptured(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setCaptured(null);
    // camera will restart via useEffect
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setCaptured(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scan = async () => {
    if (!captured) return;
    setScanning(true);
    setProgress(10);

    // Collect persons with photos
    const withPhotos = allPersons
      .filter((p) => p.photo_path)
      .map((p) => ({
        id: p.id,
        photoUrl: supabase.storage.from("person-photos").getPublicUrl(p.photo_path!).data.publicUrl,
      }));

    if (withPhotos.length === 0) {
      toast.error("No person photos in database to compare against");
      setScanning(false);
      return;
    }

    setProgress(30);

    try {
      const { data, error } = await supabase.functions.invoke("face-match", {
        body: { capturedImage: captured, personPhotos: withPhotos },
      });

      setProgress(90);

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

      const matchedIds: string[] = data?.matchedIds || [];
      if (matchedIds.length === 0) {
        toast.info("No matching persons found");
      } else {
        toast.success(`Found ${matchedIds.length} match(es)`);
      }

      const matched = allPersons.filter((p) => matchedIds.includes(p.id));
      onMatchResults(matched);
      setProgress(100);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Scan error: " + (e?.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  };

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
              <Button onClick={capture}>
                <Camera className="mr-1 h-4 w-4" /> Capture
              </Button>
            </>
          ) : (
            <>
              <img src={captured} alt="Captured" className="w-full max-h-64 rounded-lg object-cover" />
              {scanning && (
                <div className="w-full space-y-1">
                  <p className="text-sm text-muted-foreground text-center">Scanning faces…</p>
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
