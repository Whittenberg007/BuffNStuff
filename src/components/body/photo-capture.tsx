"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Camera, Upload, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadProgressPhoto } from "@/lib/database/photos";
import { isNative } from "@/lib/capacitor/platform";
import { takePhoto, pickFromGallery } from "@/lib/capacitor/camera";
import type { PhotoPose } from "@/types";

interface PhotoCaptureProps {
  onUploaded: () => void;
}

const POSES: { value: PhotoPose; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function PhotoCapture({ onUploaded }: PhotoCaptureProps) {
  const [pose, setPose] = useState<PhotoPose>("front");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_FILE_SIZE) {
      setError("File must be under 5MB");
      return;
    }

    setError(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleNativeCapture(source: "camera" | "gallery") {
    setError(null);
    const result = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (!result) return;
    setPreview(result.dataUrl);
    setFile(result.dataUrl);
  }

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      await uploadProgressPhoto(today, pose, file);
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-4" />
          Add Progress Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pose selector */}
        <div className="flex gap-1">
          {POSES.map((p) => (
            <Button
              key={p.value}
              variant={pose === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPose(p.value)}
              className="flex-1"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Preview */}
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={`${pose} preview`}
              className="w-full max-h-64 object-contain rounded-md bg-zinc-900"
            />
            <Button
              variant="ghost"
              size="xs"
              onClick={handleClear}
              className="absolute top-2 right-2 text-xs"
            >
              Clear
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 rounded-md border border-dashed border-border text-muted-foreground">
            <ImagePlus className="size-8 mb-2 opacity-50" />
            <p className="text-xs">Select or capture a photo</p>
          </div>
        )}

        {/* Capture/upload buttons */}
        {!preview && (
          <div className="flex gap-2">
            {isNative() ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNativeCapture("camera")}
                  className="flex-1"
                >
                  <Camera className="size-4 mr-1.5" />
                  Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNativeCapture("gallery")}
                  className="flex-1"
                >
                  <ImagePlus className="size-4 mr-1.5" />
                  Gallery
                </Button>
              </>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="size-4 mr-1.5" />
                  Choose Photo
                </Button>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Upload button */}
        {preview && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
            size="sm"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Upload className="size-4 mr-1.5" />
                Upload {pose} Photo
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
