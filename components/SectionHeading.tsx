interface Props {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({ children, className = "" }: Props) {
  return (
    <h3 className={`text-xs font-semibold text-gray-400 uppercase tracking-wide ${className}`}>
      {children}
    </h3>
  );
}
