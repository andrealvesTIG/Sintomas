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
      form
