'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  title: string;
  subtitle: string;
}

export function CameraCapture({ open, onClose, onCapture, title, subtitle }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: title.includes('面') ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch {
      // Camera not available, use file upload
      fileInputRef.current?.click();
    }
  }, [title]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(dataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    setPreview(null);
    onClose();
  }, [stopCamera, onClose]);

  const handleConfirm = useCallback(() => {
    if (preview) {
      onCapture(preview);
      handleClose();
    }
  }, [preview, onCapture, handleClose]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      handleClose();
    }
  }, [handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-[#1a1a2e] border-gold/20 text-foreground">
        <DialogTitle className="text-gold font-serif text-xl">{title}</DialogTitle>
        <p className="text-muted-foreground text-sm">{subtitle}</p>

        <div className="relative w-full aspect-[4/3] bg-ink rounded-lg overflow-hidden flex items-center justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="预览" className="w-full h-full object-cover" />
          ) : streaming ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-8">
              <div className="text-5xl mb-4">📷</div>
              <p className="text-muted-foreground mb-4">点击下方按钮开启相机拍照，或从相册选择照片</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="flex gap-3 justify-center">
          {!streaming && !preview && (
            <>
              <Button
                onClick={startCamera}
                className="bg-gold text-ink hover:bg-gold/90 font-semibold"
              >
                📷 开启相机
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-gold/30 text-gold hover:bg-gold/10"
              >
                🖼 从相册选择
              </Button>
            </>
          )}
          {streaming && !preview && (
            <Button
              onClick={capturePhoto}
              className="bg-gold text-ink hover:bg-gold/90 font-semibold camera-btn-pulse"
              size="lg"
            >
              ✨ 拍照
            </Button>
          )}
          {preview && (
            <>
              <Button
                onClick={() => { setPreview(null); startCamera(); }}
                variant="outline"
                className="border-gold/30 text-gold hover:bg-gold/10"
              >
                🔄 重拍
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-gold text-ink hover:bg-gold/90 font-semibold"
              >
                ✨ 开始解读
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
