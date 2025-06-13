export default function Sidebar({ intent, setIntent, clickedPlaces, onAnalyze, onClear }) {
  return (
    <div className="w-[25%] p-4 space-y-4 border-r border-gray-200 overflow-y-auto bg-white">
      {/* Intent */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Intent</h3>
        <textarea
          rows={1}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g. Find forested areas near water for a hiking route..."
          className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Memory */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">&nbsp;</h3>
        <ul className="text-sm space-y-2">
          {clickedPlaces.map((p, i) => (
            <li key={i} className="text-gray-800">
              📍 {p.description} ({p.terrain}, {p.elevation}m)
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={onAnalyze} className="btn-primary">
          What's here?
        </button>
         <br />
        <button onClick={onClear} className="btn-secondary">
          Clear Memory
        </button>
      </div>
    </div>
  );
}
