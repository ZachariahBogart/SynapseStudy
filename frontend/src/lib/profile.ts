import type { Profile } from "./types";

const PROFILE_STORAGE_KEY = "synapse-study.profile";

export function loadProfile(): Profile | null {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed.id || !parsed.displayName) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
