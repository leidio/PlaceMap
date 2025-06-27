import React from 'react';

export default function InterpretabilityModal({ isOpen, onClose, promptText }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black text-sm"
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold mb-4">How this was interpreted</h2>
        <pre className="text-xs bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">
          {promptText}
        </pre>
      </div>
    </div>
  );
}