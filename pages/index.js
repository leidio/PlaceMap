import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import Sidebar from '../components/Sidebar';
import MapPanel from '../components/MapPanel';
import ResponseCard from '../components/ResponseCard';
import IntentInput from '../components/IntentInput';
import FAB from '../components/FAB';
import LoadingBar from '../components/LoadingBar';
import FollowUpInput from '../components/FollowUpInput';
import RecentSessions from '../components/RecentSessions';
import { BiMap, BiPen, BiUpArrowAlt } from 'react-icons/bi';
import { ChevronDown, ChevronUp } from 'lucide-react';
import InputMode from '../components/InputMode';
import LocationSearchBar from '../components/LocationSearchBar';
import Modal from '../components/Modal';


// — — — CONSTANTS — — — — 

  //GOOGLE MAP LIBRARIES
    const googleMapsLibraries = ['drawing', 'geometry', 'places'];

  //MAP CONTAINER
    const mapContainerStyle = {
        width: '100%',
        height: '100%',
    };

  //DEFAULT CENTER
    const center = {
        lat: 46.8182,
        lng: 8.2275,
    };


// — — — HELPERS — — — — 

  //ELEVATION CLASSIFICATION
    function classifyTerrain(elevation) {
        if (elevation > 2000) return 'high alpine';
        if (elevation > 1000) return 'mountainous';
        if (elevation > 500) return 'hilly';
        return 'valley or lowland';
    }

  //DISTANCE BETWEEN POINTS
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

  //SESSION ID
    function generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

  //POINTS SAMPLE FOR ELEVATION
    function generateGridPoints(bounds, density) {
        const points = [];
        const latStep = (bounds.north - bounds.south) / (density - 1);
        const lngStep = (bounds.east - bounds.west) / (density - 1);

        for (let i = 0; i < density; i++) {
          for (let j = 0; j < density; j++) {
            const lat = bounds.south + latStep * i;
            const lng = bounds.west + lngStep * j;
            points.push({ lat, lng });
          }
        }
        return points;
    }

    function adaptiveGridDensity(bounds) {
        const latSpan = bounds.north - bounds.south;
        const lngSpan = bounds.east - bounds.west;
        const areaEstimate = latSpan * lngSpan;
        if (areaEstimate < 0.01) return 10; // small area
        if (areaEstimate < 0.05) return 15; // medium
        return 22; // large area (22x22 = 484 points)
    }

    async function fetchElevationForPoints(points) {
        try {
          const response = await fetch('/api/elevation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locations: points }),
          });
          const data = await response.json();
          return data.results.map((res) => res.elevation);
        } catch (error) {
          console.error('Elevation fetch error:', error);
          return [];
        }
    }

  //TIME DETECTION
    function detectTimeReference(text) {
      const matches = text.match(/(in\s+the\s+\d{4}s|in\s+\d{4}|before\s+\w+|after\s+\w+|during\s+\w+)/gi);
      return matches ? matches[0] : null;
    }


// — — — MAIN COMPONENT — — — — 
export default function PlaceMemoryV5() {
      const [clickedPlaces, setClickedPlaces] = useState([]);
      const [intent, setIntent] = useState('');
      const [loading, setLoading] = useState(false);
      const [showIntentInput, setShowIntentInput] = useState(true);
      const [boundingBox, setBoundingBox] = useState(null);
      const [centroid, setCentroid] = useState(null);
      const [conversationHistory, setConversationHistory] = useState([]);
      const [pastSessions, setPastSessions] = useState([]);
      const [response, setResponse] = useState('');
      const [inputMode, setInputMode] = useState('click'); // 'click' or 'draw'
      const [currentSessionId, setCurrentSessionId] = useState(null); // Track current session
      const [expanded, setExpanded] = useState(true);
      const mapRef = useRef(null);
      const isSearchingRef = useRef(false);
      const [isSessionLocked, setIsSessionLocked] = useState(false);
      const responseScrollRef = useRef(null);
      const [mapType, setMapType] = useState('roadmap');
      const [followUpType, setFollowUpType] = useState(null);
      const [searchMarker, setSearchMarker] = useState(null);
      const [hasSubmittedIntent, setHasSubmittedIntent] = useState(false);
      const [lastPrompt, setLastPrompt] = useState(null);
      const [showInterpretModal, setShowInterpretModal] = useState(false);

    //LOCATION SEARCH
    const handleSearch = (query) => {
        // Prevent duplicate calls
        if (isSearchingRef.current) {
          console.log('🚫 Search already in progress, ignoring duplicate call');
          return;
        }
        
        if (
          !mapRef.current ||
          !window.google ||
          !window.google.maps ||
          !window.google.maps.places
        ) {
          console.warn("Google Maps Places API not loaded yet.");
          return;
        }
        
        isSearchingRef.current = true;
        
        const service = new window.google.maps.places.PlacesService(mapRef.current);
        const request = {
          query,
          fields: ["name", "geometry", "formatted_address"],
        };
        
        service.textSearch(request, (results, status) => {
          isSearchingRef.current = false;
          
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            results &&
            results.length > 0
          ) {
            const place = results[0];
            const location = place.geometry.location;
            
            // Center the map
            mapRef.current.setCenter(location);
            mapRef.current.setZoom(13);
            
            // Clear any existing search markers from the map directly
            if (mapRef.current._searchMarker) {
              console.log('🧹 Removing existing search marker from map');
              mapRef.current._searchMarker.setMap(null);
              delete mapRef.current._searchMarker;
            }
            
            // Create a new temporary marker
            const marker = new window.google.maps.Marker({
              position: location,
              map: mapRef.current,
              icon: {
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new window.google.maps.Size(32, 32)
              },
              title: 'Search Result'
            });
            
            // Store marker directly on the map object (bypass React state)
            mapRef.current._searchMarker = marker;
            console.log('🔍 Created and stored search marker on map:', marker);
            console.log('🔍 Marker map after creation:', marker.getMap());
            
            // Optional: you can keep this or delete if it's a no-op
            setClickedPlaces((prev) => [...prev]);
          } else {
            console.error("No results found or search failed:", status);
          }
        });
      };

    // MAP CALLBACK
      const handleMapLoad = useCallback((map) => {
            mapRef.current = map;
      }, []);

    // RESPONSE OR NOT?
      const responseActive = conversationHistory.length > 0;

    // CLEAR SEARCH MARKER UPON ADD - NUCLEAR OPTION
      useEffect(() => {
        if (mapRef.current?._searchMarker && clickedPlaces.length > 0) {
          console.log('🗑️ User started adding places, FORCE removing all search markers');
          
          // Try multiple removal methods
          const marker = mapRef.current._searchMarker;
          
          // Method 1: Standard removal
          marker.setMap(null);
          marker.setVisible(false);
          
          // Method 2: Force map refresh by triggering a re-render
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.setZoom(currentZoom + 0.01);
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.setZoom(currentZoom);
            }
          }, 50);
          
          // Method 3: Clean up the reference
          delete mapRef.current._searchMarker;
          
          console.log('✅ Applied nuclear marker removal');
        }
      }, [clickedPlaces.length]);

    // LOAD SESSIONS from localStorage on component mount
      useEffect(() => {
            const savedSessions = localStorage.getItem('pastSessions');
            if (savedSessions) {
              try {
                setPastSessions(JSON.parse(savedSessions));
              } catch (error) {
                console.error('Error loading sessions:', error);
              }
            }
        }, []);

    // AUTO-SCROLL to the bottom whenever a new message is added
      useEffect(() => {
            if (responseScrollRef.current) {
              responseScrollRef.current.scrollTop = responseScrollRef.current.scrollHeight;
            }
        }, [conversationHistory]);

    // SAVE SESSIONS to localStorage whenever pastSessions changes
        useEffect(() => {
            localStorage.setItem('pastSessions', JSON.stringify(pastSessions));
        }, [pastSessions]);

    // CREATE OR UPDATE SESSION
    const createOrUpdateSession = () => {
        if (!intent || conversationHistory.length === 0) return;

        const sessionData = {
          id: currentSessionId || generateSessionId(),
          intent,
          conversationHistory: [...conversationHistory],
          clickedPlaces: [...clickedPlaces],
          timestamp: Date.now()
        };

        setPastSessions(prev => {
          // Check if we're updating an existing session
          if (currentSessionId) {
            const existingIndex = prev.findIndex(s => s.id === currentSessionId);
            if (existingIndex !== -1) {
              // Update existing session
              const updated = [...prev];
              updated[existingIndex] = sessionData;
              return updated;
            }
          }
          
          // Create new session (avoid duplicates)
          const isDuplicate = prev.some(s => 
            s.intent === sessionData.intent &&
            JSON.stringify(s.conversationHistory) === JSON.stringify(sessionData.conversationHistory)
          );
          
          if (!isDuplicate) {
            return [...prev, sessionData];
          }
          
          return prev;
        });

        // Set current session ID if it's a new session
        if (!currentSessionId) {
          setCurrentSessionId(sessionData.id);
        }
    };

    //CLEAR MEMORY
    const clearMemory = () => {
        // Save current session before clearing
        createOrUpdateSession();

        // Clear search marker if it exists
        if (searchMarker) {
          searchMarker.setMap(null);
          setSearchMarker(null);
        }

        // Reset all state including session lock
        setClickedPlaces([]);
        setResponse('');
        setConversationHistory([]);
        setIntent('');
        setCurrentSessionId(null);
        setIsSessionLocked(false); // Reset session lock when clearing
    };

    //RESUME SESSION
    const resumeSession = (session) => {
        // Set session state
        setIntent(session.intent);
        setConversationHistory(session.conversationHistory);
        setClickedPlaces(session.clickedPlaces || []);
        setCurrentSessionId(session.id);
        setShowIntentInput(false);
        setHasSubmittedIntent(true);
        setIsSessionLocked(true); // 🔒 Lock the session when resuming
        setExpanded(true); // Expand response tray on resume

        // Define dynamic padding for fitBounds
        const getDynamicPadding = () => {
          const width = window.innerWidth;
          const trayPadding = expanded ? 300 : 100;

          if (width < 640) {
            return { top: 60, bottom: 60, left: 20, right: trayPadding };
          } else if (width < 1024) {
            return { top: 80, bottom: 80, left: 40, right: trayPadding };
          } else {
            return { top: 100, bottom: 100, left: 100, right: trayPadding };
          }
        };

        // Auto-fit map to region or places
        if (mapRef.current && session.clickedPlaces?.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();

          session.clickedPlaces.forEach((place) => {
            if (place.type === 'region' && place.coordinates?.length) {
              place.coordinates.forEach((coord) => bounds.extend(coord));
            } else if (place.lat && place.lng) {
              bounds.extend({ lat: place.lat, lng: place.lng });
            }
          });

          mapRef.current.fitBounds(bounds, getDynamicPadding());
        }
    };

    //DELETE SESSION
    const handleDeleteSession = (idToDelete) => {
        const confirmed = window.confirm("Are you sure you want to delete this session?");
        if (!confirmed) return;

        setPastSessions(prev => prev.filter(s => s.id !== idToDelete));
        
        // If we're deleting the current session, clear current session ID
        if (currentSessionId === idToDelete) {
          setCurrentSessionId(null);
        }
    };

    //DELETE POLYGON
    const handleDeleteRegion = (indexToRemove) => {
        setClickedPlaces((prev) => prev.filter((place, idx) => {
          const isRegion = place.type === 'region' && idx === indexToRemove;
          return !isRegion;
        }));
    };

    //CLICK MODE
    const handleMapClick = async (e) => {
       console.log('🔥 handleMapClick called, inputMode:', inputMode, 'searchMarker exists:', !!searchMarker);
       
       // ADD STEP 2 DEBUGGING HERE - BEFORE the existing conditional
       console.log('🔍 CURRENT searchMarker state at click:', searchMarker);
       console.log('🔍 searchMarker exists?', !!searchMarker);
       if (searchMarker) {
         console.log('🔍 searchMarker map:', searchMarker.getMap());
         console.log('🔍 searchMarker ID:', searchMarker.__gm_id || 'no ID');
       }
       
       // Don't allow new clicks when session is locked
       if (isSessionLocked) return;

       // KEEP YOUR EXISTING FORCE CLEAR - but it should now trigger if searchMarker exists
       if (searchMarker) {
         console.log('🚨 FORCE CLEARING SEARCH MARKER IN HANDLEMACLICK');
         searchMarker.setMap(null);
         setSearchMarker(null);
       }
       
       // Don't allow new clicks when session is locked
       if (isSessionLocked) return;

       // Clear any search marker to ensure only user input is considered
       if (searchMarker) {
         console.log('🗑️ Removing search marker in handleMapClick, marker:', searchMarker);
         console.log('🔍 Marker map before removal:', searchMarker.getMap());
         console.log('🔍 Marker visible before removal:', searchMarker.getVisible());
         
         try {
           searchMarker.setMap(null);
           searchMarker.setVisible(false);
           console.log('🔍 Marker map after removal:', searchMarker.getMap());
           console.log('🔍 Marker visible after removal:', searchMarker.getVisible());
         } catch (error) {
           console.warn('Error removing search marker:', error);
         }
         setSearchMarker(null);
         console.log('✅ Search marker should be removed');
       }

       // Only process the click if we're in click mode
       if (inputMode !== 'click') {
         console.log('⏭️ Not in click mode, only clearing search marker');
         return;
       }

       const lat = e.latLng.lat();
       const lng = e.latLng.lng();
       const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

       const geoRes = await fetch(
         `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
       );
       const geoData = await geoRes.json();

       // NEAREST LOCALITY AND LAT/LONG
       let nearestTown = 'Unknown';
       let townLat = null;
       let townLng = null;

       for (const result of geoData.results) {
         const hasLocality =
           result.types.includes('locality') ||
           result.types.includes('administrative_area_level_2');
         if (hasLocality) {
           nearestTown = result.formatted_address;
           townLat = result.geometry.location.lat;
           townLng = result.geometry.location.lng;
           break;
         }
    }

    //ID NEARBY FEATURES
    let nearbyFeature = 'None found';

        for (const result of geoData.results) {
          const types = result.types || [];
          const isFeature = types.includes('natural_feature') || types.includes('park') || types.includes('point_of_interest');

          if (isFeature) {
            nearbyFeature = result.formatted_address;
            break;
          }
        }

        let elevation = 0;
        let terrain = 'unknown';
        let landCover = 'unknown';

        const types = geoData.results[0]?.types || [];

        if (types.includes('park')) landCover = 'forest or green space';
        else if (types.includes('natural_feature')) landCover = 'natural terrain';
        else if (types.includes('airport') || types.includes('industrial')) landCover = 'developed';
        else if (types.includes('locality') || types.includes('neighborhood')) landCover = 'urban or residential';
        else if (types.includes('route')) landCover = 'transport corridor';

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
        } catch (error) {
          console.error("Elevation fetch failed:", error);
        }

        //Distance to nearest town
        let distanceToTown = null;
        if (townLat && townLng) {
          distanceToTown = haversineDistance({ lat, lng }, { lat: townLat, lng: townLng });
        }

        //Places function
        const place = {
          landCover,
          nearbyFeature,
          lat,
          lng,
          elevation: Math.round(elevation),
          terrain,
          timestamp: Date.now(),
          description: geoData.results[0]?.formatted_address || 'Unknown location',
          nearestTown,
          distanceToTown: distanceToTown ? Math.round(distanceToTown) : null,
        };

        setClickedPlaces((prev) => [...prev, place]);
    };

    // REGION SELECT - ADAPTIVE SAMPLING - POLYGON CENTER - REVERSE GEOCODING - TIMESTAMP - SESSION LOCK
    const handleRegionSelect = async (coordinates) => {
            console.log('🔥 handleRegionSelect called, searchMarker exists:', !!searchMarker);

        // Force clear search marker immediately  
        if (searchMarker) {
            console.log('🚨 FORCE CLEARING SEARCH MARKER IN HANDLEREGIONSELECT');
            searchMarker.setMap(null);
            setSearchMarker(null);
        }
            
        // 🚫 Respect session lock
            if (isSessionLocked) return;
            if (!coordinates || coordinates.length === 0) return;

        // Clear any search marker to ensure only user input is considered
        if (searchMarker) {
            console.log('🗑️ Removing search marker in handleRegionSelect, marker:', searchMarker);
            console.log('🔍 Marker map before removal:', searchMarker.getMap());
            console.log('🔍 Marker visible before removal:', searchMarker.getVisible());
            
            try {
              searchMarker.setMap(null);
              searchMarker.setVisible(false);
              console.log('🔍 Marker map after removal:', searchMarker.getMap());
              console.log('🔍 Marker visible after removal:', searchMarker.getVisible());
            } catch (error) {
              console.warn('Error removing search marker:', error);
            }
            setSearchMarker(null);
            console.log('✅ Search marker should be removed');
        }

        // ➕ Compute center of polygon
            const lats = coordinates.map(c => c.lat);
            const lngs = coordinates.map(c => c.lng);
            const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
            const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

        // 🌍 Reverse geocode
        let description = 'Unnamed region';
        try {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${centerLat},${centerLng}&key=${apiKey}`
          );
          const data = await res.json();

          if (data.results && data.results.length > 0) {
            let result = data.results[0];
            description = result.formatted_address || 'Unnamed region';

            if (description.length > 50) {
              for (const result of data.results) {
                const types = result.types || [];
                if (
                  types.includes('locality') ||
                  types.includes('administrative_area_level_2') ||
                  types.includes('natural_feature') ||
                  types.includes('sublocality')
                ) {
                  description = result.formatted_address;
                  break;
                }
              }

              if (description.length > 50) {
                description = description.substring(0, 47) + '...';
              }
            }
          }
        } catch (err) {
          console.warn('Reverse geocoding failed:', err);
        }

        // 🧠 Elevation Sampling
        const bounds = {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs),
        };

        const density = adaptiveGridDensity(bounds);
        const samplePoints = generateGridPoints(bounds, density);
        const elevations = await fetchElevationForPoints(samplePoints);

        let elevationRange = null;
        if (elevations.length > 0) {
          const min = Math.min(...elevations);
          const max = Math.max(...elevations);
          elevationRange = [Math.round(min), Math.round(max)];
        }

        // 🗂 Final region object
        const timestamp = Date.now();
        setClickedPlaces(prev => {
          return [
            ...prev,
            {
              type: 'region',
              coordinates: [...coordinates],
              center: { lat: centerLat, lng: centerLng },
              description,
              elevationRange,
              timestamp,
            },
          ];
        });
    };

    //CLUSTER FUNCTION
    function clusterPlaces(places, thresholdKm = 10) {
          const clusters = [];

          for (const place of places) {
            let foundCluster = false;

            for (const cluster of clusters) {
              const center = cluster[0]; // simple: use first point as center
              const dist = haversineDistance(center, place);
              if (dist < thresholdKm) {
                cluster.push(place);
                foundCluster = true;
                break;
              }
            }

            if (!foundCluster) {
              clusters.push([place]);
            }
          }

          return clusters;
    }

    //BOUNDING BOX
    function computeBoundsAndCentroid(places) {
          if (places.length === 0) return { bounds: null, centroid: null };

          const lats = places.map(p => p.lat);
          const lngs = places.map(p => p.lng);

          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          const centroidLat = lats.reduce((a, b) => a + b, 0) / lats.length;
          const centroidLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

          return {
            bounds: {
              minLat, maxLat,
              minLng, maxLng,
            },
            centroid: {
              lat: centroidLat,
              lng: centroidLng,
            },
          };
    }

    //SUMMARIZE HISTORY
    function summarizeHistory(conversationHistory) {
          if (!conversationHistory || conversationHistory.length < 2) return "";

          const recentTurns = conversationHistory.slice(-4); // last 2–4 entries
          const userInputs = recentTurns.filter(turn => turn.role === 'user').map(turn => turn.content);
          const gptReplies = recentTurns.filter(turn => turn.role === 'assistant').map(turn => turn.content);

          const themes = [];
          const themeKeywords = {
            civic: ['library', 'city hall', 'community center', 'plaza', 'memorial'],
            natural: ['park', 'river', 'trail', 'green', 'nature'],
            industrial: ['factory', 'warehouse', 'rail', 'dock', 'mill'],
            speculative: ['what if', 'could', 'imagine', 'vision', 'dream'],
            reflective: ['why', 'meaning', 'significance', 'history']
          };

          [...userInputs, ...gptReplies].forEach(text => {
            const lowered = text.toLowerCase();
            Object.entries(themeKeywords).forEach(([theme, keywords]) => {
              if (keywords.some(keyword => lowered.includes(keyword))) {
                if (!themes.includes(theme)) themes.push(theme);
              }
            });
          });

          if (themes.length > 0) {
            return `Previously, the user explored themes of ${themes.join(', ')}.`;
          } else {
            return "The conversation has involved several evolving ideas and locations.";
          }
    }

    //INFER CLUSTER QUALITIES
    function inferClusterType(cluster) {
          let waterCount = 0;
          let urbanCount = 0;
          let elevationAvg = 0;

          cluster.forEach(p => {
            const lowerDesc = p.description?.toLowerCase() || '';
            if (lowerDesc.includes('river') || lowerDesc.includes('lake') || lowerDesc.includes('beach')) {
              waterCount++;
            }
            if (lowerDesc.includes('town') || lowerDesc.includes('city') || lowerDesc.includes('industrial')) {
              urbanCount++;
            }
            elevationAvg += p.elevation || 0;
          });

          elevationAvg = elevationAvg / cluster.length;

          if (waterCount / cluster.length > 0.5) return 'coastal or riparian';
          if (urbanCount / cluster.length > 0.5) return 'urban or peri-urban';
          if (elevationAvg > 800) return 'mountainous';
          if (elevationAvg < 150) return 'lowland';
          return 'inland mixed terrain';
    }

    //ANALYSIS FUNCTIONS
    const analyzePlaces = async () => {
        setLoading(true);  // show loading state
        setShowIntentInput(false);

        // Create new session ID if this is a new session
        if (!currentSessionId) {
          setCurrentSessionId(generateSessionId());
        }

        // Detect time reference
        const timeContext = detectTimeReference(intent);

        // Bounds
        const { bounds, centroid } = computeBoundsAndCentroid(clickedPlaces);
        setBoundingBox(bounds);
        setCentroid(centroid);

        //Elevation range
        const summaries = clickedPlaces.map((p, i) => {
            if (p.type === 'region') {
              const elevationNote = p.elevationRange
                ? ` with elevation range ${p.elevationRange[0]}m to ${p.elevationRange[1]}m`
                : '';
              return `Region ${i + 1}: ${p.description}${elevationNote}, drawn by user as a polygon.`;
            } else {
              return `Location ${i + 1}: ${p.description} — ${p.terrain} terrain, approx. ${p.elevation}m, near ${p.nearbyFeature}`;
            }
          }).join('\n');

        const elevationLines = clickedPlaces.map(place =>
            `Lat: ${place.lat}, Lng: ${place.lng}` +
            (place.elevation != null ? `, Elevation: ${Math.round(place.elevation)} meters` : '')
          ).join('\n');

        // Length summary
        let totalDist = 0;
        for (let i = 1; i < clickedPlaces.length; i++) {
          totalDist += haversineDistance(clickedPlaces[i - 1], clickedPlaces[i]);
        }

        // Estimate average slope (elevation change per km)
        let slopeSummary = '';
        if (clickedPlaces.length > 1) {
          let totalSlope = 0;
          for (let i = 1; i < clickedPlaces.length; i++) {
            const elevDiff = Math.abs(clickedPlaces[i].elevation - clickedPlaces[i - 1].elevation);
            const dist = haversineDistance(clickedPlaces[i], clickedPlaces[i - 1]);
            if (dist > 0) totalSlope += elevDiff / dist;
          }
          const avgSlope = totalSlope / (clickedPlaces.length - 1);
          slopeSummary = `Average slope between locations is ~${avgSlope.toFixed(1)} meters per km.`;
        }

        // Distance summary
        const distSummary = clickedPlaces.length > 1
          ? `Average distance between points: ~${Math.round(totalDist / (clickedPlaces.length - 1))} km`
          : 'Single location selected';

        // Nearest town
        const townSummary = clickedPlaces.map(
          (p, i) => `Location ${i + 1}: ${p.distanceToTown} km from ${p.nearestTown}`
        ).join('\n');

        const clusters = clusterPlaces(clickedPlaces);

        // Cluster summary
        const clusterSummary = clusters.map((group, i) => {
          const names = group.map((p) => p.description).join(', ');
          const inferredType = inferClusterType(group);
          return `Cluster ${i + 1} (${inferredType}): ${names}`;
        }).join('\n');

        // Terrain distribution
        const terrainCounts = clickedPlaces.reduce((acc, place) => {
          acc[place.terrain] = (acc[place.terrain] || 0) + 1;
          return acc;
        }, {});

        // Terrain summary
        const terrainSummary = Object.entries(terrainCounts)
          .map(([terrain, count]) => `${count} ${terrain}`)
          .join(', ');

        // Elevation range
        const elevations = clickedPlaces.map(p => p.elevation);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        const elevationSummary = `Elevations range from ${minElevation}m to ${maxElevation}m.`;

        // Land cover
        const landCoverCounts = clickedPlaces.reduce((acc, place) => {
          acc[place.landCover] = (acc[place.landCover] || 0) + 1;
          return acc;
        }, {});

        const landCoverSummary = Object.entries(landCoverCounts)
          .map(([cover, count]) => `${count} in ${cover}`)
          .join(', ');

        // 🗺️ Spatial extent
        const lats = clickedPlaces.map(p => p.lat);
        const lngs = clickedPlaces.map(p => p.lng);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        // Center point
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        // Max distance (coverage diameter)
        let maxDist = 0;
        for (let i = 0; i < clickedPlaces.length; i++) {
          for (let j = i + 1; j < clickedPlaces.length; j++) {
            const d = haversineDistance(clickedPlaces[i], clickedPlaces[j]);
            if (d > maxDist) maxDist = d;
          }
        }

        // Reverse Geocode Center
        let centerDescription = 'Unknown center point';
            try {
              const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
              const centerRes = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${centerLat},${centerLng}&key=${apiKey}`
              );
              const centerData = await centerRes.json();

              // Dynamically prioritize name type based on polygon scale
              let priorityTypes;
              if (maxDist < 2) {
                priorityTypes = ['street_address', 'premise', 'subpremise', 'route'];
              } else if (maxDist < 15) {
                priorityTypes = ['neighborhood', 'sublocality', 'locality'];
              } else {
                priorityTypes = ['locality', 'administrative_area_level_1', 'country'];
              }

              const components = centerData.results.flatMap(result => result.address_components);

              const getComponent = (type) =>
                components.find(comp => comp.types.includes(type))?.long_name;

              for (const type of priorityTypes) {
                const match = getComponent(type);
                if (match) {
                  // Try to include a broader context if available
                  const country = getComponent('country');
                  centerDescription = country && country !== match
                    ? `${match}, ${country}`
                    : match;
                  break;
                }
              }

          // Fallback to raw formatted address if no good match
          if (centerDescription === 'Unknown center point') {
            centerDescription = centerData.results[0]?.formatted_address || 'Unknown area';
                }

              } catch (error) {
                console.warn('Failed to fetch center location name:', error);
              }

          // Name centerpoint
          const coverageSummary = `The selected area spans ~${Math.round(maxDist)} km, centered near ${centerDescription}.`;

          // Placenames
          const readableNames = clickedPlaces
            .map((p) => {
              if (p.name) return p.name;
              if (p.address) return p.address;
              if (p.lat !== undefined && p.lng !== undefined) {
                return `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`;
              }
              return 'Unnamed location';
            })
            .join(', ');


          //GPT PROMPT
          const reflection = summarizeHistory(conversationHistory);

          const prompt = `
              ${reflection}

              Here are two examples of how you might respond:

              Example 1:
              The selected places — all clustered along a rugged alpine ridge — reveal a clear pattern of high-altitude pastoral land use. These locations likely supported transhumance or seasonal migration, shaping local identities around altitude and isolation. 
              If you're curious, you might explore how this upland geography influenced trade routes or cultural exchange with valleys below.

              Example 2:
              These sites seem to trace the footprint of post-industrial transformation: rail infrastructure, former manufacturing zones, civic plazas. Together, they suggest a story about how cities repurpose their cores. 
              Would you like to explore how civic memory and economic shifts interact in these urban spaces?

              ---

              The user is exploring places on a map with the goal: "${intent}".

              They have selected ${clickedPlaces.length} location${clickedPlaces.length > 1 ? 's' : ''}, each with specific terrain and features: ${summaries}

              - Terrain: ${terrainSummary}
              - Land cover: ${landCoverSummary}
              - Elevation range: ${elevationSummary}
              - ${slopeSummary ? `- Average slope: ${slopeSummary}` : ''}
              - Nearest towns: ${townSummary}
              - Distance between sites: ${distSummary}
              - Overall area coverage: ${coverageSummary}
              - Spatial clusters: ${clusterSummary}
              - Elevation range of a region: ${elevationLines}

              ---

              ${timeContext ? `\nThey appear to be interested in the perspective of ${timeContext}, so interpret these places with that historical or speculative lens in mind.` : ''}

              Your role is to interpret the selected places as if uncovering a pattern. 
              Don’t summarize — synthesize. 
              What ties them together? 
              What contradictions stand out? What stories are emerging?
              Prioritize insight over description.
              You are allowed to speculate. 
              Offer plausible interpretations drawn from geographic, economic, or historical context. 
              It is more useful to the user if you make a thoughtful guess than if you only suggest further research.
              If you notice any interesting patterns or emerging themes in the selected places, wrap up with a natural follow-up—something the user might plausibly ask next. 
              Keep it conversational, curious, and context-aware — not just generic.”
            `;

            setLastPrompt(prompt);

            try {
              const res = await fetch('/api/gpt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
              });

              const data = await res.json();
              const newHistory = [intent, data.result];
              setConversationHistory(newHistory);
              
              // Create/update session immediately after getting the response
              setTimeout(() => createOrUpdateSession(), 100);
              
            } catch (error) {
              console.error("GPT fetch failed", error);
              setResponse("Error generating response.");
            } finally {
              setLoading(false);  // hide loading state
            }
    };

    //REFER BACK TO EARLIER LOCATIONS
    function formatClustersForFollowUp(clusters) {
      return clusters.map((group, i) => {
        const inferredType = inferClusterType(group);
        const names = group.map((p) => p.description).join(', ');
        return `Cluster ${i + 1} (${inferredType}): ${names}`;
      }).join('\n');
    }

    //FOLLOW UP FUNCTION
    const handleFollowUp = async (question) => {
          setLoading(true);

          const reflection = summarizeHistory(conversationHistory);
          const numFollowUps = (conversationHistory.length - 2) / 2;
          const shouldSummarize = numFollowUps >= 3;
          const formattedClusters = formatClustersForFollowUp(clusterPlaces(clickedPlaces));
          const summaryInstruction = shouldSummarize? `

          Provide a brief summary of how the user's exploration has developed so far. What themes or insights are emerging across their selected places and questions?

          Then respond to the latest question in light of that summary.
          `
            : '';

          // Format conversation so far with speaker labels
          const formattedHistory = conversationHistory.map((entry, idx) => {
            return idx % 2 === 0
              ? `🐼  ${entry}`
              : `🤖  ${entry}`;
          }).join('\n\n');

          // New follow-up with classification and reflection guidance
          const newPrompt = `${question}

          ${reflection}

          Example response (not helpful):
          “It would be beneficial to consult experts or review historical documents...”

          Better response:
          “These canals were likely built during mid-20th-century industrial expansion, based on their alignment with known oil exploration zones and absence from prewar maps.”

          ---

          The user previously explored the following clusters of locations:
          ${formattedClusters}

          Determine the type of follow-up. Is the user:
          - Asking for clarification?
          - Adjusting constraints?
          - Requesting next steps?
          - Introducing a new direction?

          Return your answer in the following JSON format:

          {
            "followUpType": "<one of: clarification | constraint_change | next_steps | new_direction>",
            "response": "<your full, thoughtful reply here>"
          }

          Continue the conversation naturally.

          Reflect on the full history so far. Has the user's objective evolved or become clearer? Adjust your response accordingly.
          
          ${summaryInstruction}
          `;

          const fullPrompt = `${formattedHistory}\n\n${newPrompt}`;

          try {
            const res = await fetch('/api/gpt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: fullPrompt }),
            });

            const data = await res.json();

            let parsed;
            try {
              parsed = JSON.parse(data.result); // Parse GPT's JSON response
            } catch (e) {
              console.warn("Could not parse GPT response as JSON:", data.result);
              parsed = { followUpType: 'unknown', response: data.result };
            }

            const updatedHistory = [...conversationHistory, question, parsed.response];
            setConversationHistory(updatedHistory);
            setFollowUpType(parsed.followUpType); // Optional: track or log this

            setTimeout(() => createOrUpdateSession(), 100);

          } catch (error) {
            console.error("GPT follow-up error", error);
            setResponse("Error generating follow-up response.");
          } finally {
            setLoading(false);
          }
    };

    // REGION SELECT
    const onRegionSelect = async (coordinates) => {
          // Don't allow new regions when session is locked
          if (isSessionLocked) return;

          if (!coordinates || coordinates.length === 0) return;

          // Compute center
          const lats = coordinates.map(c => c.lat);
          const lngs = coordinates.map(c => c.lng);
          const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
          const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

          let description = 'Unnamed region';

          try {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${centerLat},${centerLng}&key=${apiKey}`
            );
            const data = await res.json();
            if (data.results?.[0]) {
              description = data.results[0].formatted_address;
            }
          } catch (err) {
            console.warn("Reverse geocoding failed:", err);
          }

          const region = {
            type: 'region',
            coordinates,
            center: { lat: centerLat, lng: centerLng },
            description,
            timestamp: Date.now(),
          };

          console.log('🌍 Final description before adding to state:', description);

          setClickedPlaces((prev) => [...prev, region]);
    };

    // RENDERING BLOCK
     console.log("FAB Check", {
       conversationHistoryLength: conversationHistory.length,
       expanded,
     });
      
    return (
        <div className="relative h-screen w-screen">
        {/* TOP BAR: Map Type + Input Mode on left, Sessions on right */}
          <div className="absolute top-4 inset-x-4 z-40 flex justify-between items-start pointer-events-none">
            <div className="flex gap-4 pointer-events-auto">

              {/* MAP TYPE (always visible) */}
              <div className="p-2 space-x-2 backdrop-blur-xs bg-white/80 shadow-lg rounded-full w-fit">
                {['roadmap', 'terrain', 'satellite'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setMapType(type)}
                    className={`px-4 py-2 text-sm font-medium h-full ${
                      mapType === type
                        ? 'bg-civicGreen text-black rounded-full'
                        : 'text-gray-700 hover:bg-black hover:text-white hover:rounded-full'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

             {/* INPUT MODE (only when not locked) */}
             {!isSessionLocked && (
               <div className="flex">
                 <InputMode inputMode={inputMode} setInputMode={setInputMode} />
               </div>
             )}
            </div>

            {!isSessionLocked && conversationHistory.length === 0 && !hasSubmittedIntent && (
            <LocationSearchBar onSearch={handleSearch} />
            )}

            {/* SESSIONS (only shown if available) */}
            {!loading && !isSessionLocked && pastSessions.length > 0 && (
            <div className="pointer-events-auto">
                <RecentSessions
                  pastSessions={pastSessions}
                  onResume={resumeSession}
                  onDelete={handleDeleteSession}
                />  
              </div>
            )}
          </div>
          //END OF TOP CONTAINER

          {/* BOTTOM CENTER: Intent Input */}
          {showIntentInput && !isSessionLocked && conversationHistory.length === 0 && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[90%] sm:w-[36rem] pointer-events-auto">
              <IntentInput
                intent={intent}
                setIntent={setIntent}
                onAnalyze={analyzePlaces}
              />
            </div>
          )}

          {/* FULL-SCREEN MAP */}
          <div className="absolute inset-0 z-0">
            <LoadScript
              googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              libraries={googleMapsLibraries}
            >
              <MapPanel
                clickedPlaces={clickedPlaces}
                setClickedPlaces={setClickedPlaces}
                handleMapClick={handleMapClick}
                onRegionSelect={onRegionSelect}
                inputMode={inputMode}
                handleMapLoad={handleMapLoad}
                sessionLocked={isSessionLocked}
                mapType={mapType}
                conversationHistory={conversationHistory}
              />
            </LoadScript>
          </div>

          {/* LOADING INDICATOR */}
          {loading && <LoadingBar />}

          {/* RESPONSE TRAY (conditionally rendered) */}
          {conversationHistory.length > 0 && expanded && (
            <div className="fixed right-4 top-4 max-h-[calc(100vh-2rem)] w-[28rem] z-40 backdrop-blur-sm bg-white/80 shadow-xl rounded-xl flex flex-col">


              {/* HIDE TRAY button */}
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center justify-center w-full px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 border-b border-gray-200"
              >
                Hide
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>

              {/* Scrollable response area */}
              <div ref={responseScrollRef} className="overflow-y-auto p-4">
                <ResponseCard
                  intent={intent}
                  conversationHistory={conversationHistory}
                  onFollowUp={handleFollowUp}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  setShowInterpretModal={setShowInterpretModal}
                />
              </div>
            </div>
                  )}

          <Modal
            isOpen={showInterpretModal}
            onClose={() => setShowInterpretModal(false)}
            promptText={lastPrompt}
          />

          {/* FAB stays visible */}
          {conversationHistory.length > 0 && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 flex justify-center w-full max-w-md">
              <div className="shadow-lg">
                <FAB
                  onClick={() => {
                    clearMemory();
                    setShowIntentInput(true);
                    setHasSubmittedIntent(false);
                  }}
                />
              </div>
            </div>
          )}


          {/* EXPAND BUTTON (when Response Tray is hidden) */}
          {conversationHistory.length > 0 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="fixed top-4 right-4 w-[28rem] z-50 bg-white shadow-xl rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-100 flex items-center justify-center"
            >
              Show response
              <ChevronUp className="ml-2 h-4 w-4" />
            </button>
          )}
        </div>
    );
}