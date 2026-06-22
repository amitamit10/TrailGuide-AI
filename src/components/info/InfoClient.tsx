"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Phrase {
  phrase: string;
  local: string;
  pronunciation: string;
}

interface CulturePack {
  language: {
    name: string;
    phrases: Phrase[];
  };
  customs: {
    tipping: string;
    dress_code: string;
    etiquette: string[];
    greetings: string;
  };
  practical: {
    electricity: {
      voltage: string;
      plug_type: string;
      adapter_needed: boolean;
    };
    currency_name: string;
    currency_code: string;
    cash_culture: string;
    water_safety: string;
    internet: string;
  };
  emergency: {
    police: string;
    ambulance: string;
    fire: string;
    tourist_helpline: string | null;
    notes: string;
  };
  visa: {
    summary: string;
    on_arrival: boolean;
    duration_days: number;
    notes: string;
  };
}

export function InfoClient({ tripId }: { tripId: string }) {
  const [pack, setPack] = useState<CulturePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/culture-pack?tripId=${tripId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setPack(d.data);
        const code = d.data?.practical?.currency_code;
        if (code && code !== "USD") {
          fetch(`/api/currency?from=USD&to=${code}`)
            .then((r) => r.json())
            .then((c) => setRate(c.data?.rate ?? null));
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Generating local guide…
        </p>
      </div>
    );

  if (error || !pack)
    return (
      <p className="text-center text-muted-foreground py-16 text-sm">
        Unable to load local info.
      </p>
    );

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-5">
      {/* Phrases */}
      <section>
        <h2 className="font-semibold text-sm text-foreground mb-2">
          Essential {pack.language.name} Phrases
        </h2>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
          {pack.language.phrases.map((p, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">
                  {p.phrase}
                </span>
                <span className="text-sm font-medium">{p.local}</span>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
                {p.pronunciation}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Currency */}
      <section>
        <h2 className="font-semibold text-sm text-foreground mb-2">
          {pack.practical.currency_name} ({pack.practical.currency_code})
        </h2>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex gap-4 items-center mb-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">USD</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xl font-semibold bg-transparent border-0 outline-none text-foreground"
              />
            </div>
            <span className="text-muted-foreground">=</span>
            <div className="flex-1 text-right">
              <p className="text-xs text-muted-foreground mb-1">
                {pack.practical.currency_code}
              </p>
              <p className="text-xl font-semibold text-primary">
                {rate
                  ? (parseFloat(amount || "0") * rate).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 0 }
                    )
                  : "—"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {pack.practical.cash_culture}
          </p>
        </div>
      </section>

      {/* Customs */}
      <section>
        <h2 className="font-semibold text-sm text-foreground mb-2">
          Customs &amp; Etiquette
        </h2>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Tipping
            </p>
            <p className="text-sm">{pack.customs.tipping}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Dress Code
            </p>
            <p className="text-sm">{pack.customs.dress_code}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Do &amp; Don&apos;t
            </p>
            <ul className="space-y-1">
              {pack.customs.etiquette.map((e, i) => (
                <li key={i} className="text-sm flex gap-2">
                  {i % 2 === 0 ? "✅" : "❌"} {e}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Water
            </p>
            <p className="text-sm">{pack.practical.water_safety}</p>
          </div>
        </div>
      </section>

      {/* Emergency */}
      <section>
        <h2 className="font-semibold text-sm text-foreground mb-2">
          Emergency Numbers
        </h2>
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 grid grid-cols-3 gap-3">
          {[
            { label: "Police", number: pack.emergency.police },
            { label: "Ambulance", number: pack.emergency.ambulance },
            { label: "Fire", number: pack.emergency.fire },
          ].map((e) => (
            <a
              key={e.label}
              href={`tel:${e.number}`}
              className="flex flex-col items-center bg-card border border-border rounded-xl p-3 gap-1 hover:bg-muted/50"
            >
              <span className="text-lg font-bold text-destructive">
                {e.number}
              </span>
              <span className="text-xs text-muted-foreground">{e.label}</span>
            </a>
          ))}
        </div>
        {pack.emergency.notes && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            {pack.emergency.notes}
          </p>
        )}
      </section>

      {/* Visa */}
      <section>
        <h2 className="font-semibold text-sm text-foreground mb-2">
          Visa Requirements
        </h2>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                pack.visa.on_arrival
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {pack.visa.on_arrival ? "Visa on arrival" : "Visa required"}
            </span>
            {pack.visa.duration_days > 0 && (
              <span className="text-xs text-muted-foreground">
                Up to {pack.visa.duration_days} days
              </span>
            )}
          </div>
          <p className="text-sm text-foreground">{pack.visa.summary}</p>
          {pack.visa.notes && (
            <p className="text-xs text-muted-foreground mt-1">
              {pack.visa.notes}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
