export default function FAB({ onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-500 ease-in-out
 ${className}`}
    >
      Select a new place
    </button>
  );
}
