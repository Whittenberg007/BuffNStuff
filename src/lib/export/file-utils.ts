import { isNative } from "@/lib/capacitor/platform";

/** Download a file on web, or write + share on native */
export async function downloadOrShare(options: {
  filename: string;
  data: string;
  mimeType: string;
}): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const result = await Filesystem.writeFile({
      path: options.filename,
      data: btoa(unescape(encodeURIComponent(options.data))),
      directory: Directory.Cache,
    });

    await Share.share({
      title: options.filename,
      url: result.uri,
    });
  } else {
    const blob = new Blob([options.data], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

/** Share a Blob (used for PDF and images) */
export async function downloadOrShareBlob(options: {
  filename: string;
  blob: Blob;
}): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const arrayBuffer = await options.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const result = await Filesystem.writeFile({
      path: options.filename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: options.filename,
      url: result.uri,
    });
  } else {
    const url = URL.createObjectURL(options.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
