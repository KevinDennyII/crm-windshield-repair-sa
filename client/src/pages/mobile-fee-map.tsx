import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

const SA_CENTER = { lat: 29.4241, lng: -98.4936 };

const LOOP_1604_COORDS = [
  { lat: 29.4832502, lng: -98.7089665 },
  { lat: 29.4458855, lng: -98.7113697 },
  { lat: 29.4231611, lng: -98.7099965 },
  { lat: 29.4085071, lng: -98.7093098 },
  { lat: 29.3971413, lng: -98.7024434 },
  { lat: 29.3818853, lng: -98.7007267 },
  { lat: 29.3579496, lng: -98.6911137 },
  { lat: 29.3414905, lng: -98.6918003 },
  { lat: 29.3268248, lng: -98.6859639 },
  { lat: 29.3103607, lng: -98.6763508 },
  { lat: 29.2932952, lng: -98.6677678 },
  { lat: 29.2801198, lng: -98.6667378 },
  { lat: 29.2582569, lng: -98.6660511 },
  { lat: 29.2507685, lng: -98.6629612 },
  { lat: 29.2414822, lng: -98.6629612 },
  { lat: 29.2354906, lng: -98.6609013 },
  { lat: 29.2297982, lng: -98.6492283 },
  { lat: 29.2262029, lng: -98.638242 },
  { lat: 29.2265025, lng: -98.6227925 },
  { lat: 29.230697, lng: -98.6114628 },
  { lat: 29.2324946, lng: -98.5942967 },
  { lat: 29.2339926, lng: -98.5651143 },
  { lat: 29.2297982, lng: -98.5630543 },
  { lat: 29.2235063, lng: -98.5565312 },
  { lat: 29.2172139, lng: -98.5455449 },
  { lat: 29.2148168, lng: -98.5276921 },
  { lat: 29.2130188, lng: -98.5088093 },
  { lat: 29.2142175, lng: -98.4981663 },
  { lat: 29.2202103, lng: -98.4830601 },
  { lat: 29.2202103, lng: -98.4696705 },
  { lat: 29.2208096, lng: -98.4415181 },
  { lat: 29.22051, lng: -98.4308751 },
  { lat: 29.2172139, lng: -98.4099324 },
  { lat: 29.2190118, lng: -98.3896763 },
  { lat: 29.2190118, lng: -98.3598072 },
  { lat: 29.2250044, lng: -98.3529408 },
  { lat: 29.2339926, lng: -98.3536274 },
  { lat: 29.2447775, lng: -98.3488209 },
  { lat: 29.2483721, lng: -98.334058 },
  { lat: 29.2516672, lng: -98.3282216 },
  { lat: 29.260054, lng: -98.3213551 },
  { lat: 29.2666432, lng: -98.3059056 },
  { lat: 29.298984, lng: -98.2743199 },
  { lat: 29.3031756, lng: -98.2612736 },
  { lat: 29.3109595, lng: -98.260587 },
  { lat: 29.3247295, lng: -98.2626469 },
  { lat: 29.3355048, lng: -98.2537205 },
  { lat: 29.3456804, lng: -98.2516606 },
  { lat: 29.3636348, lng: -98.2434208 },
  { lat: 29.3905605, lng: -98.239301 },
  { lat: 29.4138904, lng: -98.2530339 },
  { lat: 29.4491742, lng: -98.2853062 },
  { lat: 29.4802615, lng: -98.2976658 },
  { lat: 29.4874342, lng: -98.291486 },
  { lat: 29.513132, lng: -98.2873661 },
  { lat: 29.5364337, lng: -98.3017857 },
  { lat: 29.5483812, lng: -98.3182652 },
  { lat: 29.5662998, lng: -98.3313115 },
  { lat: 29.6027246, lng: -98.3608372 },
  { lat: 29.5997394, lng: -98.4301884 },
  { lat: 29.6086946, lng: -98.4617741 },
  { lat: 29.6098885, lng: -98.518079 },
  { lat: 29.6027246, lng: -98.5331852 },
  { lat: 29.6003364, lng: -98.5579045 },
  { lat: 29.5895893, lng: -98.5922367 },
  { lat: 29.5848124, lng: -98.6334355 },
  { lat: 29.5776467, lng: -98.6430485 },
  { lat: 29.5477839, lng: -98.6718876 },
  { lat: 29.4832502, lng: -98.7089665 },
];

const OUTER_ZONES = [
  { radius: 50, fee: "$50", color: "#EF4444", label: "Red Zone (50+ mi)", fillOpacity: 0.08 },
  { radius: 40, fee: "$35", color: "#EC4899", label: "Pink Zone (40-50 mi)", fillOpacity: 0.10 },
  { radius: 30, fee: "$25", color: "#8B5CF6", label: "Purple Zone (30-40 mi)", fillOpacity: 0.10 },
  { radius: 20, fee: "$20", color: "#3B82F6", label: "Blue Zone (20-30 mi)", fillOpacity: 0.10 },
  { radius: 15, fee: "$10", color: "#F59E0B", label: "Yellow Zone (15-20 mi)", fillOpacity: 0.12 },
];

const GREEN_ZONE = { fee: "$0", color: "#22C55E", label: "Inside 1604 (Loop)", fillOpacity: 0.12 };

const ALL_ZONES_FOR_LEGEND = [
  { fee: "$50", color: "#EF4444", label: "Red Zone (50+ mi)" },
  { fee: "$35", color: "#EC4899", label: "Pink Zone (40-50 mi)" },
  { fee: "$25", color: "#8B5CF6", label: "Purple Zone (30-40 mi)" },
  { fee: "$20", color: "#3B82F6", label: "Blue Zone (20-30 mi)" },
  { fee: "$10", color: "#F59E0B", label: "Yellow Zone (15-20 mi)" },
  { fee: "$0",  color: "#22C55E", label: "Inside 1604 (Loop)" },
];

const MILES_TO_METERS = 1609.34;

export default function MobileFeeMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config/maps-key")
      .then(r => r.json())
      .then(d => setApiKey(d.key || ""))
      .catch(() => setApiKey(""));
  }, []);

  useEffect(() => {
    if (!apiKey || mapLoaded) return;
    if ((window as any).google?.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, [apiKey]);

  function initMap() {
    if (!mapRef.current || mapLoaded) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      center: SA_CENTER,
      zoom: 9,
      mapTypeId: "roadmap",
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });

    for (const zone of OUTER_ZONES) {
      new google.maps.Circle({
        map,
        center: SA_CENTER,
        radius: zone.radius * MILES_TO_METERS,
        strokeColor: zone.color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: zone.color,
        fillOpacity: zone.fillOpacity,
      });
    }

    new google.maps.Polygon({
      map,
      paths: LOOP_1604_COORDS,
      strokeColor: GREEN_ZONE.color,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: GREEN_ZONE.color,
      fillOpacity: GREEN_ZONE.fillOpacity,
    });

    new google.maps.Marker({
      map,
      position: SA_CENTER,
      title: "Downtown San Antonio (Center Point)",
      label: { text: "HQ", color: "#ffffff", fontWeight: "bold" },
    });

    setMapLoaded(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <MapPin className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Mobile Fee Zone Map</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div
                ref={mapRef}
                className="w-full rounded-md"
                style={{ height: "600px" }}
                data-testid="map-container"
              />
              {!apiKey && (
                <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                  Loading map...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fee Zones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...ALL_ZONES_FOR_LEGEND].reverse().map((zone) => (
                <div
                  key={zone.label}
                  className="flex items-center justify-between gap-2 py-1.5"
                  data-testid={`zone-${zone.fee.replace('$', '')}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-sm border"
                      style={{ backgroundColor: zone.color, opacity: 0.7, borderColor: zone.color }}
                    />
                    <span className="text-sm">{zone.label}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {zone.fee}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reference Points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Alamo Heights</span><span>$0</span></div>
              <div className="flex justify-between"><span>Stone Oak (78248)</span><span>$0</span></div>
              <div className="flex justify-between"><span>Converse</span><span>$0</span></div>
              <div className="flex justify-between"><span>Schertz</span><span>$10</span></div>
              <div className="flex justify-between"><span>Boerne</span><span>$20</span></div>
              <div className="flex justify-between"><span>New Braunfels</span><span>$25</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
