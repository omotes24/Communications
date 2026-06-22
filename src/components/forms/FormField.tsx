export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold tracking-tight text-[#1d1d1f]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClassName =
  "min-h-11 rounded-2xl border border-black/[0.08] bg-white px-4 py-2.5 text-sm text-[#1d1d1f] outline-none shadow-sm transition placeholder:text-[#86868b] focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10";

export const textareaClassName =
  "min-h-36 rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-sm leading-7 text-[#1d1d1f] outline-none shadow-sm transition placeholder:text-[#86868b] focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10";
