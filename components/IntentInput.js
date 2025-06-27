import { BiUpArrowAlt } from 'react-icons/bi';

export default function IntentInput({ intent, setIntent, selectedModel, setSelectedModel, onAnalyze }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-[40rem] backdrop-blur-sm bg-white/80 rounded-full shadow-lg pl-4 pr-2 py-2 flex items-center space-x-2 h-full"
    >
      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="What do you want to know?"
        className="bg-transparent focus:outline-none font-medium w-full text-gray-900 placeholder-gray-400"
      />

      <div className="flex gap-2 items-center align-middle'">
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="text-sm rounded-full px-2 py-1"
        >
          <option value="GPT">GPT</option>
          <option value="Claude">Claude</option>
        </select>
      </div>

      <button
        type="submit"
        className="bg-civicGreen text-sm px-4 py-2 hover:bg-black hover:text-white !rounded-full"
      >
        <BiUpArrowAlt className="text-current" size={20} />
      </button>

    </form>
  );
}

