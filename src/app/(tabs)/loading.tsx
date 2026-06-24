export default function TabsLoading() {
  return (
    <section className="grid gap-5">
      <div className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <div className="h-3 w-28 rounded-full bg-[var(--accent-soft)]" />
        <div className="mt-5 h-8 w-64 max-w-full rounded-full bg-[#f5f5f7]" />
        <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-[#f5f5f7]" />
        <div className="mt-2 h-4 w-4/5 max-w-xl rounded-full bg-[#f5f5f7]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-44 rounded-[26px] bg-white shadow-sm ring-1 ring-black/[0.06]" />
        <div className="h-44 rounded-[26px] bg-white shadow-sm ring-1 ring-black/[0.06]" />
      </div>
    </section>
  );
}
