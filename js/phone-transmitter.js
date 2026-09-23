/**
 * Phone GPS Transmitter Module
 * Uses browser's native navigator.geolocation.watchPosition() to stream live phone location like WhatsApp.
 */

let watchId = null;
let isTransmitting = false;

export function startPhoneGpsBroadcaster(onLocationUpdate) {
  if (!('geolocation' in navigator)) {
    alert('Geolocation is not supported by your browser.');
    return false;
  }

  if (isTransmitting) return true;

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 4.0;
      const speed = position.coords.speed ? (position.coords.speed * 3.6) : 0; // m/s to km/h
      const heading = position.coords.heading || 0;

      if (onLocationUpdate) {
        onLocationUpdate({
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          speedKmph: speed,
          heading: heading,
          timestamp: position.timestamp
        });
      }
    },
    (err) => {
      console.warn('[PhoneTransmitter] GPS Watch Error:', err.message);
    },
    options
  );

  isTransmitting = true;
  return true;
}

export function stopPhoneGpsBroadcaster() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    isTransmitting = false;
  }
}
