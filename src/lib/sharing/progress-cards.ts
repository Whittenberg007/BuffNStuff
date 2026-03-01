import { isNative } from "@/lib/capacitor/platform";

/** Capture a DOM element to PNG and share (native) or download (web) it. */
export async function captureAndShare(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { snapdom } = await import("@zumer/snapdom");

  // snapdom.toBlob() is a shortcut that captures + exports in one call.
  // Passing type: "png" ensures we get a PNG blob directly.
  const blob: Blob = await snapdom.toBlob(element, { type: "png" });

  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    // Convert blob to base64 for Capacitor Filesystem
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "BuffNStuff Progress",
      url: result.uri,
    });
  } else {
    // Web: trigger a file download via an ephemeral anchor element
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
