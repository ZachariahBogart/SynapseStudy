import { useState } from "react";
import { BrainCircuit, FolderKanban } from "lucide-react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import { ProfileGate } from "./components/ProfileGate";
import { loadProfile, saveProfile } from "./lib/profile";
import type { Profile } from "./lib/types";
import { CoursePage } from "./routes/CoursePage";
import { HomePage } from "./routes/HomePage";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());

  function handleSaveProfile(nextProfile: Profile) {
    saveProfile(nextProfile);
    setProfile(nextProfile);
  }

  return (
    <BrowserRouter>
      <div className="relative min-h-screen overflow-hidden px-4 pb-10 pt-6 md:px-8">
        <div className="pointer-events-none absolute left-[-120px] top-12 h-56 w-56 rounded-full bg-coral/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-80px] top-24 h-72 w-72 rounded-full bg-teal/20 blur-3xl" />

        <header className="mx-auto mb-8 flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link
            className="glass-panel flex items-center gap-3 px-5 py-3 text-ink no-underline"
            to="/"
          >
            <div className="rounded-2xl bg-ink p-2 text-white">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-2xl leading-none">Synapse Study</div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink/55">
                Adaptive course tutor
              </div>
            </div>
          </Link>

          <div className="glass-panel flex items-center gap-3 px-4 py-3">
            <div className="rounded-full bg-coral/15 p-2 text-coral">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Study profile</div>
              <div className="text-sm font-medium text-ink">
                {profile ? profile.displayName : "Not set yet"}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl">
          <Routes>
            <Route path="/" element={<HomePage profile={profile} />} />
            <Route path="/courses/:courseId" element={<CoursePage profile={profile} />} />
          </Routes>
        </main>

        <ProfileGate profile={profile} onSave={handleSaveProfile} />
      </div>
    </BrowserRouter>
  );
}
