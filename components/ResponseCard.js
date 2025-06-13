export default function ResponseCard({ response }) {
  if (!response) return null;

  return (
    <div className="whitespace-pre-line bg-civicGray p-4 rounded-md shadow-card text-sm">
      {response}
    </div>
  );
}
