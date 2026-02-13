import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

const SA_CENTER = { lat: 29.4241, lng: -98.4936 };

const LOOP_1604_COORDS = [
  { lat: 29.608, lng: -98.502 },
  { lat: 29.605, lng: -98.540 },
  { lat: 29.600, lng: -98.580 },
  { lat: 29.597, lng: -98.620 },
  { lat: 29.593, lng: -98.664 },
  { lat: 29.560, lng: -98.690 },
  { lat: 29.520, lng: -98.710 },
  { lat: 29.480, lng: -98.720 },
  { lat: 29.435, lng: -98.718 },
  { lat: 29.400, lng: -98.710 },
  { lat: 29.360, lng: -98.695 },
  { lat: 29.320, lng: -98.675 },
  { lat: 29.290, lng: -98.655 },
  { lat: 29.256, lng: -98.636 },
  { lat: 29.245, lng: -98.590 },
  { lat: 29.235, lng: -98.540 },
  { lat: 29.231, lng: -98.484 },
  { lat: 29.245, lng: -98.440 },
  { lat: 29.265, lng: -98.400 },
  { lat: 29.290, lng: -98.360 },
  { lat: 29.317, lng: -98.318 },
  { lat: 29.360, lng: -98.295 },
  { lat: 29.400, lng: -98.280 },
  { lat: 29.440, lng: -98.275 },
  { lat: 29.497, lng: -98.274 },
  { lat: 29.520, lng: -98.290 },
  { lat: 29.540, lng: -98.310 },
  { lat: 29.559, lng: -98.341 },
  { lat: 29.575, lng: -98.370 },
  { lat: 29.590, lng: -98.410 },
  { lat: 29.600, lng: -98.450 },
  { lat: 29.608, lng: -98.502 },
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
