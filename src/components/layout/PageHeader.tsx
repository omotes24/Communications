export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 border-b border-black/[0.08] pb-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
        QuestionTurbo
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-base font-medium leading-8 text-[#6e6e73]">
        {description}
      </p>
    </div>
  );
}
