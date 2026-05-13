import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";

const SUPABASE_URL = "https://fvguretvvakyzrnwbair.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8Kb6XVRfxwyy_YGNfbJWgQ_A3Q38Lso";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE_NAME = "registo_sintomas";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    id: null,
    data: todayISO(),
    vomito: false,
    dor_cabeca: false,
    dor_barriga: false,
    sonolencia: false,
    intensidade: "leve",
    notas: ""
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
    return {
      dias: filteredEntries.length,
      vomito: filteredEntries.filter((e) => e.vomito).length,
      dorCabeca: filteredEntries.filter((e) => e.dor_cabeca).length,
      dorBarriga: filteredEntries.filter((e) => e.dor_barriga).length,
      sonolencia: filteredEntries.filter((e) => e.sonolencia).length
    };
  }, [filteredEntries]);

  function startEdit(entry) {
    setForm({
      id: entry.id,
      data: entry.data,
      vomito: Boolean(entry.vomito),
      dor_cabeca: Boolean(entry.dor_cabeca),
      dor_barriga: Boolean(entry.dor_barriga),
      sonolencia: Boolean(entry.sonolencia),
      intensidade: entry.intensidade || "leve",
      notas: entry.notas || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(emptyForm());
    setError("");
  }

  async function saveEntry(e) {
    e.preventDefault();

    const hasSymptom =
      form.vomito ||
      form.dor_cabeca ||
      form.dor_barriga ||
      form.sonolencia ||
      form.notas.trim();

    if (!hasSymptom) return;

    setSaving(true);
    setError("");

    const payload = {
      data: form.data,
      vomito: form.vomito,
      dor_cabeca: form.dor_cabeca,
      dor_barriga: form.dor_barriga,
      sonolencia: form.sonolencia,
      intensidade: form.intensidade,
      notas: form.notas.trim()
    };

    let result;

    if (form.id) {
      result = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", form.id);
    } else {
      result = await supabase
        .from(TABLE_NAME)
        .upsert(payload, { onConflict: "data" });
    }

    if (result.error) {
      setError(result.error.message);
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
      if (form.id === id) setForm(emptyForm());
    }
  }

  function exportCSV() {
    const header = [
      "data",
      "vomito",
      "dor_cabeca",
      "dor_barriga",
      "sonolencia",
      "intensidade",
      "notas"
    ];

    const rows = [...entries]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((e) => [
        e.data,
        e.vomito ? "sim" : "nao",
        e.dor_cabeca ? "sim" : "nao",
        e.dor_barriga ? "sim" : "nao",
        e.sonolencia ? "sim" : "nao",
        e.intensidade,
        `"${String(e.notas || "").replaceAll('"', '""')}"`
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
    <main className="page">
      <div className="container">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="header"
        >
          <div className="header-row">
            <div>
              <p className="muted">Uso interno · tabela online Supabase</p>
              <h1>Registo de sintomas</h1>
              <p className="muted">
                Regista os dias com vómitos, dor de cabeça, dor de barriga e sonolência.
              </p>
            </div>
            <div className="header-icon">📅</div>
          </div>
        </motion.header>

        {error && <div className="error">⚠️ {error}</div>}

        <section className="grid-stats">
          <StatCard label="Dias registados" value={stats.dias} />
          <StatCard label="Vómitos" value={stats.vomito} />
          <StatCard label="Dor de cabeça" value={stats.dorCabeca} />
          <StatCard label="Dor de barriga" value={stats.dorBarriga} />
          <StatCard label="Sonolência" value={stats.sonolencia} />
        </section>

        <section className="grid-main">
          <div className="card">
            <h2>{form.id ? "✎ Editar registo" : "＋ Novo registo"}</h2>

            <form onSubmit={saveEntry}>
              <label className="field">
                <span>Data</span>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </label>

              <div className="symptoms">
                <Checkbox label="Vomitou" checked={form.vomito} onChange={(v) => setForm({ ...form, vomito: v })} />
                <Checkbox label="Dor de cabeça" checked={form.dor_cabeca} onChange={(v) => setForm({ ...form, dor_cabeca: v })} />
                <Checkbox label="Dor de barriga" checked={form.dor_barriga} onChange={(v) => setForm({ ...form, dor_barriga: v })} />
                <Checkbox label="Sonolência" checked={form.sonolencia} onChange={(v) => setForm({ ...form, sonolencia: v })} />
              </div>

              <label className="field">
                <span>Intensidade geral</span>
                <select
                  value={form.intensidade}
                  onChange={(e) => setForm({ ...form, intensidade: e.target.value })}
                >
                  <option value="leve">Leve</option>
                  <option value="moderada">Moderada</option>
                  <option value="forte">Forte</option>
                </select>
              </label>

              <label className="field">
                <span>Notas</span>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Ex.: depois do almoço, febre, medicamento, duração..."
                  rows="4"
                />
              </label>

              <div className="actions">
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? "A guardar..." : form.id ? "Guardar alterações" : "Guardar registo"}
                </button>

                {form.id && (
                  <button className="btn secondary" type="button" onClick={cancelEdit}>
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h2>📊 Histórico</h2>

            <label className="field">
              <span>Mês</span>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />
            </label>

            <div className="actions">
              <button className="btn secondary" type="button" onClick={loadEntries}>↻ Atualizar</button>
              <button className="btn secondary" type="button" onClick={exportCSV}>↓ CSV</button>
            </div>

            {loading ? (
              <p className="muted">A carregar registos...</p>
            ) : filteredEntries.length === 0 ? (
              <p className="empty-state">Ainda não há registos neste mês.</p>
            ) : (
              filteredEntries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onEdit={startEdit} onDelete={deleteEntry} />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <p className="muted">{label}</p>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="check">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function EntryCard({ entry, onEdit, onDelete }) {
  const symptoms = [
    entry.vomito && "Vómitos",
    entry.dor_cabeca && "Dor de cabeça",
    entry.dor_barriga && "Dor de barriga",
    entry.sonolencia && "Sonolência"
  ].filter(Boolean);

  return (
    <div className="entry">
      <div className="entry-top">
        <div>
          <strong>{new Date(entry.data + "T00:00:00").toLocaleDateString("pt-PT")}</strong>
          <p className="muted">{symptoms.join(" · ") || "Sem sintomas assinalados"}</p>
          <p className="muted">Intensidade: {entry.intensidade}</p>
        </div>

        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => onEdit(entry)}>Editar</button>
          <button className="btn danger" type="button" onClick={() => onDelete(entry.id)}>🗑️</button>
        </div>
      </div>

      {entry.notas && <div className="note">{entry.notas}</div>}
    </div>
  );
}
