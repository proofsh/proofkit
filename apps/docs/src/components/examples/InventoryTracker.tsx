"use client";

import { AlertTriangle, Boxes, Check, Minus, PackageCheck, Plus, Search, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inventoryItems = [
  {
    id: "sensor",
    name: "IoT Sensor Kit",
    sku: "PK-SEN-104",
    category: "Hardware",
    bin: "A-12",
    stock: 18,
    reorderAt: 24,
    incoming: 40,
    cost: "$42",
  },
  {
    id: "badge",
    name: "Access Badge",
    sku: "PK-BDG-220",
    category: "Hardware",
    bin: "B-04",
    stock: 86,
    reorderAt: 30,
    incoming: 0,
    cost: "$7",
  },
  {
    id: "cable",
    name: "USB-C Cable",
    sku: "PK-CBL-018",
    category: "Supplies",
    bin: "C-17",
    stock: 12,
    reorderAt: 50,
    incoming: 80,
    cost: "$4",
  },
  {
    id: "tablet",
    name: "Field Tablet",
    sku: "PK-TAB-510",
    category: "Equipment",
    bin: "A-03",
    stock: 9,
    reorderAt: 8,
    incoming: 6,
    cost: "$320",
  },
] as const;

const categories = ["All", "Hardware", "Supplies", "Equipment"] as const;

type InventoryItem = (typeof inventoryItems)[number];
type EnrichedInventoryItem = Omit<InventoryItem, "stock"> & { stock: number };
type InventoryItemId = InventoryItem["id"];
type Category = (typeof categories)[number];

function requireInventoryItem(items: EnrichedInventoryItem[]): EnrichedInventoryItem {
  const item = items.at(0);
  if (!item) {
    throw new Error("Expected at least one inventory item");
  }
  return item;
}

interface InventoryTrackerProps {
  className?: string;
  interactive?: boolean;
}

export function InventoryTracker({ className, interactive = false }: InventoryTrackerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selectedItemId, setSelectedItemId] = useState<InventoryItemId>("sensor");
  const [stockById, setStockById] = useState<Record<InventoryItemId, number>>({
    sensor: 18,
    badge: 86,
    cable: 12,
    tablet: 9,
  });
  const [lastAdjustment, setLastAdjustment] = useState("No adjustment in this session");

  const enrichedItems = useMemo<EnrichedInventoryItem[]>(
    () => inventoryItems.map((item) => ({ ...item, stock: stockById[item.id] })),
    [stockById],
  );
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return enrichedItems.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesQuery =
        !normalizedQuery ||
        [item.name, item.sku, item.bin, item.category].some((value) => value.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [category, enrichedItems, query]);
  const selectedItem = enrichedItems.find((item) => item.id === selectedItemId) ?? requireInventoryItem(enrichedItems);
  const lowStockCount = enrichedItems.filter((item) => item.stock <= item.reorderAt).length;
  const totalUnits = enrichedItems.reduce((sum, item) => sum + item.stock, 0);

  const adjustStock = (delta: number) => {
    if (!interactive) {
      return;
    }

    setStockById((current) => {
      const nextStock = Math.max(0, current[selectedItem.id] + delta);
      return { ...current, [selectedItem.id]: nextStock };
    });
    setLastAdjustment(`${selectedItem.name} ${delta > 0 ? "+" : ""}${delta} units`);
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[1fr_310px] bg-background", className)}>
      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Inventory
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Inventory Tracker</h3>
            <p className="mt-1 text-muted-foreground text-sm">Monitor stock, reorder points, bins, and adjustments.</p>
          </div>
          <button
            className={cn(buttonVariants({ variant: "primary" }), "h-10 rounded-full px-5")}
            disabled={!interactive}
            type="button"
          >
            <Truck className="size-4" />
            Create reorder
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Metric label="Total units" value={String(totalUnits)} />
          <Metric label="Low stock" tone={lowStockCount > 0 ? "warning" : "default"} value={String(lowStockCount)} />
          <Metric label="Incoming" value="126" />
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-border border-b p-4">
            <div className="relative min-w-[340px]">
              <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-full border border-border bg-background pr-4 pl-11 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                disabled={!interactive}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search item, SKU, bin..."
                value={query}
              />
            </div>
            <div className="flex gap-2">
              {categories.map((itemCategory) => (
                <button
                  className={cn(
                    "rounded-full px-3 py-2 font-medium text-xs transition",
                    category === itemCategory
                      ? "bg-[#D15ABB] text-white"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                  disabled={!interactive}
                  key={itemCategory}
                  onClick={() => setCategory(itemCategory)}
                  type="button"
                >
                  {itemCategory}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.8fr] border-border border-b bg-muted/35 px-4 py-3 font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">
            <span>Item</span>
            <span>Bin</span>
            <span>Stock</span>
            <span>Reorder</span>
            <span>Status</span>
          </div>
          {filteredItems.map((item) => (
            <button
              className={cn(
                "grid w-full grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.8fr] items-center border-border border-b px-4 py-3 text-left text-sm transition last:border-b-0",
                interactive && "hover:bg-muted/35",
                selectedItem.id === item.id && "bg-[#D15ABB]/5",
              )}
              disabled={!interactive}
              key={item.id}
              onClick={() => setSelectedItemId(item.id)}
              type="button"
            >
              <span>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-muted-foreground text-xs">{item.sku}</span>
              </span>
              <span className="text-muted-foreground">{item.bin}</span>
              <span className="font-semibold">{item.stock}</span>
              <span className="text-muted-foreground">{item.reorderAt}</span>
              <StockBadge item={item} />
            </button>
          ))}
        </div>
      </section>

      <aside className="border-border border-l bg-muted/35 p-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#D15ABB]/10 text-[#8b1f6a]">
              <Boxes className="size-5" />
            </div>
            <div>
              <h4 className="font-semibold">{selectedItem.name}</h4>
              <p className="text-muted-foreground text-xs">{selectedItem.sku}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-end justify-between">
              <span className="text-muted-foreground text-sm">Available stock</span>
              <span className="font-bold text-4xl">{selectedItem.stock}</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  selectedItem.stock <= selectedItem.reorderAt ? "bg-amber-500" : "bg-[#D15ABB]",
                )}
                style={{
                  width: `${Math.min((selectedItem.stock / Math.max(selectedItem.reorderAt * 2, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              aria-label="Decrease stock"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
              disabled={!interactive}
              onClick={() => adjustStock(-1)}
              type="button"
            >
              <Minus className="size-4" />
            </button>
            <button
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-3")}
              disabled={!interactive}
              onClick={() => adjustStock(10)}
              type="button"
            >
              +10
            </button>
            <button
              aria-label="Increase stock"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
              disabled={!interactive}
              onClick={() => adjustStock(1)}
              type="button"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <DetailRow label="Category" value={selectedItem.category} />
            <DetailRow label="Bin" value={selectedItem.bin} />
            <DetailRow label="Incoming" value={`${selectedItem.incoming} units`} />
            <DetailRow label="Unit cost" value={selectedItem.cost} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <PackageCheck className="size-4 text-[#8b1f6a]" />
            Adjustment log
          </div>
          <p className="mt-3 text-muted-foreground text-sm leading-6">{lastAdjustment}</p>
          {selectedItem.stock <= selectedItem.reorderAt && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Below reorder point. Add this item to the next purchase order.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, tone = "default", value }: { label: string; tone?: "default" | "warning"; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className={cn("mt-3 font-bold text-2xl", tone === "warning" && "text-amber-600")}>{value}</div>
    </div>
  );
}

function StockBadge({ item }: { item: EnrichedInventoryItem }) {
  if (item.stock <= item.reorderAt) {
    return (
      <Badge appearance="outline" size="sm" variant="warning">
        <AlertTriangle className="size-3" />
        Reorder
      </Badge>
    );
  }

  return (
    <Badge appearance="light" size="sm" variant="success">
      <Check className="size-3" />
      Stocked
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
