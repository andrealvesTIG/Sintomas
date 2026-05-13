import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";

// 1) Cria um projeto gratuito em https://supabase.com
// 2) Cria a tabela com o SQL no final deste ficheiro
// 3) Substitui estes valores pelos do teu projeto Supabase:
const SUPABASE_URL = "https://fvguretvvakyzrnwbair.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8Kb6XVRfxwyy_YGNfbJWgQ_A3Q38Lso";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE_NAME = "registo_sintomas";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    data: todayISO(),
    vomito: false,
    dor_cabeca: false,
    dor_barriga: false,
    sonolencia: false,
    intensidade: "leve",
    notas: "",
  };
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [filterMonth, setFilterMonth] = useState(todayISO().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("data", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setEntries(data || []);
    }

    setLoading(false);
  }

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => e.data?.startsWith(filterMonth))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [entries, filterMonth]);

  const stats = useMemo(() => {
    const month = filteredEntries;
    return {
      dias: month.length,
      vomito: month.filter((e) => e.vomito).length,
      dorCabeca: month.filter((e) => e.dor_cabeca).length,
      dorBarriga: month.filter((e) => e.dor_barriga).length,
      sonolencia: month.filter((e) => e.sonolencia).length,
    };
  }, [filteredEntries]);

  async function saveEntry(e) {
    e.preventDefault();
    const hasSymptom = form.vomito || form.dor_cabeca || form.dor_barriga || form.sonolencia || form.notas.trim();
    if (!hasSymptom) return;

    setSaving(true);
    setError("");

    // Evita duplicados: apaga primeiro um registo da mesma data e depois cria o novo.
    await supabase.from(TABLE_NAME).delete().eq("data", form.data);

    const { error } = await supabase.from(TABLE_NAME).insert({
      data: form.data,
      vomito: form.vomito,
      dor_cabeca: form.dor_cabeca,
      dor_barriga: form.dor_barriga,
      sonolencia: form.sonolencia,
      intensidade: form.intensidade,
      notas: form.notas.trim(),
    });

    if (error) {
      setError(error.message);
    } else {
      setForm(emptyForm());
      await loadEntries();
    }

    setSaving(false);
  }

  async function deleteEntry(id) {
    setError("");
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
  }

  function exportCSV() {
    const header = ["data", "vomito", "dor_cabeca", "dor_barriga", "sonolencia", "intensidade", "notas"]; 
    const rows = entries
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((e) => [
        e.data,
        e.vomito ? "sim" : "nao",
        e.dor_cabeca ? "sim" : "nao",
        e.dor_barriga ? "sim" : "nao",
        e.sonolencia ? "sim" : "nao",
        e.intensidade,
        `"${String(e.notas || "").replaceAll('"', '""')}"`,
      ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registo-sintomas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Uso interno · dados guardados numa tabela online Supabase</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Registo de sintomas</h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Regista os dias com vómitos, dor de cabeça e dor de barriga. Os dados ficam acessíveis de qualquer dispositivo.
              </p>
            </div>
            <div className="text-5xl" aria-hidden="true">📅</div>
          </div>
        </motion.header>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <span className="mt-0.5 text-lg" aria-hidden="true">⚠️</span>
            <div>
              <p className="font-semibold">Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Dias registados" value={stats.dias} />
          <StatCard label="Vómitos" value={stats.vomito} />
          <StatCard label="Dor de cabeça" value={stats.dorCabeca} />
          <StatCard label="Dor de barriga" value={stats.dorBarriga} />
          <StatCard label="Sonolência" value={stats.sonolencia} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="card"><div>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <span aria-hidden="true">＋</span> Novo registo
              </h2>

              <form onSubmit={saveEntry} className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Data</span>
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-slate-500"
                  />
                </label>

                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <Checkbox label="Vomitou" checked={form.vomito} onChange={(v) => setForm({ ...form, vomito: v })} />
                  <Checkbox label="Dor de cabeça" checked={form.dor_cabeca} onChange={(v) => setForm({ ...form, dor_cabeca: v })} />
                  <Checkbox label="Dor de barriga" checked={form.dor_barriga} onChange={(v) => setForm({ ...form, dor_barriga: v })} />
                  <Checkbox label="Sonolência" checked={form.sonolencia} onChange={(v) => setForm({ ...form, sonolencia: v })} />
                </div>

                <label className="block">
                  <span className="text-sm font-medium">Intensidade geral</span>
                  <select
                    value={form.intensidade}
                    onChange={(e) => setForm({ ...form, intensidade: e.target.value })}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-slate-500"
                  >
                    <option value="leve">Leve</option>
                    <option value="moderada">Moderada</option>
                    <option value="forte">Forte</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Notas</span>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Ex.: depois do almoço, febre, medicamento, duração..."
                    rows={4}
                    className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-slate-500"
                  />
                </label>

                <button type="submit" disabled={saving} className="btn">
                  {saving ? "A guardar..." : "Guardar registo"}
                </button>
              </form>
            </div></div>

          <div className="card"><div>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <span aria-hidden="true">📊</span> Histórico
                </h2>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white p-2 outline-none focus:border-slate-500"
                />
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={loadEntries} className="btn secondary">
                  ↻ Atualizar
                </button>
                <button type="button" onClick={exportCSV} className="btn secondary">
                  ↓ CSV
                </button>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <p className="rounded-2xl bg-slate-100 p-4 text-slate-600">A carregar registos...</p>
                ) : filteredEntries.length === 0 ? (
                  <p className="rounded-2xl bg-slate-100 p-4 text-slate-600">Ainda não há registos neste mês.</p>
                ) : (
                  filteredEntries.map((entry) => <EntryCard key={entry.id} entry={entry} onDelete={deleteEntry} />)
                )}
              </div>
            </div></div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card"><div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold">{value}</p>
      </div></div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-300"
      />
    </label>
  );
}

function EntryCard({ entry, onDelete }) {
  const symptoms = [
    entry.vomito && "Vómitos",
    entry.dor_cabeca && "Dor de cabeça",
    entry.dor_barriga && "Dor de barriga",
    entry.sonolencia && "Sonolência",
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{new Date(entry.data + "T00:00:00").toLocaleDateString("pt-PT")}</p>
          <p className="mt-1 text-sm text-slate-600">{symptoms.join(" · ") || "Sem sintomas assinalados"}</p>
          <p className="mt-1 text-sm text-slate-500">Intensidade: {entry.intensidade}</p>
        </div>
        <button type="button" onClick={() => onDelete(entry.id)} className="btn danger">
          <span aria-hidden="true">🗑️</span>
        </button>
      </div>
      {entry.notas && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{entry.notas}</p>}
    </div>
  );
}
