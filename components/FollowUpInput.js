import { useState } from 'react';
import { BiUpArrowAlt } from 'react-icons/bi';

export default function FollowUpInput({ onSubmit }) {
  const [followUp, setFollowUp] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (followUp.trim()) {
      onSubmit(followUp.trim());
      setFollowUp('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="fixed bottom-[5vh] left-1/2 transform -translate-x-1/2 z-20 bg-white shadow-md px-4 py-2 rounded-xl max-w-2xl w-full flex items-center space-x-2">
      <input
        type="text"
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
        placeholder="Ask a follow-up..."
        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition h-full"
      >
        Send
      </button>
    </form>
  );
}