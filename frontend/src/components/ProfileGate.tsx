import { FormEvent, useState } from "react";
import { BrainCircuit, Sparkles } from "lucide-react";

import type { Profile } from "../lib/types";

type ProfileGateProps = {
  profile: Profile | null;
  onSave: (profile: Profile) => void;
};

export function ProfileGate({ profile, onSave }: ProfileGateProps) {
  const [displayName, setDisplayName] = useState("");

  if (profile) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) {
      return;
    }

    onSave({
      id: crypto.randomUUID(),
      displayName: displayName.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 backdrop-blur-md">
      <div className="glass-panel subtle-grid w-full max-w-2xl overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-ink px-8 py-10 text-white">
            <div className="mb-6 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm">
              Local study profile
            </div>
            <div className="mb-4 flex items-center gap-3">
              <BrainCircuit className="h-10 w-10 text-coral" />
              <span className="font-display text-4xl">Synapse Study</span>
            </div>
            <p className="text-base text-white/80">
              Build one persistent student profile for this browser so your confidence history,
              quizzes, and weak-topic prioritization stay connected over time.
            </p>
            <div className="mt-8 rounded-[24px] border border-white/15 bg-white/10 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-white/65">
                <Sparkles className="h-4 w-4" />
                What you get
              </div>
              <p className="text-sm text-white/80">
                Course-based uploads, a Socratic tutor, confidence-aware flashcards, source-cited
                quizzes, and guided review that keeps pulling your least-certain topics back into
                focus.
              </p>
            </div>
          </div>

          <form className="space-y-6 px-8 py-10" onSubmit={handleSubmit}>
            <div>
              <h2 className="section-title text-[2.2rem]">Start your study space</h2>
              <p className="mt-3 text-sm text-ink/70">
                Use any name you want. This is a lightweight local profile for the current device.
              </p>
            </div>

            <label className="block text-sm font-medium text-ink">
              Display name
              <input
                className="mt-3 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base outline-none ring-0 transition focus:border-coral"
                placeholder="Avery, Priya, Study Night..."
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>

            <button
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
              type="submit"
            >
              Enter Synapse Study
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
