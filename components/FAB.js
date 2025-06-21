export default function FAB({ onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`bg-civicGreen text-black px-4 py-2 rounded-full shadow-lg hover:bg-black hover:text-white transition-all duration-500 ease-in-out
 ${className}`}
    >
      Select a new place
    </button>
  );
}
