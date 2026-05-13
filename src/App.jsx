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
    tomou_medicacao: false,
    intensidade: "leve",
    notas: ""
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [filterType, setFilterType] = useState("month");
  const [filterMonth, setFilterMonth] = useState(todayISO().slice(0, 7));
  const [filterYear, setFilterYear] = useState(todayISO().slice(0, 4));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setCheckingAuth(false);
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      checkAuthorization(session.user.email);
    } else {
      setIsAuthorized(false);
      setEntries([]);
    }
  }, [session]);

  useEffect(() => {
    if (isAuthorized) {
      loadEntries();
    }
  }, [isAuthorized]);

  async function checkAuthorization(email) {
    setError("");

    const { data, error } = await supabase
      .from("utilizadores_autorizados")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setIsAuthorized(false);
      return;
    }

    setIsAuthorized(Boolean(data));
  }

  async function signInWithEmail(e) {
    e.preventDefault();
    setError("");
    setLoginSent(false);
    setLoginLoading(true);

    const email = loginEmail.trim().toLowerCase();

    if (!email) {
      setError("Introduz um email válido.");
      setLoginLoading(false);
      return;
    }

    const { data: allowedEmail, error: allowedError } = await supabase
      .from("utilizadores_autorizados")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (allowedError) {
      setError(allowedError.message);
      setLoginLoading(false);
      return;
    }

    if (!allowedEmail) {
      setError("Este email não está autorizado a usar a aplicação.");
      setLoginLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setLoginSent(true);
    }

    setLoginLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setForm(emptyForm());
    setEntries([]);
    setError("");
  }

  async function loadEntries() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("data", { ascending: false });

    if (error) setError(error.message);
    else setEntries(data || []);

    setLoading(false);
  }

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (filterType === "year") {
          return e.data?.startsWith(filterYear);
        }

        return e.data?.startsWith(filterMonth);
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [entries, filterMonth, filterYear, filterType]);

  const stats = useMemo(() => {
    return {
      dias: filteredEntries.length,
      vomito: filteredEntries.filter((e) => e.vomito).length,
      dorCabeca: filteredEntries.filter((e) => e.dor_cabeca).length,
      dorBarriga: filteredEntries.filter((e) => e.dor_barriga).length,
      sonolencia: filteredEntries.filter((e) => e.sonolencia).length
    };
  }, [filteredEntries]);

  const yearlyEntries = useMemo(() => {
    return entries.filter((e) => e.data?.startsWith(filterYear));
  }, [entries, filterYear]);

  const monthlyChartData = useMemo(() => {
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez"
    ];

    return months.map((label, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");
      const count = yearlyEntries.filter((e) => e.data?.slice(5, 7) === monthNumber).length;
      return { label, count };
    });
  }, [yearlyEntries]);

  const frequencyAnalysis = useMemo(() => {
    if (yearlyEntries.length === 0) {
      return {
        lastEpisodeText: "Sem registos neste ano.",
        frequencyText: "Ainda não há dados suficientes para avaliar frequência.",
        patternText: "Quando existirem mais registos, a app ajuda a perceber se há meses com maior concentração."
      };
    }

    const sorted = [...yearlyEntries].sort((a, b) => a.data.localeCompare(b.data));
    const last = sorted[sorted.length - 1];
    const daysSinceLast = Math.floor((new Date(todayISO()) - new Date(last.data)) / (1000 * 60 * 60 * 24));
    const averagePerMonth = yearlyEntries.length / 12;
    const maxMonth = monthlyChartData.reduce((max, item) => (item.count > max.count ? item : max), monthlyChartData[0]);

    let frequencyText = "Frequência baixa no ano selecionado.";
    if (averagePerMonth >= 2) {
      frequencyText = "Frequência elevada: em média há 2 ou mais registos por mês no ano selecionado.";
    } else if (averagePerMonth >= 1) {
      frequencyText = "Frequência moderada: em média há pelo menos 1 registo por mês no ano selecionado.";
    }

    return {
      lastEpisodeText: `Último registo: ${new Date(last.data + "T00:00:00").toLocaleDateString("pt-PT")} (${daysSinceLast} dias atrás).`,
      frequencyText,
      patternText: maxMonth.count > 0 ? `Mês com mais registos: ${maxMonth.label}, com ${maxMonth.count} registo(s).` : "Sem padrão mensal visível."
    };
  }, [yearlyEntries, monthlyChartData]);

  function startEdit(entry) {
    setForm({
      id: entry.id,
      data: entry.data,
      vomito: Boolean(entry.vomito),
      dor_cabeca: Boolean(entry.dor_cabeca),
      dor_barriga: Boolean(entry.dor_barriga),
      sonolencia: Boolean(entry.sonolencia),
      tomou_medicacao: Boolean(entry.tomou_medicacao),
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
      form.tomou_medicacao ||
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
      tomou_medicacao: form.tomou_medicacao,
      intensidade: form.intensidade,
      notas: form.notas.trim()
    };

    let error;

    if (form.id) {
      const result = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", form.id);

      error = result.error;
    } else {
      const result = await supabase
        .from(TABLE_NAME)
        .upsert(payload, { onConflict: "data" });

      error = result.error;
    }

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
      "tomou_medicacao",
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
        e.tomou_medicacao ? "sim" : "nao",
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

  if (checkingAuth) {
    return (
      <main className="page">
        <div className="container">
          <div className="card">
            <h2>A verificar autenticação...</h2>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page">
        <div className="background-decoration one" />
        <div className="background-decoration two" />

        <div className="container auth-container">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="header auth-card"
          >
            <div className="header-icon">🩺</div>
            <p className="eyebrow">Acesso privado</p>
            <h1>Registo de sintomas</h1>
            <p className="muted">
              Introduz um dos emails autorizados. Vais receber um link de entrada no email.
            </p>

            {error && <div className="error">⚠️ {error}</div>}

            {loginSent && (
              <div className="success">
                Link enviado. Abre o email no mesmo dispositivo e clica no link para entrar.
              </div>
            )}

            <form onSubmit={signInWithEmail} className="auth-form">
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  autoComplete="email"
                />
              </label>

              <button className="btn" type="submit" disabled={loginLoading}>
                {loginLoading ? "A enviar..." : "Enviar link de entrada"}
              </button>
            </form>
          </motion.div>
        </div>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="page">
        <div className="background-decoration one" />
        <div className="background-decoration two" />

        <div className="container auth-container">
          <div className="header auth-card">
            <div className="header-icon">🔒</div>
            <p className="eyebrow">Sem autorização</p>
            <h1>Acesso bloqueado</h1>
            <p className="muted">
              A conta {session.user.email} não está autorizada a usar esta aplicação.
            </p>
            {error && <div className="error">⚠️ {error}</div>}
            <button className="btn secondary" type="button" onClick={signOut}>
              Sair
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="background-decoration one" />
      <div className="background-decoration two" />

      <div className="container">
        <div className="topbar">
          <span>{session.user.email}</span>
          <button className="btn secondary compact" type="button" onClick={signOut}>
            Sair
          </button>
        </div>

        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="header"
        >
          <div className="header-row">
            <div>
              <p className="eyebrow">Uso interno · tabela online Supabase</p>
              <h1>Registo de sintomas</h1>
              <p className="muted">
                Sessão iniciada como {session.user.email}. Regista os dias com vómitos,
                dor de cabeça, dor de barriga e sonolência.
              </p>
            </div>
            <div className="header-icon">🩺</div>
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
            <div className="section-title">
              <span className="section-icon">{form.id ? "✎" : "＋"}</span>
              <h2>{form.id ? "Editar registo" : "Novo registo"}</h2>
            </div>

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
                <Checkbox label="Tomou medicação" checked={form.tomou_medicacao} onChange={(v) => setForm({ ...form, tomou_medicacao: v })} />
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
            <div className="section-title">
              <span className="section-icon">📊</span>
              <h2>Histórico</h2>
            </div>

            <div className="filter-grid">
              <label className="field">
                <span>Visualização</span>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="month">Mensal</option>
                  <option value="year">Anual</option>
                </select>
              </label>

              {filterType === "month" ? (
                <label className="field">
                  <span>Mês</span>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                  />
                </label>
              ) : (
                <label className="field">
                  <span>Ano</span>
                  <input
                    type="number"
                    min="2020"
                    max="2100"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="actions">
              <button className="btn secondary" type="button" onClick={loadEntries}>↻ Atualizar</button>
              <button className="btn secondary" type="button" onClick={exportCSV}>↓ CSV</button>
            </div>

            {loading ? (
              <p className="empty-state">A carregar registos...</p>
            ) : filteredEntries.length === 0 ? (
              <p className="empty-state">Ainda não há registos neste mês.</p>
            ) : (
              filteredEntries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onEdit={startEdit} onDelete={deleteEntry} />
              ))
            )}
          </div>
        </section>

        <section className="card analysis-card">
          <div className="section-title">
            <span className="section-icon">📈</span>
            <h2>Análise anual</h2>
          </div>

          <p className="muted">
            Esta análise usa o ano selecionado no filtro do histórico: {filterYear}.
          </p>

          <div className="chart">
            {monthlyChartData.map((item) => {
              const max = Math.max(...monthlyChartData.map((month) => month.count), 1);
              const height = Math.max((item.count / max) * 140, item.count > 0 ? 12 : 4);

              return (
                <div className="chart-item" key={item.label}>
                  <div className="chart-value">{item.count}</div>
                  <div className="chart-bar-wrap">
                    <div className="chart-bar" style={{ height: `${height}px` }} />
                  </div>
                  <div className="chart-label">{item.label}</div>
                </div>
              );
            })}
          </div>

          <div className="analysis-grid">
            <div className="analysis-box">
              <strong>Último episódio</strong>
              <p>{frequencyAnalysis.lastEpisodeText}</p>
            </div>
            <div className="analysis-box">
              <strong>Frequência</strong>
              <p>{frequencyAnalysis.frequencyText}</p>
            </div>
            <div className="analysis-box">
              <strong>Padrão possível</strong>
              <p>{frequencyAnalysis.patternText}</p>
            </div>
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
      <div className="stat-bar" />
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
    entry.sonolencia && "Sonolência",
    entry.tomou_medicacao && "Tomou medicação"
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
          <button className="btn danger" type="button" onClick={() => onDelete(entry.id)}>Apagar</button>
        </div>
      </div>

      {entry.notas && <div className="note">{entry.notas}</div>}
    </div>
  );
}
