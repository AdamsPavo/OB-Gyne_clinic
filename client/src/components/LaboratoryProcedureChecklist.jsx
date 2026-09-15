import { api } from "../api/client";
import { useEffect, useState } from "react";

export default function LaboratoryProcedureChecklist({ items, onToggle, compact = false }) {
  const [laboratoryProcedures, setProcedures] = useState([]);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await api("/laboratory-procedures");
        if (!active) return;
        const groups = [];
        for (const row of rows) {
          let group = groups.find(item => item.category === row.category);
          if (!group) { group = { category: row.category, tests: [] }; groups.push(group); }
          group.tests.push(row.name);
        }
        setProcedures(groups);
        setCategory(current => groups.some(group => group.category === current) ? current : groups[0]?.category || "");
        setError("");
      } catch (err) { if (active) setError(err.message); }
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("laboratory-procedures-changed", load);
    return () => { active = false; window.removeEventListener("focus", load); window.removeEventListener("laboratory-procedures-changed", load); };
  }, []);
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const isSelected = (name) => items.some((item) => item.test_name === name);
  const query = search.trim().toLowerCase();
  const matches = laboratoryProcedures.flatMap((group) =>
    group.tests.filter((name) =>
      (query ? `${name} ${group.category}`.toLowerCase().includes(query) : selectedOnly || group.category === category)
      && (!selectedOnly || isSelected(name)),
    ),
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / 9));
  const currentPage = Math.min(page, pageCount - 1);

  if (error) return <p role="alert" className="mt-3 text-sm text-red-600">Unable to load laboratory procedures: {error}</p>;

  if (compact) return (
    <section aria-label="Laboratory procedure picker" className="mt-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-xs font-semibold text-blue-900">
          Find a procedure
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search all categories, e.g. CBC" className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
        </label>
        <button type="button" aria-pressed={selectedOnly} onClick={() => { setSelectedOnly(!selectedOnly); setPage(0); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${selectedOnly ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}>
          Selected ({items.length})
        </button>
      </div>
      <div className="my-3 flex flex-wrap gap-1.5" aria-label="Procedure categories">
        {laboratoryProcedures.map((group) => {
          const count = group.tests.filter(isSelected).length;
          const active = category === group.category && !query && !selectedOnly;
          return (
            <button key={group.category} type="button" aria-pressed={active} title={group.category} onClick={() => { setCategory(group.category); setSearch(""); setSelectedOnly(false); setPage(0); }} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-800 hover:bg-blue-100"}`}>
              {group.category}{count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
      <p className="mb-2 text-xs font-semibold text-slate-600" aria-live="polite">
        {selectedOnly ? "Selected procedures" : query ? "Search results across all categories" : category} ? {matches.length} procedures
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {matches.slice(currentPage * 9, currentPage * 9 + 9).map((name) => (
          <label key={name} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${isSelected(name) ? "border-blue-300 bg-blue-100 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}>
            <input type="checkbox" checked={isSelected(name)} onChange={() => onToggle(name)} className="h-4 w-4 shrink-0 accent-blue-600" />
            {name}
          </label>
        ))}
      </div>
      {matches.length === 0 && <p className="py-4 text-sm text-slate-500">{selectedOnly ? "No selected procedures match. Choose a category to add tests." : "No matching procedures. Try another name or add an other test below."}</p>}
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-blue-200 px-3 py-1 text-blue-700 disabled:opacity-40">Previous</button>
          <span aria-live="polite">{currentPage + 1} / {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-blue-200 px-3 py-1 text-blue-700 disabled:opacity-40">Next</button>
        </div>
      )}
    </section>
  );

  return (
    <div className="mt-4 space-y-3">
      {laboratoryProcedures.map((group) => (
        <fieldset key={group.category} className="rounded-2xl border border-blue-200 bg-blue-50/30 p-3">
          <legend className="px-1 font-bold text-blue-800">{group.category}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {group.tests.map((testName) => {
              const checked = items.some((item) => item.test_name === testName);
              return (
                <label key={testName} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm transition ${checked ? "border-blue-300 bg-blue-100 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"}`}>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(testName)} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus:ring-blue-500" />
                  <span className="font-medium">{testName}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
