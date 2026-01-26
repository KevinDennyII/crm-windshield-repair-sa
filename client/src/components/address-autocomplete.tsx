import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    fullAddress: string;
  }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

interface Prediction {
  place_id: string;
  description: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Start typing an address...",
  className,
  disabled,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch("/api/places/status");
        if (response.ok) {
          const data = await response.json();
          setIsConfigured(data.configured);
        }
      } catch {
        setIsConfigured(false);
      }
    }
    checkStatus();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchPredictions(input: string) {
    if (input.length < 3 || isConfigured === false) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      if (response.ok) {
        const data = await response.json();
        setPredictions(data.predictions || []);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error("Failed to fetch address predictions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  }

  async function handleSelectPrediction(prediction: Prediction) {
    setShowDropdown(false);
    
    try {
      const response = await fetch(`/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`);
      if (response.ok) {
        const data = await response.json();
        onChange(data.street || prediction.description);
        
        if (onAddressSelect) {
          onAddressSelect({
            street: data.street || "",
            city: data.city || "",
            state: data.state || "",
            zip: data.zip || "",
            fullAddress: prediction.description,
          });
        }
      } else {
        onChange(prediction.description);
      }
    } catch (error) {
      console.error("Failed to fetch place details:", error);
      onChange(prediction.description);
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        data-testid={testId}
      />
      
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover-elevate",
                "focus:outline-none focus:bg-accent"
              )}
              onClick={() => handleSelectPrediction(prediction)}
              data-testid={`address-prediction-${prediction.place_id}`}
            >
              {prediction.description}
            </button>
          ))}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
