import { isNative } from "./platform";

export interface PhotoResult {
  dataUrl: string;
  format: string;
}

export async function takePhoto(): Promise<PhotoResult | null> {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      width: 1080,
      height: 1080,
    });

    if (!photo.dataUrl) return null;

    return {
      dataUrl: photo.dataUrl,
      format: photo.format,
    };
  } catch {
    // User cancelled or permission denied
    return null;
  }
}

export async function pickFromGallery(): Promise<PhotoResult | null> {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      width: 1080,
      height: 1080,
    });

    if (!photo.dataUrl) return null;

    return {
      dataUrl: photo.dataUrl,
      format: photo.format,
    };
  } catch {
    return null;
  }
}
