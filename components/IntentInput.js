export default function IntentInput({ intent, setIntent, onAnalyze }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20 w-[90%] max-w-xl backdrop-blur-sm bg-white/80 rounded-full shadow-lg px-4 py-2 flex items-center space-x-2"
    >
      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="What do you want to know?"
        className="bg-transparent focus:outline-none w-full text-gray-900 placeholder-gray-400"
      />
      <button
        type="submit"
        className="btn-primary text-sm px-4 py-2 !rounded-full"
      >
        Submit
      </button>
    </form>
  );
}