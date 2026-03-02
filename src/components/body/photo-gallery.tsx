"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhotoUrl, deleteProgressPhoto } from "@/lib/database/photos";
import type { ProgressPhoto, PhotoPose } from "@/types";

interface PhotoGalleryProps {
  photos: ProgressPhoto[];
  onDeleted: () => void;
}

interface PhotoWithUrl extends ProgressPhoto {
  url: string | null;
}

const POSE_ORDER: PhotoPose[] = ["front", "side", "back"];

export function PhotoGallery({ photos, onDeleted }: PhotoGalleryProps) {
  const [photosWithUrls, setPhotosWithUrls] = useState<PhotoWithUrl[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function loadUrls() {
      const withUrls = await Promise.all(
        photos.map(async (p) => ({
          ...p,
          url: await getPhotoUrl(p.storage_path),
        }))
      );
      setPhotosWithUrls(withUrls);
    }
    loadUrls();
  }, [photos]);

  // Group by date
  const grouped = new Map<string, PhotoWithUrl[]>();
  for (const p of photosWithUrls) {
    const existing = grouped.get(p.date) || [];
    existing.push(p);
    grouped.set(p.date, existing);
  }

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteProgressPhoto(id);
      onDeleted();
    } catch {
      // Silently handle
    } finally {
      setDeleting(null);
    }
  }

  if (photos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4" />
            Photo Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No progress photos yet. Capture your first photo above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4" />
          Photo Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedDates.map((date) => {
          const datePhotos = grouped.get(date)!;
          const sorted = POSE_ORDER.map((pose) =>
            datePhotos.find((p) => p.pose === pose)
          ).filter(Boolean) as PhotoWithUrl[];

          return (
            <div key={date}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {sorted.map((photo) => (
                  <div key={photo.id} className="relative group">
                    {photo.url ? (
                      <button
                        onClick={() =>
                          setExpanded(expanded === photo.id ? null : photo.id)
                        }
                        className="w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`${photo.pose} - ${photo.date}`}
                          className="w-full aspect-[3/4] object-cover rounded-md bg-zinc-900"
                        />
                      </button>
                    ) : (
                      <div className="w-full aspect-[3/4] rounded-md bg-zinc-900 flex items-center justify-center">
                        <ImageIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1 rounded capitalize">
                      {photo.pose}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDelete(photo.id)}
                      disabled={deleting === photo.id}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    >
                      <Trash2 className="size-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Expanded view */}
              {sorted.some((p) => expanded === p.id) && (
                <div className="mt-2">
                  {sorted
                    .filter((p) => p.id === expanded)
                    .map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photo.id}
                        src={photo.url!}
                        alt={`${photo.pose} - ${photo.date}`}
                        className="w-full max-h-96 object-contain rounded-md bg-zinc-900"
                      />
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
