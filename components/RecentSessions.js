export default function RecentSessions({ pastSessions, onResume, onDelete }) {
  if (pastSessions.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-200 shadow-lg rounded-lg p-4 z-30 max-w-xs w-full">
      <h4 className="font-semibold text-sm mb-2 text-gray-800">Recent Sessions</h4>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {pastSessions.map((session) => (
          <li key={session.id} className="relative">
            {/* Resume session button */}
            <button
              onClick={() => onResume(session)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            >
              <h4 className="font-semibold text-sm text-gray-800 truncate">{session.intent}</h4>
              {session.conversationHistory?.[1] && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {session.conversationHistory[1].slice(0, 100)}...
                </p>
              )}
              {/* Show timestamp */}
              {session.timestamp && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(session.timestamp).toLocaleDateString()}
                </p>
              )}
            </button>

            {/* Delete session button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the resume button
                onDelete(session.id);
              }}
              className="absolute top-2 right-2 text-gray-400 hover:text-red-600 z-10"
              aria-label="Delete session"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}