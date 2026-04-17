type ConfidenceSelectorProps = {
  value: number | null;
  onChange: (value: number) => void;
  label?: string;
};

const labels = {
  1: "Lost",
  2: "Shaky",
  3: "Okay",
  4: "Solid",
  5: "Locked in",
} as const;

export function ConfidenceSelector({
  value,
  onChange,
  label = "How confident are you right now?",
}: ConfidenceSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value === score;
          return (
            <button
              key={score}
              className={`rounded-2xl border px-3 py-3 text-sm transition ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-ink/10 bg-white text-ink hover:border-coral"
              }`}
              type="button"
              onClick={() => onChange(score)}
            >
              <div className="text-lg font-semibold">{score}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] opacity-75">
                {labels[score as keyof typeof labels]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
