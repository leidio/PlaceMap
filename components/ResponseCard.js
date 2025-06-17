import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function ResponseCard({ intent, conversationHistory, onFollowUp }) {
  const [expanded, setExpanded] = useState(false);
  const [followUp, setFollowUp] = useState('');

  useEffect(() => {
    if (conversationHistory.length > 0) setExpanded(true);
  }, [conversationHistory]);

  if (conversationHistory.length === 0) return null;

  const toggle = () => setExpanded((prev) => !prev);

  const messagePairs = [];
    for (let i = 0; i < conversationHistory.length; i += 2) {
      const question = conversationHistory[i];
      const answer = conversationHistory[i + 1];
      messagePairs.push({ question, answer });
    }

  return (
    <div className="w-full bg-white border border-gray-200 text-sm rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className="flex items-center justify-center w-full px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            Hide <ChevronDown className="ml-2 h-4 w-4" />
          </>
        ) : (
          <>
            See response <ChevronUp className="ml-2 h-4 w-4" />
          </>
        )}
      </button>

      <div
        className={`transition-all duration-500 ease-in-out w-full ${
          expanded ? 'max-h-[25vh]' : 'max-h-0'
        }`}
      >
        <div className="overflow-y-auto h-full max-h-[25vh] px-4 pt-4 pb-6">
          <h3 className="text-base font-semibold mb-2">{intent}</h3>
{messagePairs.map((pair, i) => (
  <div key={i} className="mt-4 border-t pt-4 text-gray-800 whitespace-pre-line">
    {/* Only show follow-up questions (skip the first one) */}
    {i > 0 && (
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {pair.question}
      </h3>
    )}
    <p>{pair.answer}</p>
  </div>
))}

      <form
      onSubmit={(e) => {
        e.preventDefault();
        if (followUp.trim()) {
          onFollowUp(followUp);
          setFollowUp('');
        }
      }}
      className="mt-4 flex gap-2 items-center"
    >
      <input
        type="text"
        placeholder="Ask a follow-up..."
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
        className="flex-grow p-2 border rounded-md text-sm"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-md"
      >
        Send
      </button>
    </form>
        </div>
      </div>
    </div>
  );
}