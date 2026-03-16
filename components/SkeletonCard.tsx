interface Props {
  titleWidth?: string;
  lineWidths?: [string, string];
}

export function SkeletonCard({
  titleWidth = "w-3/4",
  lineWidths = ["w-full", "w-5/6"],
}: Props) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className={`h-4 bg-gray-200 rounded ${titleWidth} mb-3`} />
      <div className={`h-3 bg-gray-100 rounded ${lineWidths[0]} mb-1.5`} />
      <div className={`h-3 bg-gray-100 rounded ${lineWidths[1]}`} />
    </div>
  );
}
