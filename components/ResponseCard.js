import { useEffect, useRef, useState } from 'react';
import { BiUpArrowAlt } from 'react-icons/bi';

export default function ResponseCard({ intent, conversationHistory, onFollowUp }) {
  const [followUp, setFollowUp] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  if (conversationHistory.length === 0) return null;

  const messagePairs = [];
  for (let i = 0; i < conversationHistory.length; i += 2) {
    const question = conversationHistory[i];
    const answer = conversationHistory[i + 1];
    messagePairs.push({ question, answer });
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto bg-transparent flex-grow px-4 pt-4 pb-6 text-sm text-gray-800"
    >
      <h3 className="text-base font-semibold mb-2">{intent}</h3>

      {messagePairs.map((pair, i) => (
        <div key={i} className="mt-4 border-t pt-4 whitespace-pre-line">
          {i > 0 && (
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {pair.question}
            </h3>
          )}
          <p>{pair.answer.replace(/^\u{1f43c}\s+|^\u{1f916}\s+/u, '')}</p>
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
        className="mt-8 flex gap-2 items-center"
      >
        <input
          type="text"
          placeholder="Ask a follow-up..."
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          className="flex-grow h-10 px-3 border focus:border-black rounded-full text-sm"
        />
        <button
          type="submit"
          className="h-10 w-10 flex items-center justify-center bg-stone-200 text-black hover:bg-black hover:text-white rounded-lg"
        >
          <BiUpArrowAlt className="text-current" size={20} />
        </button>
      </form>
    </div>
  );
}