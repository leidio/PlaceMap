export default function IntentInput({ intent, setIntent, onAnalyze }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20 w-[90%] max-w-md bg-white rounded-full shadow-lg px-4 py-2 flex items-center space-x-2"
    >
      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="e.g. Find forested areas near water for a hiking route..."
        className="flex-1 text-sm outline-none"
      />
      <button
        type="submit"
        className="btn-primary text-sm px-4 py-1 rounded-full"
      >
        Analyze
      </button>
    </form>
  );
}