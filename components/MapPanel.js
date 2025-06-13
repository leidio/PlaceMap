import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: 46.8182,
  lng: 8.2275,
};

export default function MapPanel({ clickedPlaces, handleMapClick, center = defaultCenter }) {
  return (
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
  );
}
