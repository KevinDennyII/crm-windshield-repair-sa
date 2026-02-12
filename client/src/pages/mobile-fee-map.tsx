import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

const SA_CENTER = { lat: 29.4241, lng: -98.4936 };

const ZONES = [
  { radius: 50, fee: "$50", color: "#EF4444", label: "Red Zone (50+ mi)", fillOpacity: 0.08 },
  { radius: 40, fee: "$35", color: "#EC4899", label: "Pink Zone (40-50 mi)", fillOpacity: 0.10 },
  { radius: 30, fee: "$25", color: "#8B5CF6", label: "Purple Zone (30-40 mi)", fillOpacity: 0.10 },
  { radius: 20, fee: "$20", color: "#3B82F6", label: "Blue Zone (20-30 mi)", fillOpacity: 0.10 },
  { radius: 15, fee: "$10", color: "#F59E0B", label: "Yellow Zone (15-20 mi)", fillOpacity: 0.12 },
  { radius: 0,  fee: "$0",  color: "#22C55E", label: "Inside 1604 (0-15 mi)", fillOpacity: 0.12 },
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

    const zoneCircles = ZONES.filter(z => z.radius > 0);
    for (const zone of zoneCircles) {
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

    const innerCircle = new google.maps.Circle({
      map,
      center: SA_CENTER,
      radius: 15 * MILES_TO_METERS,
      strokeColor: "#22C55E",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: "#22C55E",
      fillOpacity: 0.08,
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
              {[...ZONES].reverse().map((zone) => (
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
