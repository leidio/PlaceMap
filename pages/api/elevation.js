export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat/lng' });
  }

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'Missing Google Maps API key' });
  }

  try {
    const elevationRes = await fetch(
      `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    const data = await elevationRes.json();

    if (!data.results || !data.results[0]) {
      return res.status(500).json({ error: 'No elevation data returned' });
    }

    return res.status(200).json({ elevation: data.results[0].elevation });
  } catch (error) {
    console.error('Elevation API error:', error);
    return res.status(500).json({ error: 'Failed to fetch elevation' });
  }
}
