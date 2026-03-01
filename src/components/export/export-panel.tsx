"use client";

import { useState } from "react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { FileSpreadsheet, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportCSV, type ExportDataType } from "@/lib/export/csv-export";
import { exportJSON } from "@/lib/export/json-export";
import { PDFDownloadButton } from "./pdf-preview";
import { toast } from "sonner";

type ExportFormat = "csv" | "json" | "pdf";
type DatePreset = "this_week" | "last_7" | "this_month" | "last_30" | "custom";

const DATA_TYPES: { value: ExportDataType; label: string }[] = [
  { value: "workouts", label: "Workouts" },
  { value: "nutrition", label: "Nutrition" },
  { value: "weight", label: "Weight" },
  { value: "fasting", label: "Fasting Log" },
  { value: "goals", label: "Goals" },
];

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  switch (preset) {
    case "this_week":
      return { start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"), end: today };
    case "last_7":
      return { start: format(subDays(new Date(), 6), "yyyy-MM-dd"), end: today };
    case "this_month":
      return { start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: today };
    case "last_30":
      return { start: format(subDays(new Date(), 29), "yyyy-MM-dd"), end: today };
    default:
      return { start: today, end: today };
  }
}

export function ExportPanel() {
  const [dataType, setDataType] = useState<ExportDataType>("workouts");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { start, end } =
    datePreset === "custom"
      ? { start: customStart, end: customEnd }
      : getDateRange(datePreset);

  async function handleExport() {
    if (!start || !end) {
      toast.error("Please select a date range");
      return;
    }
    setIsExporting(true);
    try {
      if (exportFormat === "csv") {
        await exportCSV(dataType, start, end);
        toast.success("CSV exported!");
      } else if (exportFormat === "json") {
        await exportJSON(dataType, start, end);
        toast.success("JSON exported!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Data</CardTitle>
        <CardDescription>Download your fitness data in CSV, JSON, or PDF format</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={dataType} onValueChange={(v) => setDataType(v as ExportDataType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="pdf">PDF Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_7">Last 7 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {datePreset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        {exportFormat === "pdf" ? (
          <PDFDownloadButton startDate={start} endDate={end} />
        ) : (
          <Button onClick={handleExport} disabled={isExporting} className="w-full gap-2">
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : exportFormat === "csv" ? (
              <FileSpreadsheet className="size-4" />
            ) : (
              <FileJson className="size-4" />
            )}
            {isExporting ? "Exporting..." : `Export ${exportFormat.toUpperCase()}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
