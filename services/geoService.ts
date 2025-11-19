import { GeoLocation } from '../types';

export const calculateDistance = (loc1: GeoLocation, loc2: GeoLocation): number => {
  const R = 6371e3; // metres
  const φ1 = loc1.lat * Math.PI / 180; // φ, λ in radians
  const φ2 = loc2.lat * Math.PI / 180;
  const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
  const Δλ = (loc2.lng - loc1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
};

export const getCurrentLocation = (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
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
          timeout: 15000, // Increased timeout for better accuracy lock
          maximumAge: 0
        }
      );
    }
  });
};