"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, Sparkles, Calendar, Users, Wallet, Zap, Car } from "lucide-react";
import Link from "next/link";
import type { TripConfig } from "@/types";

const DESTINATIONS = [
  { name: "Paris, France",     flag: "🇫🇷", lat: 48.8566,  lng: 2.3522   },
  { name: "Tokyo, Japan",      flag: "🇯🇵", lat: 35.6762,  lng: 139.6503 },
  { name: "Bali, Indonesia",   flag: "🇮🇩", lat: -8.3405,  lng: 115.092  },
  { name: "New York, USA",     flag: "🇺🇸", lat: 40.7128,  lng: -74.006  },
  { name: "Rome, Italy",       flag: "🇮🇹", lat: 41.9028,  lng: 12.4964  },
  { name: "Barcelona, Spain",  flag: "🇪🇸", lat: 41.3851,  lng: 2.1734   },
  { name: "London, UK",        flag: "🇬🇧", lat: 51.5074,  lng: -0.1278  },
  { name: "Santorini, Greece", flag: "🇬🇷", lat: 36.3932,  lng: 25.4615  },
  { name: "Dubai, UAE",        flag: "🇦🇪", lat: 25.2048,  lng: 55.2708  },
];

const INTERESTS = [
  { label: "Food & Dining",     emoji: "🍜" },
  { label: "History & Culture", emoji: "🏛️" },
  { label: "Art & Museums",     emoji: "🎨" },
  { label: "Nature & Outdoors", emoji: "🌿" },
  { label: "Nightlife",         emoji: "🎉" },
  { label: "Shopping",          emoji: "🛍️" },
  { label: "Adventure Sports",  emoji: "🧗" },
  { label: "Local Experiences", emoji: "🏘️" },
  { label: "Hidden Gems",       emoji: "💎" },
];

const STYLES = [
  { id: "relaxed", label: "Relaxed",  desc: "Slow pace, deep dives",  emoji: "🌿" },
  { id: "balanced", label: "Balanced", desc: "Best of both worlds",    emoji: "⚖️" },
  { id: "packed",   label: "Packed",   desc: "See everything!",        emoji: "⚡" },
] as const;

const BUDGETS = [
  { label: "Budget",   sub: "Under $1,000",  emoji: "🎒", value: "800"  },
  { label: "Mid",      sub: "$1k – $3k",     emoji: "✈️",  value: "2000" },
  { label: "Comfort",  sub: "$3k – $6k",     emoji: "🏨", value: "4500" },
  { label: "Luxury",   sub: "$6,000+",       emoji: "💎", value: "8000" },
  { label: "Flexible", sub: "No limit set",  emoji: "🌊", value: ""     },
];

const TRANSPORT_MODES = [
  { id: "walking", label: "Walking",        desc: "We'll keep activities nearby",      emoji: "🚶" },
  { id: "transit", label: "Public Transit", desc: "Bus, metro, subway",                emoji: "🚌" },
  { id: "car",     label: "Car / Taxi",     desc: "Maximum flexibility",               emoji: "🚗" },
  { id: "bicycle", label: "Bicycle",        desc: "Eco-friendly, medium range",        emoji: "🚴" },
  { id: "mix",     label: "Mix it up",      desc: "Best mode for each route",          emoji: "🔀" },
] as const;

const WALK_LIMITS = [5, 10, 15, 20, 30];

const BREAK_OPTIONS = [
  { value: 0,  label: "Back-to-back", sub: "No breaks",       emoji: "⚡" },
  { value: 15, label: "Short break",  sub: "15 min between",  emoji: "☕" },
  { value: 30, label: "Regular",      sub: "30 min to breathe", emoji: "🌿" },
  { value: 60, label: "Relaxed",      sub: "1 hr buffer",     emoji: "🍽️" },
];

const STEPS = [
  { icon: MapPin,    label: "Destination" },
  { icon: Calendar,  label: "Dates"       },
  { icon: Users,     label: "Travelers"   },
  { icon: Zap,       label: "Style"       },
  { icon: Sparkles,  label: "Interests"   },
  { icon: Wallet,    label: "Budget"      },
  { icon: Car,       label: "Getting Around" },
  { icon: Sparkles,  label: "Review"      },
];

export default function NewTripPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dest, setDest] = useState<typeof DESTINATIONS[0] | null>(null);
  const [customDest, setCustomDest] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [travelStyle, setTravelStyle] = useState<"relaxed" | "balanced" | "packed" | "">("");
  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [transportMode, setTransportMode] = useState<"walking" | "transit" | "car" | "bicycle" | "mix" | "">("");
  const [maxWalkMinutes, setMaxWalkMinutes] = useState(15);
  const [breakMinutes, setBreakMinutes] = useState(15);

  const today = new Date().toISOString().split("T")[0];

  async function transition(nextStep: number) {
    setVisible(false);
    await new Promise((r) => setTimeout(r, 200));
    setStep(nextStep);
    setVisible(true);
  }

  async function generate() {
    setGenerating(true);
    const destName = dest?.name ?? customDest;
    const config: TripConfig = {
      destination: destName,
      ...(dest?.lat !== undefined && { destination_lat: dest.lat }),
      ...(dest?.lng !== undefined && { destination_lng: dest.lng }),
      start_date: startDate,
      end_date: endDate,
      travelers_count: travelers,
      travel_style: (travelStyle || "balanced") as "relaxed" | "balanced" | "packed",
      interests: interests.map((i) => i.toLowerCase()),
      ...(budget && { budget_total: parseInt(budget) }),
      budget_currency: "USD",
      flights_booked: false,
      hotels_booked: false,
      ...(transportMode && { transport_mode: transportMode as TripConfig["transport_mode"] }),
      ...((transportMode === "walking" || transportMode === "mix") && { max_walk_minutes: maxWalkMinutes }),
      break_minutes: breakMinutes,
    };

    try {
      const res = await fetch("/api/ai/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("failed");
      const itinerary = await res.json();
      sessionStorage.setItem("pending_trip", JSON.stringify({ config, itinerary }));
      router.push("/trips/review");
    } catch {
      setError("Something went wrong. Please try again.");
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium">
              Step {step + 1} of {STEPS.length} · {STEPS[step].label}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        className={`flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full transition-all duration-200 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {step === 0 && (
          <DestinationStep
            selected={dest} onSelect={setDest}
            custom={customDest} onCustom={setCustomDest}
            onNext={() => transition(1)}
          />
        )}
        {step === 1 && (
          <DatesStep
            today={today} start={startDate} end={endDate}
            onStart={setStartDate} onEnd={setEndDate}
            onNext={() => transition(2)} onBack={() => transition(0)}
          />
        )}
        {step === 2 && (
          <TravelersStep
            count={travelers} onChange={setTravelers}
            onNext={() => transition(3)} onBack={() => transition(1)}
          />
        )}
        {step === 3 && (
          <StyleStep
            selected={travelStyle} onSelect={setTravelStyle}
            onNext={() => transition(4)} onBack={() => transition(2)}
          />
        )}
        {step === 4 && (
          <InterestsStep
            selected={interests}
            onToggle={(i) =>
              setInterests((prev) =>
                prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
              )
            }
            onNext={() => transition(5)} onBack={() => transition(3)}
          />
        )}
        {step === 5 && (
          <BudgetStep
            selected={budget} onSelect={setBudget}
            onNext={() => transition(6)} onBack={() => transition(4)}
          />
        )}
        {step === 6 && (
          <TransportStep
            mode={transportMode} onMode={setTransportMode}
            maxWalk={maxWalkMinutes} onMaxWalk={setMaxWalkMinutes}
            breakMins={breakMinutes} onBreak={setBreakMinutes}
            onNext={() => transition(7)} onBack={() => transition(5)}
          />
        )}
        {step === 7 && (
          <ReviewStep
            dest={dest?.name ?? customDest}
            dates={{ start: startDate, end: endDate }}
            travelers={travelers}
            style={travelStyle}
            interests={interests}
            transport={transportMode}
            breakMins={breakMinutes}
            generating={generating}
            error={error}
            onGenerate={generate}
            onBack={() => transition(6)}
          />
        )}
      </div>
    </div>
  );
}

/* ── Step 0: Destination ── */
function DestinationStep({
  selected, onSelect, custom, onCustom, onNext,
}: {
  selected: typeof DESTINATIONS[0] | null;
  onSelect: (d: typeof DESTINATIONS[0]) => void;
  custom: string; onCustom: (s: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Where are you headed?</h1>
        <p className="text-muted-foreground text-sm mt-1">Pick a popular destination or type your own</p>
      </div>

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={custom}
          onChange={(e) => { onCustom(e.target.value); onSelect(null as unknown as typeof DESTINATIONS[0]); }}
          placeholder="Search any destination..."
          className="w-full h-11 bg-card border border-border rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
        />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {DESTINATIONS.map((d) => {
          const on = selected?.name === d.name;
          return (
            <button
              key={d.name}
              onClick={() => { onSelect(d); onCustom(""); }}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-150 ${
                on
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {on && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <span className="text-2xl leading-none">{d.flag}</span>
              <span className={`text-xs font-semibold leading-tight ${on ? "text-primary" : "text-foreground"}`}>
                {d.name.split(",")[0]}
              </span>
              <span className={`text-[10px] leading-tight ${on ? "text-primary/70" : "text-muted-foreground"}`}>
                {d.name.split(",")[1]?.trim()}
              </span>
            </button>
          );
        })}
      </div>

      <NextButton
        disabled={!selected && !custom.trim()}
        onClick={onNext}
        label={selected ? `Continue with ${selected.name.split(",")[0]}` : custom ? `Continue with ${custom}` : "Choose a destination"}
      />
    </div>
  );
}

/* ── Step 1: Dates ── */
function DatesStep({ today, start, end, onStart, onEnd, onNext, onBack }: {
  today: string; start: string; end: string;
  onStart: (s: string) => void; onEnd: (s: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  const [mode, setMode] = useState<"enddate" | "nights">("enddate");
  const [nights, setNights] = useState(7);

  const QUICK_NIGHTS = [5, 7, 10, 14, 21];

  function addDays(dateStr: string, n: number) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  }

  function handleNightsChange(n: number) {
    const clamped = Math.max(1, Math.min(90, n));
    setNights(clamped);
    if (start) onEnd(addDays(start, clamped));
  }

  function handleStartChange(val: string) {
    onStart(val);
    if (mode === "nights" && val) onEnd(addDays(val, nights));
  }

  // Derive nights from picked dates when in enddate mode
  const derivedNights = start && end
    ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
    : 0;

  const displayNights = mode === "nights" ? nights : derivedNights;
  const returnDate = mode === "nights" && start ? addDays(start, nights) : end;
  const isReady = !!start && !!returnDate && displayNights > 0;

  const formatDate = (d: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">When are you traveling?</h1>
        <p className="text-muted-foreground text-sm mt-1">Set your start date, then pick how you want to set the end</p>
      </div>

      {/* Departure */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Departure</label>
        <input
          type="date" min={today} value={start}
          onChange={(e) => handleStartChange(e.target.value)}
          className="w-full text-base font-medium focus:outline-none bg-transparent"
        />
      </div>

      {/* Mode toggle */}
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        <button
          onClick={() => setMode("enddate")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "enddate" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pick return date
        </button>
        <button
          onClick={() => { setMode("nights"); if (start) onEnd(addDays(start, nights)); }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "nights" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Set duration
        </button>
      </div>

      {/* End date picker */}
      {mode === "enddate" && (
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Return</label>
          <input
            type="date" min={start || today} value={end}
            onChange={(e) => onEnd(e.target.value)}
            className="w-full text-base font-medium focus:outline-none bg-transparent"
          />
        </div>
      )}

      {/* Nights slider */}
      {mode === "nights" && (
        <div className="flex flex-col gap-4">
          {/* Big number display */}
          <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-4xl font-bold text-foreground">{nights}</span>
                <span className="text-muted-foreground text-base ml-1.5">nights</span>
              </div>
              <span className="text-sm text-muted-foreground">1 – 90</span>
            </div>
            {/* Slider */}
            <div className="relative">
              <input
                type="range"
                min={1}
                max={90}
                value={nights}
                onChange={(e) => handleNightsChange(Number(e.target.value))}
                className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${((nights - 1) / 89) * 100}%, var(--color-muted) ${((nights - 1) / 89) * 100}%, var(--color-muted) 100%)`,
                }}
              />
            </div>
            {/* Tick marks for quick presets */}
            <div className="flex justify-between">
              {QUICK_NIGHTS.map((n) => (
                <button
                  key={n}
                  onClick={() => handleNightsChange(n)}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg transition-all ${
                    nights === n
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}n
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary pill */}
      {isReady && (
        <div className="flex items-center justify-between bg-primary/8 border border-primary/20 rounded-xl py-3 px-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-primary font-semibold text-sm">{displayNights} night{displayNights !== 1 ? "s" : ""}</span>
          </div>
          {start && returnDate && (
            <span className="text-primary/70 text-xs">{formatDate(start)} → {formatDate(returnDate)}</span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <BackButton onClick={onBack} />
        <NextButton
          disabled={!isReady}
          onClick={onNext}
          label="Set dates"
          className="flex-1"
        />
      </div>
    </div>
  );
}

/* ── Step 2: Travelers ── */
function TravelersStep({ count, onChange, onNext, onBack }: {
  count: number; onChange: (n: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  const desc =
    count === 1 ? "Solo trip 🧳" :
    count === 2 ? "Just the two of you 💑" :
    count <= 4  ? "Small group 👫" :
                  "Big crew! 🎉";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">How many travelers?</h1>
        <p className="text-muted-foreground text-sm mt-1">We'll plan activities for the whole group</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onChange(Math.max(1, count - 1))}
            className="w-12 h-12 rounded-xl border border-border bg-background text-xl font-bold hover:bg-muted transition-colors active:scale-95 disabled:opacity-40"
            disabled={count <= 1}
          >
            −
          </button>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-bold text-foreground">{count}</span>
            <span className="text-xs text-muted-foreground mt-1">{count === 1 ? "person" : "people"}</span>
          </div>
          <button
            onClick={() => onChange(Math.min(30, count + 1))}
            className="w-12 h-12 rounded-xl border border-border bg-background text-xl font-bold hover:bg-muted transition-colors active:scale-95 disabled:opacity-40"
            disabled={count >= 30}
          >
            +
          </button>
        </div>
        <div className="text-center">
          <div className="flex gap-1 justify-center flex-wrap">
            {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
              <span key={i} className="text-xl">🧑</span>
            ))}
            {count > 10 && <span className="text-sm text-muted-foreground self-center">+{count - 10}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-2">{desc}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <BackButton onClick={onBack} />
        <NextButton onClick={onNext} label={`${count} traveler${count !== 1 ? "s" : ""}`} className="flex-1" />
      </div>
    </div>
  );
}

/* ── Step 3: Style ── */
function StyleStep({ selected, onSelect, onNext, onBack }: {
  selected: string;
  onSelect: (s: "relaxed" | "balanced" | "packed") => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">What's your travel style?</h1>
        <p className="text-muted-foreground text-sm mt-1">This shapes how your itinerary is packed</p>
      </div>

      <div className="flex flex-col gap-3">
        {STYLES.map((s) => {
          const on = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-150 ${
                on
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <span className="text-3xl leading-none">{s.emoji}</span>
              <div className="flex-1">
                <div className={`font-semibold ${on ? "text-primary" : "text-foreground"}`}>{s.label}</div>
                <div className={`text-sm ${on ? "text-primary/70" : "text-muted-foreground"}`}>{s.desc}</div>
              </div>
              {on && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <BackButton onClick={onBack} />
        <NextButton disabled={!selected} onClick={onNext} label="That's my style" className="flex-1" />
      </div>
    </div>
  );
}

/* ── Step 4: Interests ── */
function InterestsStep({ selected, onToggle, onNext, onBack }: {
  selected: string[]; onToggle: (i: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">What do you enjoy?</h1>
        <p className="text-muted-foreground text-sm mt-1">Select everything that interests you</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {INTERESTS.map((i) => {
          const on = selected.includes(i.label);
          return (
            <button
              key={i.label}
              onClick={() => onToggle(i.label)}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-150 ${
                on
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {on && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <span className="text-2xl leading-none">{i.emoji}</span>
              <span className={`text-[11px] font-medium leading-tight ${on ? "text-primary" : "text-foreground"}`}>
                {i.label}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">{selected.length} interest{selected.length !== 1 ? "s" : ""} selected</p>
      )}

      <div className="flex gap-3">
        <BackButton onClick={onBack} />
        <NextButton
          disabled={selected.length === 0}
          onClick={onNext}
          label={selected.length > 0 ? `Continue with ${selected.length} selected` : "Select at least one"}
          className="flex-1"
        />
      </div>
    </div>
  );
}

/* ── Step 5: Budget ── */
function BudgetStep({ selected, onSelect, onNext, onBack }: {
  selected: string; onSelect: (v: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">What's your budget?</h1>
        <p className="text-muted-foreground text-sm mt-1">Per person, for the whole trip</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {BUDGETS.map((b) => {
          const on = selected === b.value;
          return (
            <button
              key={b.label}
              onClick={() => onSelect(b.value)}
              className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-150 ${
                on
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <span className="text-2xl leading-none">{b.emoji}</span>
              <div className="flex-1">
                <div className={`font-semibold ${on ? "text-primary" : "text-foreground"}`}>{b.label}</div>
                <div className={`text-sm ${on ? "text-primary/70" : "text-muted-foreground"}`}>{b.sub}</div>
              </div>
              {on && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <BackButton onClick={onBack} />
        <NextButton onClick={onNext} label={selected !== "" ? "Budget set" : "Skip for now"} className="flex-1" />
      </div>
    </div>
  );
}

/* ── Step 6: Transport & Pacing ── */
function TransportStep({ mode, onMode, maxWalk, onMaxWalk, breakMins, onBreak, onNext, onBack }: {
  mode: string; onMode: (m: "walking" | "transit" | "car" | "bicycle" | "mix") => void;
  maxWalk: number; onMaxWalk: (n: number) => void;
  breakMins: number; onBreak: (n: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  const showWalkLimit = mode === "walking" || mode === "mix";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">How are you getting around?</h1>
        <p className="text-muted-foreground text-sm mt-1">We'll plan routes and timing to match your transport</p>
      </div>

      {/* Transport mode */}
      <div className="flex flex-col gap-2">
        {TRANSPORT_MODES.map((t) => {
          const on = mode === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onMode(t.id)}
              className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all duration-150 ${
                on ? "bg-primary/10 border-primary shadow-sm" : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <span className="text-2xl leading-none">{t.emoji}</span>
              <div className="flex-1">
                <div className={`font-semibold text-sm ${on ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                <div className={`text-xs ${on ? "text-primary/70" : "text-muted-foreground"}`}>{t.desc}</div>
              </div>
              {on && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Max walk time — only if walking or mix */}
      {showWalkLimit && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">Max walking time between stops</p>
          <div className="flex gap-2">
            {WALK_LIMITS.map((n) => (
              <button
                key={n}
                onClick={() => onMaxWalk(n)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  maxWalk === n
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {n} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Break duration */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Breaks between activities</p>
        <div className="grid grid-cols-2 gap-2">
          {BREAK_OPTIONS.map((b) => {
            const on = breakMins === b.value;
            return (
              <button
                key={b.value}
                onClick={() => onBreak(b.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  on ? "bg-primary/10 border-primary shadow-sm" : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <span className="text-xl leading-none">{b.emoji}</span>
                <div>
                  <div className={`font-semibold text-xs ${on ? "text-primary" : "text-foreground"}`}>{b.label}</div>
                  <div className={`text-[11px] ${on ? "text-primary/70" : "text-muted-foreground"}`}>{b.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <BackButton onClick={onBack} />
        <NextButton disabled={!mode} onClick={onNext} label="Looks good" className="flex-1" />
      </div>
    </div>
  );
}

/* ── Step 7: Review & Generate ── */
function ReviewStep({ dest, dates, travelers, style, interests, transport, breakMins, generating, error, onGenerate, onBack }: {
  dest: string; dates: { start: string; end: string };
  travelers: number; style: string; interests: string[];
  transport: string; breakMins: number;
  generating: boolean; error: string | null;
  onGenerate: () => void; onBack: () => void;
}) {
  const nights = dates.start && dates.end
    ? Math.round((new Date(dates.end).getTime() - new Date(dates.start).getTime()) / 86400000)
    : 0;

  const formatDate = (d: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {generating ? "Building your trip..." : "Looks great!"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {generating ? "Searching for the best spots and experiences" : "Review your trip details below"}
        </p>
      </div>

      {generating ? (
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-spin border-t-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Planning your {dest} trip</p>
            <p className="text-sm text-muted-foreground mt-1">This takes about 15–30 seconds</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <SummaryRow icon="📍" label="Destination" value={dest} />
          <SummaryRow icon="📅" label="Dates" value={`${formatDate(dates.start)} – ${formatDate(dates.end)}`} sub={`${nights} nights`} />
          <SummaryRow icon="👥" label="Travelers" value={`${travelers} ${travelers === 1 ? "person" : "people"}`} />
          <SummaryRow icon="⚡" label="Style" value={style ? style.charAt(0).toUpperCase() + style.slice(1) : "Balanced"} />
          <SummaryRow
            icon="❤️" label="Interests"
            value={interests.slice(0, 3).join(", ")}
            sub={interests.length > 3 ? `+${interests.length - 3} more` : undefined}
          />
          {transport && (
            <SummaryRow
              icon={TRANSPORT_MODES.find(t => t.id === transport)?.emoji ?? "🚶"}
              label="Getting Around"
              value={TRANSPORT_MODES.find(t => t.id === transport)?.label ?? transport}
            />
          )}
          <SummaryRow
            icon="⏱️" label="Breaks"
            value={BREAK_OPTIONS.find(b => b.value === breakMins)?.label ?? "Regular"}
            sub={breakMins === 0 ? "Back-to-back activities" : `${breakMins} min between activities`}
          />
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {!generating && (
        <div className="flex gap-3">
          <BackButton onClick={onBack} />
          <button
            onClick={onGenerate}
            className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate my itinerary
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Shared pieces ── */
function SummaryRow({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
      <span className="text-xl leading-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function NextButton({ onClick, disabled, label, className = "" }: {
  onClick: () => void; disabled?: boolean; label: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-12 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${className}`}
    >
      {label} <ArrowRight className="w-4 h-4" />
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-12 h-12 rounded-xl border border-border bg-card text-muted-foreground flex items-center justify-center hover:bg-muted hover:text-foreground transition-colors active:scale-95"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}
