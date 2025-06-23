import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

export default function MapPanel({ clickedPlaces, setClickedPlaces, handleMapClick, onRegionSelect, inputMode, mapType, handleMapLoad, sessionLocked }) {
  const mapRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const [drawKey, setDrawKey] = useState(0);
  const isCancelledRef = useRef(false);
  const [buttonPositions, setButtonPositions] = useState([]);
  const overlayRefs = useRef([]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const memoizedHandleMapClick = useCallback((e) => {
    console.log('🎯 MapPanel received click event, inputMode:', inputMode);
    // Always call handleMapClick to ensure search marker cleanup
    // The parent function will handle the inputMode logic
    handleMapClick(e);
  }, [handleMapClick, inputMode]);

  useEffect(() => {
    if (inputMode === 'draw') {
      setDrawKey((prev) => prev + 1);
    }
  }, [inputMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && inputMode === 'draw' && !sessionLocked) {
        isCancelledRef.current = true;
        setTimeout(() => {
          setDrawKey(prev => prev + 1);
          setTimeout(() => {
            isCancelledRef.current = false;
          }, 50);
        }, 100);
      }
    };

    if (inputMode === 'draw' && !sessionLocked) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputMode, sessionLocked]);

  useEffect(() => {
    const updateButtonPositions = () => {
      const positions = [];
      overlayRefs.current.forEach((ref, index) => {
        if (ref && ref.getBoundingClientRect) {
          const rect = ref.getBoundingClientRect();
          positions[index] = {
            top: rect.top + rect.height / 2,
            left: rect.right - 13,
          };
        }
      });
      setButtonPositions(positions);
    };
    const interval = setInterval(updateButtonPositions, 100);
    return () => clearInterval(interval);
  }, [clickedPlaces]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({
      draggableCursor: inputMode === 'click' ? 'crosshair' : 'default',
      draggingCursor: 'grabbing',
    });
  }, [inputMode]);

  const handleOverlayComplete = useCallback(async (e) => {
    if (isCancelledRef.current) {
      isCancelledRef.current = false;
      e.overlay.setMap(null);
      return;
    }
    if (e.type === 'polygon') {
      const path = e.overlay.getPath();
      const coords = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({ lat: point.lat(), lng: point.lng() });
      }
      e.overlay.setMap(null);
      if (onRegionSelect) {
        try {
          await onRegionSelect(coords);
        } catch (error) {
          console.error('Error in onRegionSelect:', error);
        }
      }
      if (inputMode === 'draw' && !sessionLocked) {
        try {
          if (drawingManagerRef.current && typeof drawingManagerRef.current.setDrawingMode === 'function') {
            drawingManagerRef.current.setDrawingMode(null);
            setTimeout(() => {
              if (drawingManagerRef.current && typeof drawingManagerRef.current.setDrawingMode === 'function') {
                drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
              }
            }, 200);
          }
        } catch (error) {
          console.warn('Error managing drawing mode:', error);
        }
      }
    }
  }, [onRegionSelect, inputMode, sessionLocked]);

  const regions = useMemo(() => clickedPlaces.filter(p => p.type === 'region'), [clickedPlaces]);
  const markers = useMemo(() => clickedPlaces.filter(place => place.lat && place.lng), [clickedPlaces]);
  const polylinePath = useMemo(() => markers.map(p => ({ lat: p.lat, lng: p.lng })), [markers]);

  const polylineOptions = useMemo(() => ({
    strokeColor: '#3367D6',
    strokeOpacity: 0.8,
    strokeWeight: 2
  }), []);

  const polygonOptions = useMemo(() => ({
    strokeColor: '#1E90FF',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#1E90FF',
    fillOpacity: 0.2,
    clickable: false,
    editable: false,
    zIndex: 1,
  }), []);

  const drawingManagerOptions = useMemo(() => ({
    drawingControl: false,
    polygonOptions: {
      fillColor: '#1E90FF',
      fillOpacity: 0.2,
      strokeWeight: 2,
      clickable: false,
      editable: false,
      zIndex: 1,
    },
  }), []);

  const handleDeleteRegion = useCallback((timestamp) => {
    setClickedPlaces(prev => prev.filter(p => p.timestamp !== timestamp));
    setTimeout(() => {
      if (inputMode === 'draw' && !sessionLocked) {
        try {
          if (drawingManagerRef.current && typeof drawingManagerRef.current.setDrawingMode === 'function') {
            drawingManagerRef.current.setDrawingMode(null);
            setTimeout(() => {
              if (drawingManagerRef.current && typeof drawingManagerRef.current.setDrawingMode === 'function') {
                drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
              }
            }, 100);
          }
        } catch (error) {
          console.warn('Error restarting drawing after delete:', error);
        }
      } else {
        setDrawKey(prev => prev + 1);
      }
    }, 50);
  }, [setClickedPlaces, inputMode, sessionLocked]);

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={7}
        mapTypeId={mapType}
        onLoad={(map) => {
          mapRef.current = map;
          if (handleMapLoad) handleMapLoad(map);
          map.setOptions({
            disableDefaultUI: false,
            zoomControl: true,
            cameraControl: true,
            zoomControlOptions: { position: window.google.maps.ControlPosition.LEFT_BOTTOM },
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            clickableIcons: false,
          });
        }}
        onClick={memoizedHandleMapClick}
      >
        {markers.map((place, i) => (
          <Marker key={`marker-${place.timestamp || i}`} position={{ lat: place.lat, lng: place.lng }} />
        ))}

        {markers.length > 1 && (
          <Polyline path={polylinePath} options={polylineOptions} />
        )}

        {inputMode === 'draw' && !sessionLocked && window.google?.maps?.drawing && (
          <DrawingManager
            key={drawKey}
            ref={drawingManagerRef}
            onOverlayComplete={handleOverlayComplete}
            options={drawingManagerOptions}
            drawingMode={window.google?.maps?.drawing?.OverlayType?.POLYGON}
          />
        )}

        {regions.map((region, index) => (
          <div key={`region-${region.timestamp}`}>
            <Polygon paths={region.coordinates} options={polygonOptions} />
            <OverlayView
              position={getPolygonCenter(region.coordinates)}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                ref={(el) => (overlayRefs.current[index] = el)}
                style={{
                  pointerEvents: 'none',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '9999px',
                  padding: '4px 16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: '#000000',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  transform: 'translate(-50%, -50%)',
                  position: 'absolute'
                }}
              >
                <span style={{ color: '#000000', fontSize: '14px', fontWeight: '500', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {region.description || 'Unnamed region'}
                </span>
                {!sessionLocked && <div style={{ width: '26px', height: '26px' }}></div>}
              </div>
            </OverlayView>
          </div>
        ))}

        {!sessionLocked && buttonPositions.map((position, index) => {
          const region = regions[index];
          if (!position || !region) return null;

          return createPortal(
            <button
              key={`portal-button-${region.timestamp}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteRegion(region.timestamp);
              }}
              style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                transform: 'translate(-50%, -50%)',
                color: '#ef4444',
                fontSize: '18px',
                fontWeight: 'bold',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '50%',
                cursor: 'pointer',
                padding: '0',
                lineHeight: '1',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => { e.target.style.backgroundColor = '#fee2e2'; }}
              onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; }}
            >
              ×
            </button>,
            document.body
          );
        })}
      </GoogleMap>
    </div>
  );
}