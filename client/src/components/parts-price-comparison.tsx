import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink,
  DollarSign,
  Save,
  ChevronDown,
  ChevronRight,
  History,
  Clock,
  Loader2,
} from "lucide-react";

interface SupplierConfig {
  id: string;
  name: string;
  color: string;
  searchUrl: (partNumber: string, vehicleInfo?: string) => string;
}

const SUPPLIERS: SupplierConfig[] = [
  {
    id: "mygrant",
    name: "Mygrant",
    color: "bg-blue-600 dark:bg-blue-700",
    searchUrl: () => "https://www.mygrantglass.com",
  },
  {
    id: "pgw",
    name: "PGW",
    color: "bg-emerald-600 dark:bg-emerald-700",
    searchUrl: () => "https://www.pgwautoglass.com",
  },
  {
    id: "igc",
    name: "IGC",
    color: "bg-amber-600 dark:bg-amber-700",
    searchUrl: () => "https://www.igcglass.com",
  },
  {
    id: "pilkington",
    name: "Pilkington",
    color: "bg-red-600 dark:bg-red-700",
    searchUrl: () => "https://www.pilkington.com/en-us/us",
  },
];

interface PriceEntry {
  supplier: string;
  price: string;
}

interface PartsPriceComparisonProps {
  nagsPartNumber: string;
  partDescription?: string;
  vehicleInfo?: string;
  jobId?: string;
  onSelectPrice?: (supplier: string, price: number) => void;
}

export function PartsPriceComparison({
  nagsPartNumber,
  partDescription,
  vehicleInfo,
  jobId,
  onSelectPrice,
}: PartsPriceComparisonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const { data: latestPrices, isLoading: loadingLatest } = useQuery({
    queryKey: ["/api/parts-prices/latest", nagsPartNumber],
    queryFn: async () => {
      if (!nagsPartNumber) return {};
      const res = await fetch(`/api/parts-prices/latest/${encodeURIComponent(nagsPartNumber)}`);
      if (!res.ok) throw new Error("Failed to fetch latest prices");
      return res.json();
    },
    enabled: !!nagsPartNumber && isOpen,
  });

  const { data: priceHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["/api/parts-prices", nagsPartNumber],
    queryFn: async () => {
      if (!nagsPartNumber) return [];
      const res = await fetch(`/api/parts-prices/${encodeURIComponent(nagsPartNumber)}`);
      if (!res.ok) throw new Error("Failed to fetch price history");
      return res.json();
    },
    enabled: !!nagsPartNumber && showHistory,
  });

  const savePriceMutation = useMutation({
    mutationFn: async (entry: PriceEntry) => {
      return apiRequest("POST", "/api/parts-prices", {
        nagsPartNumber,
        partDescription,
        vehicleInfo,
        supplier: entry.supplier,
        price: entry.price,
        jobId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-prices/latest", nagsPartNumber] });
      queryClient.invalidateQueries({ queryKey: ["/api/parts-prices", nagsPartNumber] });
      toast({ title: "Price Saved", description: "Price has been saved to history" });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save price",
        variant: "destructive",
      });
    },
  });

  const handleSavePrice = (supplierId: string) => {
    const price = prices[supplierId];
    if (!price || isNaN(parseFloat(price))) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }
    savePriceMutation.mutate({ supplier: supplierId, price });
  };

  const handleSaveAllPrices = () => {
    const entriesToSave = Object.entries(prices).filter(
      ([_, val]) => val && !isNaN(parseFloat(val))
    );
    if (entriesToSave.length === 0) {
      toast({
        title: "No Prices",
        description: "Enter at least one price to save",
        variant: "destructive",
      });
      return;
    }
    entriesToSave.forEach(([supplier, price]) => {
      savePriceMutation.mutate({ supplier, price });
    });
  };

  const handleUsePrice = (supplierId: string, price: number) => {
    if (onSelectPrice) {
      onSelectPrice(supplierId, price);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const lowestPrice = useCallback(() => {
    const allPrices: { supplier: string; price: number }[] = [];
    SUPPLIERS.forEach((s) => {
      const current = prices[s.id] ? parseFloat(prices[s.id]) : null;
      const latest = latestPrices?.[s.id]?.price ? parseFloat(latestPrices[s.id].price) : null;
      const priceVal = current || latest;
      if (priceVal && !isNaN(priceVal)) {
        allPrices.push({ supplier: s.id, price: priceVal });
      }
    });
    if (allPrices.length === 0) return null;
    return allPrices.reduce((min, p) => (p.price < min.price ? p : min));
  }, [prices, latestPrices]);

  if (!nagsPartNumber) {
    return (
      <div className="text-sm text-muted-foreground italic p-2" data-testid="text-no-part-number">
        Enter a NAGS part number to compare prices
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sm font-medium"
          data-testid={`button-toggle-price-compare-${nagsPartNumber}`}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <DollarSign className="h-4 w-4" />
          Price Comparison
          {latestPrices && Object.keys(latestPrices).length > 0 && (
            <Badge variant="secondary">
              {Object.keys(latestPrices).length} saved
            </Badge>
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 pt-2 pl-2 pr-2 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Quick Launch:</span>
            {SUPPLIERS.map((supplier) => (
              <Button
                key={supplier.id}
                type="button"
                size="sm"
                className={`${supplier.color} text-white border-0`}
                onClick={() =>
                  window.open(supplier.searchUrl(nagsPartNumber, vehicleInfo), "_blank")
                }
                data-testid={`button-launch-${supplier.id}-${nagsPartNumber}`}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {supplier.name}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUPPLIERS.map((supplier) => {
              const lastKnown = latestPrices?.[supplier.id];
              const best = lowestPrice();
              const currentVal = prices[supplier.id]
                ? parseFloat(prices[supplier.id])
                : lastKnown?.price
                ? parseFloat(lastKnown.price)
                : null;
              const isBest =
                best && currentVal !== null && currentVal === best.price && best.supplier === supplier.id;

              return (
                <div key={supplier.id} className="space-y-1">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    {supplier.name}
                    {isBest && (
                      <Badge variant="default" className="text-[10px] px-1 py-0">
                        Best
                      </Badge>
                    )}
                  </Label>
                  <div className="flex gap-1">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={lastKnown ? lastKnown.price : "0.00"}
                        value={prices[supplier.id] || ""}
                        onChange={(e) =>
                          setPrices((prev) => ({ ...prev, [supplier.id]: e.target.value }))
                        }
                        className="pl-5 text-sm"
                        data-testid={`input-price-${supplier.id}-${nagsPartNumber}`}
                      />
                    </div>
                    {prices[supplier.id] && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleSavePrice(supplier.id)}
                        disabled={savePriceMutation.isPending}
                        data-testid={`button-save-price-${supplier.id}-${nagsPartNumber}`}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {lastKnown && !prices[supplier.id] && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        ${lastKnown.price} on {formatDate(lastKnown.createdAt)}
                      </span>
                    </div>
                  )}
                  {lastKnown && onSelectPrice && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs w-full"
                      onClick={() => handleUsePrice(supplier.id, parseFloat(lastKnown.price))}
                      data-testid={`button-use-price-${supplier.id}-${nagsPartNumber}`}
                    >
                      Use this price
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {Object.values(prices).some((v) => v) && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveAllPrices}
                disabled={savePriceMutation.isPending}
                data-testid={`button-save-all-prices-${nagsPartNumber}`}
              >
                {savePriceMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save All Prices
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              data-testid={`button-toggle-history-${nagsPartNumber}`}
            >
              <History className="h-3 w-3 mr-1" />
              {showHistory ? "Hide" : "Show"} History
            </Button>
          </div>

          {showHistory && (
            <div className="border rounded-md overflow-hidden">
              {loadingHistory ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  Loading history...
                </div>
              ) : priceHistory && priceHistory.length > 0 ? (
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">Supplier</th>
                        <th className="text-right p-2 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((entry: any, i: number) => (
                        <tr key={entry.id || i} className="border-t">
                          <td className="p-2 text-muted-foreground">
                            {formatDate(entry.createdAt)}
                          </td>
                          <td className="p-2 capitalize">{entry.supplier}</td>
                          <td className="p-2 text-right font-mono">${entry.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  No price history for this part
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
