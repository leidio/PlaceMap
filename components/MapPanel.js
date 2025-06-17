import { useEffect, useRef } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  Polygon,
  DrawingManager,
  OverlayView,
} from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 46.8182,
  lng: 8.2275,
};

function getPolygonCenter(coordinates) {
  const lats = coordinates.map(p => p.lat);
  const lngs = coordinates.map(p => p.lng);
  return {
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
  };
}

export default function MapPanel({ clickedPlaces, setClickedPlaces, handleMapClick, onRegionSelect, inputMode }) {
  const mapRef = useRef(null);
  const drawingManagerRef = useRef(null);

  console.log("🔁 Regions to render:", clickedPlaces.filter(p => p.type === 'region'));

  const onMapLoad = (map) => {
    mapRef.current = map;
  };

  const handleOverlayComplete = async (e) => {
    if (e.type === 'polygon') {
      const path = e.overlay.getPath();
      const coords = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({ lat: point.lat(), lng: point.lng() });
      }
      e.overlay.setMap(null);
      drawingManagerRef.current.setDrawingMode(null);

      let description = 'Selected region';
      if (onRegionSelect) {
        try {
          const resolved = await onRegionSelect(coords);
          if (resolved) description = resolved;
        } catch (err) {
          console.error('Geocoding failed:', err);
        }
      }

      const region = {
        type: 'region',
        coordinates: coords,
        timestamp: new Date().toISOString(),
        description,
      };

      setClickedPlaces((prev) => [...prev, region]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && drawingManagerRef.current) {
        drawingManagerRef.current.setDrawingMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapRef.current?.getCenter?.() || defaultCenter}
      zoom={7}
      onLoad={onMapLoad}
      onClick={inputMode === 'click' ? handleMapClick : null}
    >
      {clickedPlaces.map((place, i) => (
        place.lat && place.lng ? <Marker key={`marker-${i}`} position={{ lat: place.lat, lng: place.lng }} /> : null
      ))}

      {clickedPlaces.filter(p => p.lat && p.lng).length > 1 && (
        <Polyline
          path={clickedPlaces.filter(p => p.lat && p.lng).map(p => ({ lat: p.lat, lng: p.lng }))}
          options={{ strokeColor: '#3367D6', strokeOpacity: 0.8, strokeWeight: 2 }}
        />
      )}

      {clickedPlaces
        .filter(p => p.type === 'region')
        .map((region, i) => (
          <div key={`region-wrap-${i}`}>
            <Polygon
              paths={region.coordinates}
              options={{
                strokeColor: '#1E90FF',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#1E90FF',
                fillOpacity: 0.2,
                clickable: false,
                editable: false,
                zIndex: 1,
              }}
            />
            <OverlayView
              position={getPolygonCenter(region.coordinates)}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                className="bg-white border border-gray-300 rounded-full py-1 px-3 text-sm shadow-md inline-flex items-center"
                style={{
                  transform: 'translate(-50%, 1rem)',
                  whiteSpace: 'nowrap',
                  maxWidth: 'none',
                }}
              >
                <span className="mr-2">{region.description || 'Selected region'}</span>
                <button
                  onClick={() => {
                    setClickedPlaces((prev) =>
                      prev.filter((p) => p.timestamp !== region.timestamp)
                    );
                  }}
                  className="text-red-500 hover:text-red-700 text-lg leading-none font-bold focus:outline-none"
                >
                  ×
                </button>
              </div>
            </OverlayView>
          </div>
      ))}

      {inputMode === 'draw' && (
        <DrawingManager
          onLoad={(manager) => (drawingManagerRef.current = manager)}
          onOverlayComplete={handleOverlayComplete}
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: window.google.maps.ControlPosition.TOP_CENTER,
              drawingModes: ['polygon'],
            },
            polygonOptions: {
              fillColor: '#1E90FF',
              fillOpacity: 0.2,
              strokeWeight: 2,
              clickable: false,
              editable: false,
              zIndex: 1,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}