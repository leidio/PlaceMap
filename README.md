“Stage 5 — 

1. 🌍 Elevation & Terrain Data (per location)
Query the Google Elevation API for each lat/lng

Heuristically label terrain (e.g. alpine, valley, lakeside)

2. 🧮 Proximity Analysis
Calculate distances between locations

Identify clusters or spatial patterns (e.g. “all within 30km”)

3. 📦 Structured Prompt Format
Frame GPT input with:

Place name + elevation

Terrain category

Distance pattern across points

User's stated intent"
