import { useState, useEffect } from "react";

export default function LocationSearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent page reload
    onSearch(query);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-1/2 backdrop-blur-sm bg-white/80 rounded-full shadow-lg pl-4 pr-2 py-2 flex items-center space-x-2"
      style={{ pointerEvents: "auto", zIndex: 999 }}
    >
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search for a location..."
      className="w-full p-2 bg-transparent text-sm"
    />
    <button
        onClick={() => onSearch(query)}
        className="bg-civicGreen text-sm px-4 py-2 hover:bg-black hover:text-white !rounded-full"
      >
        Search
      </button>
    </form>
  );
}
