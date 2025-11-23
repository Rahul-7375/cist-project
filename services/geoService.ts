import { GeoLocation } from '../types';

export const calculateDistance = (loc1: GeoLocation, loc2: GeoLocation): number => {
  // Exact match check to prevent floating point errors
  if (loc1.lat === loc2.lat && loc1.lng === loc2.lng) {
    return 0;
  }

  const R = 6371e3; // metres
  const φ1 = loc1.lat * Math.PI / 180; // φ, λ in radians
  const φ2 = loc2.lat * Math.PI / 180;
  const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
  const Δλ = (loc2.lng - loc1.lng) * Math.PI / 180;

  let a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            
  // CRITICAL FIX: Clamp value between 0 and 1. 
  // Floating point math can sometimes result in 1.0000000002, causing NaN in generic formulas.
  a = Math.max(0, Math.min(1, a));

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  
  // Return 0 if the result is NaN for any reason
  return isNaN(d) ? 0 : d;
};

export const getCurrentLocation = (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Round to 6 decimal places to smooth out micro-jitter
          resolve({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          });
        },
        (error) => {
          let msg = "Unknown location error";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              msg = "Location permission denied. Please enable GPS.";
              break;
            case error.POSITION_UNAVAILABLE:
              msg = "Location information unavailable.";
              break;
            case error.TIMEOUT:
              msg = "Location request timed out. Check your connection.";
              break;
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, 
          maximumAge: 10000 // Allow cached positions up to 10s to prevent 'glitchy' GPS lock errors
        }
      );
    }
  });
};