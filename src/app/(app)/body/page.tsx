"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeasurementForm } from "@/components/body/measurement-form";
import { MeasurementSummary } from "@/components/body/measurement-summary";
import { MeasurementChart } from "@/components/body/measurement-chart";
import { PhotoCapture } from "@/components/body/photo-capture";
import { PhotoGallery } from "@/components/body/photo-gallery";
import { PhotoCompare } from "@/components/body/photo-compare";
import {
  getMeasurementHistory,
  getLatestMeasurement,
} from "@/lib/database/measurements";
import { getProgressPhotos } from "@/lib/database/photos";
import type { BodyMeasurement, ProgressPhoto } from "@/types";

export default function BodyPage() {
  const [measurementRange, setMeasurementRange] = useState(90);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latest, setLatest] = useState<BodyMeasurement | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMeasurements = useCallback(async () => {
    try {
      const [history, latestEntry] = await Promise.all([
        getMeasurementHistory(measurementRange),
        getLatestMeasurement(),
      ]);
      setMeasurements(history);
      setLatest(latestEntry);
    } catch {
      // Silently handle
    }
  }, [measurementRange]);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await getProgressPhotos(365);
      setPhotos(data);
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadMeasurements(), loadPhotos()]);
      setIsLoading(false);
    }
    init();
  }, [loadMeasurements, loadPhotos]);

  // Get previous measurement for delta calculation
  const previous = measurements.length >= 2 ? measurements[measurements.length - 2] : null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Body</h1>
        <p className="text-sm text-muted-foreground">
          Track measurements and progress photos.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="measurements">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>

          <TabsContent value="measurements" className="mt-4 space-y-6">
            <MeasurementSummary latest={latest} previous={previous} />
            <MeasurementForm latest={latest} onSaved={loadMeasurements} />
            <MeasurementChart
              data={measurements}
              selectedRange={measurementRange}
              onRangeChange={setMeasurementRange}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-4 space-y-6">
            <PhotoCapture onUploaded={loadPhotos} />
            <PhotoGallery photos={photos} onDeleted={loadPhotos} />
            <PhotoCompare photos={photos} measurements={measurements} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
