export default function RecentSessions({ pastSessions, onResume }) {
  if (pastSessions.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-200 shadow-lg rounded-lg p-4 z-30 max-w-xs w-full">
      <h4 className="font-semibold text-sm mb-2 text-gray-800">Recent Sessions</h4>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {pastSessions.map((session, index) => (
  <button
    key={index}
    onClick={() => onResume(session)}
    className="w-full text-left p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 mb-2"
  >
    <h4 className="font-semibold text-sm text-gray-800 truncate">{session.intent}</h4>
    {session.conversationHistory?.[1] && (
      <p className="text-xs text-gray-500 mt-1 truncate">
        {session.conversationHistory[1].slice(0, 100)}...
      </p>
    )}
  </button>
))}
      </ul>
    </div>
  );
}