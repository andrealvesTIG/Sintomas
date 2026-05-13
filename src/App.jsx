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
    data: todayISO(),
    vomito: false,
    dor_cabeca: false,
    dor_barriga: false,
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
      dorBarriga: filteredEntries.filter((e) => e.dor_barriga).length
    };
  }, [filteredEntries]);

  async function saveEntry(e) {
    e.preventDefault();

    const hasSymptom =
      form.vomito || form.dor_cabeca || form.dor_barriga || form.notas.trim();

    if (!hasSymptom) return;

    setSaving(true);
    setError("");

    await supabase.from(TABLE_NAME).delete().eq("data", form.data);

    const { error } = await supabase.from(TABLE_NAME).insert({
      data: form.data,
      vomito: form.vomito,
      dor_cabeca: form.dor_cabeca,
      dor_barriga: form.dor_barriga,
      intensidade: form.intensidade,
      notas: form.notas.trim()
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
    const header = [
      "data",
      "vomito",
      "dor_cabeca",
      "dor_barriga",
      "intensidade",
      "notas"
    ];

    const rows = entries
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((e) => [
        e.data,
        e.vomito ? "sim" : "nao",
        e.dor_cabeca ? "sim" : "nao",
        e.dor_barriga ? "sim" : "nao",
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
                Regista os dias com vómitos, dor de cabeça e dor de barriga.
              </p>
            </div>
            <div style={{ fontSize: 48 }}>📅</div>
          </div>
        </motion.header>

        {error && <div className="error">⚠️ {error}</div>}

        <section className="grid-stats">
          <StatCard label="Dias registados" value={stats.dias} />
          <StatCard label="Vómitos" value={stats.vomito} />
          <StatCard label="Dor de cabeça" value={stats.dorCabeca} />
          <StatCard label="Dor de barriga" value={stats.dorBarriga} />
        </section>

        <section className="grid-main">
          <div className="card">
            <h2>＋ Novo registo</h2>

            <form onSubmit={saveEntry}>
              <label className="field">
                <span>Data</span>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) =>
                    setForm({ ...form, data: e.target.value })
                  }
                />
              </label>

              <div className="symptoms">
                <Checkbox
                  label="Vomitou"
                  checked={form.vomito}
                  onChange={(v) => setForm({ ...form, vomito: v })}
                />

                <Checkbox
                  label="Dor de cabeça"
                  checked={form.dor_cabeca}
                  onChange={(v) => setForm({ ...form, dor_cabeca: v })}
                />

                <Checkbox
                  label="Dor de barriga"
                  checked={form.dor_barriga}
                  onChange={(v) => setForm({ ...form, dor_barriga: v })}
                />
              </div>

              <label className="field">
                <span>Intensidade geral</span>
                <select
                  value={form.intensidade}
                  onChange={(e) =>
                    setForm({ ...form, intensidade: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, notas: e.target.value })
                  }
                  placeholder="Ex.: depois do almoço, febre, medicamento, duração..."
                  rows="4"
                />
              </label>

              <button className="btn" type="submit" disabled={saving}>
                {saving ? "A guardar..." : "Guardar registo"}
              </button>
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
              <button className="btn secondary" onClick={loadEntries}>
                ↻ Atualizar
              </button>

              <button className="btn secondary" onClick={exportCSV}>
                ↓ CSV
              </button>
            </div>

            {loading ? (
              <p className="muted">A carregar registos...</p>
            ) : filteredEntries.length === 0 ? (
              <p className="muted">Ainda não há registos neste mês.</p>
            ) : (
              filteredEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onDelete={deleteEntry}
                />
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
    <div className="card">
      <p className="muted">{label}</p>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="check">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function EntryCard({ entry, onDelete }) {
  const symptoms = [
    entry.vomito && "Vómitos",
    entry.dor_cabeca && "Dor de cabeça",
    entry.dor_barriga && "Dor de barriga"
  ].filter(Boolean);

  return (
    <div className="entry">
      <div className="entry-top">
        <div>
          <strong>
            {new Date(entry.data + "T00:00:00").toLocaleDateString("pt-PT")}
          </strong>
          <p className="muted">{symptoms.join(" · ")}</p>
          <p className="muted">Intensidade: {entry.intensidade}</p>
        </div>

        <button className="btn danger" onClick={() => onDelete(entry.id)}>
          🗑️
        </button>
      </div>

      {entry.notas && <div className="note">{entry.notas}</div>}
    </div>
  );
}
