"use client";

import { useState } from "react";
import { ScanBarcode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNative } from "@/lib/capacitor/platform";
import { lookupBarcode, type FoodProduct } from "@/lib/nutrition/food-search";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onProductFound: (product: FoodProduct) => void;
}

export function BarcodeScanner({ onProductFound }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  if (!isNative()) return null;

  async function handleScan() {
    setIsScanning(true);
    try {
      const {
        CapacitorBarcodeScanner,
        CapacitorBarcodeScannerTypeHint,
      } = await import("@capacitor/barcode-scanner");

      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
      });

      if (!result.ScanResult) {
        return;
      }

      const product = await lookupBarcode(result.ScanResult);
      if (product) {
        onProductFound(product);
        toast.success(`Found: ${product.name}`);
      } else {
        toast.error("Product not found — enter manually");
      }
    } catch {
      toast.error("Scan failed — try again");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleScan}
      disabled={isScanning}
      aria-label="Scan barcode"
    >
      {isScanning ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ScanBarcode className="size-4" />
      )}
    </Button>
  );
}
