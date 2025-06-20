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

const googleMapsLibraries = ['drawing', 'geometry'];

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


//PRIMARY FUNCTION
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
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const responseScrollRef = useRef(null);
  const [mapType, setMapType] = useState('roadmap');

  // MAP CALLBACK
  const handleMapLoad = useCallback((map) => {
      mapRef.current = map;
    }, []);

  // RESPONSE OR NOT?
  const responseActive = conversationHistory.length > 0;

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
      setIntent(session.intent);
      setConversationHistory(session.conversationHistory);
      setClickedPlaces(session.clickedPlaces || []);
      setCurrentSessionId(session.id);
      setShowIntentInput(false);
      setIsSessionLocked(true); // 🔒 Lock the session when resuming

      // 🧭 Center map on first saved location (if available)
      if (mapRef.current && session.clickedPlaces && session.clickedPlaces.length > 0) {
        const firstPlace = session.clickedPlaces[0];
        const latLng = firstPlace.center || { lat: firstPlace.lat, lng: firstPlace.lng };
        if (latLng && latLng.lat && latLng.lng) {
          mapRef.current.panTo(latLng);
          mapRef.current.setZoom(12);
        }
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

  //PLACEMARKERS
  const handleMapClick = async (e) => {
      // Don't allow new clicks when session is locked
      if (isSessionLocked) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      );
      const geoData = await geoRes.json();

      //NEAREST LOCATLITY AND LAT/LONG
      let nearestTown = 'Unknown';
      let townLat = null;
      let townLng = null;

      for (const result of geoData.results) {
        const hasLocality = result.types.includes('locality') || result.types.includes('administrative_area_level_2');
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
    // 🚫 Respect session lock
    if (isSessionLocked) return;
    if (!coordinates || coordinates.length === 0) return;

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

//ANALYZE FUNCTIONS
const analyzePlaces = async () => {
    setLoading(true);  // show loading state
    setShowIntentInput(false);

    // Create new session ID if this is a new session
    if (!currentSessionId) {
      setCurrentSessionId(generateSessionId());
    }

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
      return `Cluster ${i + 1}: ${names}`;
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

    // Optional reverse geocode center
    let centerDescription = 'Unknown center point';
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const centerRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${centerLat},${centerLng}&key=${apiKey}`);
      const centerData = await centerRes.json();
      centerDescription = centerData.results[0]?.formatted_address || 'Unknown area';
    } catch (error) {
      console.warn('Failed to fetch center location name:', error);
    }

    const coverageSummary = `The selected area spans ~${Math.round(maxDist)} km, centered near ${centerDescription}.`;

  //GPT PROMPT
  const prompt = `
      The user is exploring places on a map with the goal: "${intent}".
      Here are the selected places, including rough descriptions and locations:

      They have selected ${clickedPlaces.length} location${clickedPlaces.length > 1 ? 's' : ''}, each with specific terrain and features:

      ${summaries}

      Distance overview:
      ${distSummary}

      Nearest towns:
      ${townSummary}

      Terrain distribution: ${terrainSummary}
      ${elevationSummary}
      ${slopeSummary}

      Land cover types: ${landCoverSummary}

      Spatial coverage: ${coverageSummary}

      Clusters of interest:
      ${clusterSummary}

      Elevation range of a region:
      ${elevationLines}

      ---

      Act as a cultural anthropologist and environmental analyst. When a user selects a place, synthesize multiple perspectives to provide deep insights about its character, significance, and context.
      Interpret what makes this place unique, how it fits into broader patterns, and what stories it tells.
      Consider as inputs to your synthesis:
          historical context,
          cultural and social dynamics,
          economic patterns and influences,
          geographic and environmental factors, 
          comparative analysis with similar places,
          future trends and implications.
      When relevant, use the data gathered above to answer the user's intent.
      Respond in a way that interprets these characteristics but do not respond like a book report or essay.
    `;

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

  //FOLLOW UP
  const handleFollowUp = async (question) => {
      setLoading(true);

      // Format conversation so far with speaker labels
      const formattedHistory = conversationHistory.map((entry, idx) => {
        return idx % 2 === 0
          ? `🐼  ${entry}`
          : `🤖  ${entry}`;
      }).join('\n\n');

      // New follow-up with classification and reflection guidance
      const newPrompt = `${question}

      Interpret the type of follow-up. Is the user asking for clarification, adjusting constraints, or requesting next steps? You don't need to report the type — just use it to guide your response.

      Reflect on the full history so far. Has the user's objective evolved or become clearer? Adjust your response accordingly.

      Continue the conversation naturally.`;

      const fullPrompt = `${formattedHistory}\n\n${newPrompt}`;

      try {
        const res = await fetch('/api/gpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: fullPrompt }),
        });

        const data = await res.json();

        // Append new question and GPT response to conversation history
        const updatedHistory = [...conversationHistory, question, data.result];
        setConversationHistory(updatedHistory);

        // Update session with new conversation
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
    {showIntentInput && conversationHistory.length === 0 && (

      <div className="absolute top-4 inset-x-4 z-40 pointer-events-none">
        <div className="flex justify-between items-start w-full mx-auto pointer-events-auto">

          {/* MAP TYPE */}
          <div className="flex w-auto justify-start">
            <div className="p-2 space-x-2 backdrop-blur-xs bg-white/80 shadow-lg rounded-full w-fit z-40">
              {['roadmap', 'terrain', 'satellite'].map((type) => (
                <button
                  key={type}
                  onClick={() => setMapType(type)}
                  className={`px-4 py-2 text-sm font-medium ${
                    mapType === type ? 'bg-stone-200 text-black rounded-full' : 'text-gray-700 hover:bg-black hover:text-white hover:rounded-full'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* INPUT MODE*/}
          <div className="flex w-auto justify-center">
              <InputMode inputMode={inputMode} setInputMode={setInputMode} />
          </div>

          {/* QUESTION BOX */}
          <div className="flex justify-stretch">
              <IntentInput
                intent={intent}
                setIntent={setIntent}
                onAnalyze={analyzePlaces}
              />
          </div>

          {/* DISPLAY PAST SESSIONS */}
          <div className="flex w-auto justify-end">
            {!loading && pastSessions.length > 0 && (
              <RecentSessions 
                pastSessions={pastSessions} 
                onResume={resumeSession} 
                onDelete={handleDeleteSession}
              />
            )}
          </div>
        </div>
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
            handleMapLoad={handleMapLoad} // pass to MapPanel
            sessionLocked={isSessionLocked}
            mapType={mapType}
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
            />
          </div>
        </div>
              )}

      {/* FAB stays visible */}
      {conversationHistory.length > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 flex justify-center w-full max-w-md">
          <div className="shadow-lg">
            <FAB
              onClick={() => {
                clearMemory();
                setShowIntentInput(true);
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