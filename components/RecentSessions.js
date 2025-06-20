import { useState } from "react";
import { BiTrash } from "react-icons/bi";
import { ChevronUp, ChevronDown } from "lucide-react";

export default function RecentSessions({ pastSessions, onResume, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  if (pastSessions.length === 0) return null;

  return (
    <>
      {expanded ? (
        <div className="backdrop-blur-sm bg-white/80 shadow-lg rounded-lg z-30 w-full max-w-xs max-h-[calc(100vh_-_8rem)] overflow-y-auto">
          <div className="flex justify-between items-center px-4 pt-4 pb-2">
            <h4 className="font-semibold text-sm pb-2 text-gray-800">Recent Sessions</h4>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600"
              title="Collapse"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <ul className="px-4 pb-4 space-y-2">
            {pastSessions.map((session) => (
              <li key={session.id} className="relative">
                <div
                  onClick={() => onResume(session)}
                  className="cursor-pointer w-full text-left p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onResume(session);
                  }}
                >
                  <h4 className="font-medium text-sm text-gray-800 truncate">{session.intent}</h4>
                  {session.conversationHistory?.[1] && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {session.conversationHistory[1].slice(0, 100)}...
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                    <span>{new Date(session.timestamp).toLocaleDateString()}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent triggering resume
                        onDelete(session.id);
                      }}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Delete session"
                    >
                      <BiTrash className="text-base" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
      <div className="backdrop-blur-sm bg-white/80 shadow-lg rounded-lg z-30 w-full max-w-xs">
        <div className="flex justify-between items-center space-x-2 px-4 pt-4 pb-2">
            <h4 className="font-medium text-sm pb-2 text-gray-800">Recent Sessions</h4>
            <button
              onClick={() => setExpanded(true)}
              className="text-gray-400 hover:text-gray-600"
              title="Expand"
            >
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
        </div>
      </div>  
      )}
    </>
  );
}