"use client";

import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";

import { ToastProvider, useToast } from "../../components/Toaster";

type PhoneEntry = { id: string; value: string };

type BookingSlot = {
  id: string;
  startTime: string;
  endTime: string;
  clientName: string;
  address: string;
  phones: PhoneEntry[];
  reason: string;
};

const SLOT_DURATION_MIN = 60;
const TRAVEL_BUFFER_MIN = 30;
const LUNCH_START_MIN = 13 * 60;
const LUNCH_END_MIN = 14 * 60;
const DEFAULT_SLOT_COUNT = 7;

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const t = Math.max(0, total);
  const h = String(Math.floor(t / 60)).padStart(2, "0");
  const m = String(t % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function formatMinutes(total: number): string {
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function buildDefaultTimeSlots(count: number): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  let currentStart = 8 * 60;
  for (let i = 0; i < count; i += 1) {
    while (currentStart >= LUNCH_START_MIN && currentStart < LUNCH_END_MIN) currentStart = LUNCH_END_MIN;
    if (currentStart < LUNCH_START_MIN && currentStart + SLOT_DURATION_MIN > LUNCH_START_MIN) currentStart = LUNCH_END_MIN;
    const start = currentStart;
    const end = start + SLOT_DURATION_MIN;
    slots.push({ start: minutesToTime(start), end: minutesToTime(end) });
    currentStart = end + TRAVEL_BUFFER_MIN;
    if (currentStart > LUNCH_START_MIN && currentStart < LUNCH_END_MIN) currentStart = LUNCH_END_MIN;
  }
  return slots;
}

const INITIAL_TIME_SLOTS = buildDefaultTimeSlots(DEFAULT_SLOT_COUNT);

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPhoneEntry(value = ""): PhoneEntry {
  return { id: generateId("phone"), value };
}

function createSlot(times?: { start: string; end: string }): BookingSlot {
  return {
    id: generateId("slot"),
    startTime: times?.start ?? "",
    endTime: times?.end ?? "",
    clientName: "",
    address: "",
    phones: [createPhoneEntry()],
    reason: "",
  };
}

function normalizePhoneLink(value: string) {
  return value.replace(/[^+0-9]/g, "");
}

function buildMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function PrenotazioniContent() {
  const [slots, setSlots] = useState<BookingSlot[]>(() => INITIAL_TIME_SLOTS.map((t) => createSlot(t)));
  const { push } = useToast();

  const hasContent = useMemo(
    () => slots.some((s) => s.clientName.trim() || s.address.trim() || s.reason.trim() || s.phones.some((p) => p.value.trim())),
    [slots]
  );

  const updateSlot = (id: string, patch: Partial<BookingSlot>) =>
    setSlots((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const updatePhone = (sid: string, pid: string, value: string) =>
    setSlots((cur) =>
      cur.map((s) => (s.id === sid ? { ...s, phones: s.phones.map((p) => (p.id === pid ? { ...p, value } : p)) } : s))
    );

  const addPhone = (sid: string) =>
    setSlots((cur) => cur.map((s) => (s.id === sid ? { ...s, phones: [...s.phones, createPhoneEntry()] } : s)));

  const removePhone = (sid: string, pid: string) =>
    setSlots((cur) =>
      cur.map((s) => (s.id !== sid || s.phones.length === 1 ? s : { ...s, phones: s.phones.filter((p) => p.id !== pid) }))
    );

  const addSlot = () => setSlots((cur) => [...cur, createSlot()]);

  const removeSlot = (sid: string) => setSlots((cur) => (cur.length <= 1 ? cur : cur.filter((s) => s.id !== sid)));

  const exportToPdf = () => {
    try {
      if (slots.length === 0) {
        push("info", "Non ci sono slot da esportare.");
        return;
      }

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const marginX = 16;
      const topMargin = 18;
      const bottomMargin = 18;
      const cardPaddingX = 6;
      const pageH = doc.internal.pageSize.getHeight();
      const pageW = doc.internal.pageSize.getWidth();
      const cardW = pageW - marginX * 2;
      const cardL = marginX;
      const innerX = cardL + cardPaddingX;

      const layout = {
        paddingY: 3.6,
        headerOffset: 2.0,
        headerTitleSpacing: 5.2,
        headerTitleExtra: 1.2,
        detailLine: 4.2,
        cardGap: 2.0,
        headerBlockH: 12,
      } as const;

      const cardHeight = (reasonLines: number) => {
        return (
          layout.paddingY * 2 +
          layout.headerOffset +
          layout.headerTitleSpacing +
          layout.headerTitleExtra +
          layout.detailLine * 3
        );
      };

      let y = topMargin;

      const header = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(200, 30, 30);
        doc.text("T", marginX, topMargin);
        const tW = doc.getTextWidth("T");
        doc.setTextColor(0, 0, 0);
        doc.text("ropini ", marginX + tW, topMargin);
        const firstW = tW + doc.getTextWidth("ropini ");
        doc.setTextColor(200, 30, 30);
        doc.text("S", marginX + firstW, topMargin);
        const sW = doc.getTextWidth("S");
        doc.setTextColor(0, 0, 0);
        doc.text("ervice", marginX + firstW + sW, topMargin);
        doc.setTextColor(0, 0, 0);
        y = topMargin + layout.headerBlockH;
      };

      const need = (h: number) => {
        if (y + h > pageH - bottomMargin) {
          doc.addPage();
          header();
        }
      };

      header();

      slots.forEach((slot, idx) => {
        const h = cardHeight(0);
        const after = idx < slots.length - 1 ? layout.cardGap : 0;
        need(h + after);

        doc.setFillColor(248, 249, 251);
        doc.setDrawColor(223, 226, 233);
        doc.roundedRect(cardL, y, cardW, h, 4, 4, "FD");

        let ty = y + layout.paddingY + layout.headerOffset;
        const range = slot.startTime || slot.endTime ? `${slot.startTime || "??"} -> ${slot.endTime || "??"}` : `Slot ${idx + 1}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(range, innerX, ty);
        
        const clienteX = innerX + 50;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Cliente: ${slot.clientName.trim() || "—"}`, clienteX, ty);
        ty += layout.headerTitleSpacing + layout.headerTitleExtra;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        if (slot.address.trim()) {
          doc.text("Indirizzo:", innerX, ty);
          doc.textWithLink(slot.address.trim(), innerX + 24, ty, { url: buildMapsUrl(slot.address.trim()) });
        } else {
          doc.text("Indirizzo: —", innerX, ty);
        }
        ty += layout.detailLine;

        const phones = slot.phones.filter((p) => p.value.trim());
        if (phones.length > 0) {
          doc.text("Telefono:", innerX, ty);
          let px = innerX + 23;
          phones.forEach((p, i2) => {
            const display = p.value.trim();
            const sanitized = normalizePhoneLink(display);
            const label = i2 > 0 ? `, ${display}` : display;
            if (sanitized) doc.textWithLink(label, px, ty, { url: `tel:${sanitized}` });
            else doc.text(label, px, ty);
            px += doc.getTextWidth(label) + 2;
          });
        } else {
          doc.text("Telefono: —", innerX, ty);
        }
        ty += layout.detailLine;
        
        const motivo = slot.reason.trim() || "—";
        doc.text("Motivo:", innerX, ty);
        doc.text(motivo, innerX + 16, ty);

        y += h;
        if (after > 0) y += after;
      });

      const filename = `prenotazioni-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);
      push("success", "PDF generato con successo!");
    } catch (e) {
      console.error("Errore esportazione PDF", e);
      push("error", "Impossibile generare il PDF, riprova.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Gestione prenotazioni</h1>
            <p className="text-sm text-neutral-400">Organizza le uscite quotidiane e prepara un riepilogo stampabile.</p>
          </div>
        </header>

        <section className="space-y-3">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4 shadow-lg shadow-black/30"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-medium text-neutral-100">Fascia oraria</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <span>Inizio</span>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })}
                      className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <span>Fine</span>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })}
                      className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:text-red-300 hover:border-red-400"
                  >
                    ✕ Rimuovi slot
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-300">Nome cliente</span>
                  <input
                    type="text"
                    value={slot.clientName}
                    onChange={(e) => updateSlot(slot.id, { clientName: e.target.value })}
                    placeholder="Es. Mario Rossi"
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-300">Via / indirizzo</span>
                  <input
                    type="text"
                    value={slot.address}
                    onChange={(e) => updateSlot(slot.id, { address: e.target.value })}
                    placeholder="Es. Via Roma 12, Torino"
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <span className="text-sm text-neutral-300">Telefono / recapiti</span>
                <div className="space-y-2">
                  {slot.phones.map((ph) => (
                    <div key={ph.id} className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={ph.value}
                        onChange={(e) => updatePhone(slot.id, ph.id, e.target.value)}
                        placeholder="Es. +39 333 1234567"
                        className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removePhone(slot.id, ph.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 transition hover:text-red-300 hover:border-red-400"
                        disabled={slot.phones.length === 1}
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addPhone(slot.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-blue-500 hover:text-blue-300"
                >
                  + Aggiungi numero
                </button>
              </div>

              <label className="mt-4 flex flex-col gap-1 text-sm">
                <span className="text-neutral-300">Motivo dell'intervento</span>
                <textarea
                  value={slot.reason}
                  onChange={(e) => updateSlot(slot.id, { reason: e.target.value })}
                  rows={3}
                  placeholder="Es. Sopralluogo impianto, consegna documenti..."
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </label>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addSlot}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-200 transition hover:border-blue-500 hover:text-blue-300"
          >
            + Aggiungi fascia oraria
          </button>
          <button
            type="button"
            onClick={exportToPdf}
            disabled={!hasContent}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-400"
          >
            ⬇ Esporta PDF
          </button>
        </div>

        {!hasContent && <p className="text-xs text-neutral-500">Compila almeno un campo per attivare l'esportazione PDF.</p>}
      </div>
    </div>
  );
}

export default function PrenotazioniPage() {
  return (
    <ToastProvider>
      <PrenotazioniContent />
    </ToastProvider>
  );
}
