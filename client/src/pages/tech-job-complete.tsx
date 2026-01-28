import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  X,
  Loader2,
  Upload,
  Camera,
  Image as ImageIcon,
  Video
} from "lucide-react";
import type { Job } from "@shared/schema";

export default function TechJobComplete() {
  const [, params] = useRoute("/tech/job/:id/complete");
  const jobId = params?.id;
  
  const [photos, setPhotos] = useState<{ [key: string]: string }>({
    preInspection: "",
    vin: "",
    partInstalled: "",
    after: ""
  });
  const [showMediaPicker, setShowMediaPicker] = useState<string | null>(null);
  const [otherImages, setOtherImages] = useState<string[]>([]);
  const [otherVideos, setOtherVideos] = useState<string[]>([]);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const job = jobs.find(j => j.id === jobId);

  const handlePhotoCapture = (slot: string, useCamera: boolean = true) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    if (useCamera) {
      input.capture = "environment";
    }
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prev => ({
            ...prev,
            [slot]: reader.result as string
          }));
          setShowMediaPicker(null);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleOtherImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setOtherImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  };

  const handleVideoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setOtherVideos(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  };

  const clearPhoto = (slot: string) => {
    setPhotos(prev => ({
      ...prev,
      [slot]: ""
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#29ABE2" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-white">
        <header 
          className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: "#29ABE2" }}
        >
          <Link href="/tech">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-white">Job Not Found</h1>
        </header>
      </div>
    );
  }

  const requiredPhotos = [
    { key: "preInspection", label: "Pre-Inspection\n(Image)" },
    { key: "vin", label: "VIN Number\n(Image)" },
    { key: "partInstalled", label: "Part Installed\n(Image)" },
    { key: "after", label: "After Installation\n(Image)" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header 
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: "#29ABE2" }}
      >
        <Link href={`/tech/job/${job.id}`}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold text-white flex-1 text-center pr-8">
          Attachments
        </h1>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="flex justify-center mb-4">
          <span 
            className="px-6 py-2 rounded-full text-white font-semibold"
            style={{ backgroundColor: "#DC2626" }}
          >
            Required Media
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {requiredPhotos.map(slot => (
            <div key={slot.key} className="relative">
              {photos[slot.key] ? (
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
                  <img 
                    src={photos[slot.key]} 
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 px-3">
                    <span className="text-white text-sm whitespace-pre-line">{slot.label}</span>
                  </div>
                  <button
                    onClick={() => clearPhoto(slot.key)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: "#DC2626" }}
                    data-testid={`button-clear-photo-${slot.key}`}
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : showMediaPicker === slot.key ? (
                <div className="w-full aspect-[4/3] bg-white rounded-lg border-2 border-blue-400 flex flex-col items-stretch justify-center gap-2 p-2">
                  <button
                    onClick={() => handlePhotoCapture(slot.key, true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    data-testid={`button-camera-${slot.key}`}
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-sm font-medium">Take Photo</span>
                  </button>
                  <button
                    onClick={() => handlePhotoCapture(slot.key, false)}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    data-testid={`button-gallery-${slot.key}`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Choose from Gallery</span>
                  </button>
                  <button
                    onClick={() => setShowMediaPicker(null)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    data-testid={`button-cancel-${slot.key}`}
                  >
                    <X className="w-5 h-5" />
                    <span className="text-sm font-medium">Cancel</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowMediaPicker(slot.key)}
                  className="w-full aspect-[4/3] bg-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-400 hover:bg-gray-300 transition-colors"
                  data-testid={`button-capture-${slot.key}`}
                >
                  <Upload className="w-8 h-8 text-gray-500" />
                  <span className="text-sm text-gray-600 text-center whitespace-pre-line">{slot.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center mb-4">
          <span 
            className="px-6 py-2 rounded-full text-white font-semibold"
            style={{ backgroundColor: "#29ABE2" }}
          >
            Optional Media
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Other images (Optional)</span>
              {otherImages.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {otherImages.length}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleOtherImageUpload}
              style={{ backgroundColor: "#29ABE2" }}
              data-testid="button-upload-other-images"
            >
              Upload
            </Button>
          </div>
          
          {otherImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pb-3">
              {otherImages.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded overflow-hidden">
                  <img src={img} alt={`Other ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setOtherImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                    data-testid={`button-remove-other-image-${idx}`}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700">Other Video (Optional)</span>
              {otherVideos.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {otherVideos.length}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleVideoUpload}
              style={{ backgroundColor: "#29ABE2" }}
              data-testid="button-upload-video"
            >
              Upload
            </Button>
          </div>
          
          {otherVideos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pb-3">
              {otherVideos.map((vid, idx) => (
                <div key={idx} className="relative aspect-video rounded overflow-hidden bg-black">
                  <video src={vid} className="w-full h-full object-contain" controls />
                  <button
                    onClick={() => setOtherVideos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                    data-testid={`button-remove-video-${idx}`}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
