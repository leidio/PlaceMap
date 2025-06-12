import { useState } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const center = {
  lat: 46.8182,
  lng: 8.2275,
};

function classifyTerrain(elevation) {
  if (elevation > 2000) return 'high alpine';
  if (elevation > 1000) return 'mountainous';
  if (elevation > 500) return 'hilly';
  return 'valley or lowland';
}

function haversineDistance(coord1, coord2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(coord1.lat)) *
    Math.cos(toRad(coord2.lat)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function PlaceMemoryV5() {
  const [clickedPlaces, setClickedPlaces] = useState([]);
  const [response, setResponse] = useState('');
  const [intent, setIntent] = useState('');

  const handleMapClick = async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    console.log("📍 Google Maps API Key:", apiKey);

    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    const geoData = await geoRes.json();

    let elevation = 0;
    let terrain = 'unknown';

    try {
      const elevRes = await fetch('/api/elevation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });

      if (!elevRes.ok) {
        throw new Error(`API route error: ${elevRes.status}`);
      }

      const elevData = await elevRes.json();
      elevation = elevData.elevation || 0;
      terrain = classifyTerrain(elevation);

      console.log("📏 Elevation data (via API route):", elevData);
    } catch (error) {
      console.error("🧨 Failed to fetch elevation via server route:", error);
    }

    const place = {
      lat,
      lng,
      elevation: Math.round(elevation),
      terrain,
      timestamp: new Date().toISOString(),
      description: geoData.results[0]?.formatted_address || 'Unknown location',
    };

    setClickedPlaces((prev) => [...prev, place]);
  };

  const clearMemory = () => {
    setClickedPlaces([]);
    setResponse('');
  };

  const analyzePlaces = async () => {
    const summaries = clickedPlaces.map(
      (p, i) => `Location ${i + 1}: ${p.description} — ${p.terrain} terrain, approx. ${p.elevation}m`
    ).join('\n');

    let totalDist = 0;
    for (let i = 1; i < clickedPlaces.length; i++) {
      totalDist += haversineDistance(clickedPlaces[i - 1], clickedPlaces[i]);
    }

    const distSummary = clickedPlaces.length > 1
      ? `Average distance between points: ~${Math.round(totalDist / (clickedPlaces.length - 1))} km`
      : 'Single location selected';

    const prompt = `The user is trying to: "${intent}".\nThey clicked the following locations:\n${summaries}\n${distSummary}\n\nPlease analyze the spatial pattern and terrain characteristics. What might this suggest about the user's goal or constraints? Offer next steps, options, or recommendations.`;

    const res = await fetch('/api/gpt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    setResponse(data.result);
  };

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: '25%', padding: '1rem', borderRight: '1px solid #ddd' }}>
        <h3>Intent</h3>
        <textarea
          rows={3}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g. Find forested areas near water for a hiking route..."
          style={{ width: '100%', fontSize: '0.9rem', marginBottom: '1rem' }}
        />

        <h3>Memory</h3>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {clickedPlaces.map((p, i) => (
            <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              📍 {p.description} ({p.terrain}, {p.elevation}m)
            </li>
          ))}
        </ul>

        <button onClick={analyzePlaces} style={{ marginTop: '1rem', marginRight: '0.5rem' }}>
          Analyze Exploration
        </button>
        <button onClick={clearMemory} style={{ marginTop: '1rem', backgroundColor: '#ccc' }}>
          Clear Memory
        </button>
      </div>

      <div style={{ flex: 1, padding: '1rem' }}>
        <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={7}
            onClick={handleMapClick}
          >
            {clickedPlaces.map((place, index) => (
              <Marker key={index} position={{ lat: place.lat, lng: place.lng }} />
            ))}
          </GoogleMap>
        </LoadScript>

        {response && (
          <div style={{ marginTop: '1rem', whiteSpace: 'pre-line', background: '#f7f7f7', padding: '1rem', borderRadius: '6px' }}>
            {response}
          </div>
        )}
      </div>
    </div>
  );
}
