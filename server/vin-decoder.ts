interface NHTSAResult {
  Variable: string;
  Value: string | null;
  ValueId: string | null;
}

interface NHTSAResponse {
  Count: number;
  Message: string;
  SearchCriteria: string;
  Results: NHTSAResult[];
}

export interface DecodedVehicle {
  year: string;
  make: string;
  model: string;
  bodyStyle: string;
  trim: string;
  engineSize: string;
  fuelType: string;
  driveType: string;
  doors: string;
  errorCode: string;
  errorText: string;
}

export async function decodeVIN(vin: string): Promise<DecodedVehicle> {
  const cleanVin = vin.trim().toUpperCase();
  
  if (cleanVin.length !== 17) {
    throw new Error('VIN must be exactly 17 characters');
  }

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${cleanVin}?format=json`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`NHTSA API error: ${response.status}`);
  }

  const data: NHTSAResponse = await response.json();
  
  const getValue = (variableName: string): string => {
    const result = data.Results.find(r => r.Variable === variableName);
    return result?.Value || '';
  };

  const errorCode = getValue('Error Code');
  const errorText = getValue('Error Text');
  
  const year = getValue('Model Year');
  const make = getValue('Make');
  const model = getValue('Model');

  // Check if we got meaningful data
  if (!year && !make && !model) {
    throw new Error('Unable to decode VIN - no vehicle data found');
  }


  return {
    year,
    make,
    model,
    bodyStyle: getValue('Body Class'),
    trim: getValue('Trim'),
    engineSize: getValue('Displacement (L)'),
    fuelType: getValue('Fuel Type - Primary'),
    driveType: getValue('Drive Type'),
    doors: getValue('Doors'),
    errorCode,
    errorText,
  };
}
