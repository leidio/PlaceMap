
import React from "react";
import { BiMap, BiPen } from "react-icons/bi";

export default function InputMode({ inputMode, setInputMode }) {
  return (
    <div className="flex items-center space-x-2 py-2 px-2 backdrop-blur-sm bg-white/80 shadow-lg rounded-full">
          <button
            className={`flex items-center gap-2 px-4 rounded-full h-full hover:bg-black hover:text-white ${
              inputMode === "click" ? "bg-stone-200 text-black" : "text-gray-700"
            }`}
            onClick={() => setInputMode("click")}
          >
            <BiMap size={16} />
            Click
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-full h-full hover:bg-black hover:text-white ${
              inputMode === "draw" ? "bg-stone-200 text-black" : "text-gray-700"
            }`}
            onClick={() => setInputMode("draw")}
          >
            <BiPen size={16} />
            Draw
          </button>
        </div>
  );
}