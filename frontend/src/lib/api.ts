import type {
  AssetUploadResponse,
  AttemptResult,
  CourseListResponse,
  GuidedLearningResponse,
  IngestionStatus,
  LearningItem,
  Overview,
  Profile,
  QuizSession,
  TutorMessageResponse,
  TutorStartResponse,
} from "./types";

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/^['"]+|['"]+$/g, "").replace(/\/+$/, "");
}

function parseConfiguredApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("[") || normalized.startsWith('"')) {
    try {
      const parsed = JSON.parse(normalized) as unknown;
      if (typeof parsed === "string") {
        return normalizeApiBaseUrl(parsed);
      }
      if (Array.isArray(parsed)) {
        const firstUrl = parsed.find((item): item is string => typeof item === "string" && item.trim().length > 0);
        if (firstUrl) {
          return normalizeApiBaseUrl(firstUrl);
        }
      }
    } catch {
      // Fall through to string cleanup below for partially malformed values.
    }
  }

  return normalized.replace(/^\[(.+)\]$/, "$1").replace(/^['"]+|['"]+$/g, "");
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return parseConfiguredApiBaseUrl(configured);
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return origin;
  }

  return "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

type RequestOptions = Omit<RequestInit, "body"> & {
  profile: Profile;
  body?: BodyInit | Record<string, unknown>;
};

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("x-user-id", options.profile.id);
  headers.set("x-user-name", options.profile.displayName);

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const requestUrl = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
      body,
    });
  } catch (error) {
    const details =
      error instanceof Error && error.message ? error.message : "Network error while contacting the API.";
    throw new Error(
      `Could not reach the API at ${requestUrl}. ${details} If this site is hosted, set VITE_API_BASE_URL to your backend URL or proxy /api to the backend.`,
    );
  }

  if (!response.ok) {
    const rawMessage = await response.text();
    let message = rawMessage.trim();

    if (message) {
      try {
        const parsed = JSON.parse(message) as { detail?: string };
        if (typeof parsed.detail === "string" && parsed.detail.trim()) {
          message = parsed.detail.trim();
        }
      } catch {
        message = rawMessage.trim();
      }
    }

    throw new Error(message || `Request failed (${response.status}) at ${requestUrl}.`);
  }

  return response.json() as Promise<T>;
}

export function listCourses(profile: Profile) {
  return request<CourseListResponse>("/api/courses", { method: "GET", profile });
}

export function createCourse(profile: Profile, payload: { title: string; subject: string }) {
  return request<Overview["course"]>("/api/courses", {
    method: "POST",
    profile,
    body: payload,
  });
}

export function uploadAsset(profile: Profile, courseId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return request<AssetUploadResponse>(`/api/courses/${courseId}/assets`, {
    method: "POST",
    profile,
    body,
  });
}

export function getOverview(profile: Profile, courseId: string) {
  return request<Overview>(`/api/courses/${courseId}/overview`, { method: "GET", profile });
}

export function getIngestionStatus(profile: Profile, courseId: string) {
  return request<IngestionStatus>(`/api/courses/${courseId}/ingestion-status`, {
    method: "GET",
    profile,
  });
}

export function getFlashcards(profile: Profile, courseId: string) {
  return request<LearningItem[]>(`/api/courses/${courseId}/flashcards`, {
    method: "GET",
    profile,
  });
}

export function getGuidedLearning(profile: Profile, courseId: string) {
  return request<GuidedLearningResponse>(`/api/courses/${courseId}/guided-learning`, {
    method: "GET",
    profile,
  });
}

export function createQuizSession(profile: Profile, courseId: string, itemCount = 5) {
  return request<QuizSession>(`/api/courses/${courseId}/quiz/session`, {
    method: "POST",
    profile,
    body: { item_count: itemCount },
  });
}

export function submitAttempt(
  profile: Profile,
  learningItemId: string,
  payload: { response: string; confidence_1_5: number },
) {
  return request<AttemptResult>(`/api/learning-items/${learningItemId}/attempt`, {
    method: "POST",
    profile,
    body: payload,
  });
}

export function startTutorSession(profile: Profile, courseId: string) {
  return request<TutorStartResponse>(`/api/courses/${courseId}/tutor/session`, {
    method: "POST",
    profile,
    body: {},
  });
}

export function sendTutorMessage(
  profile: Profile,
  courseId: string,
  payload: { session_id: string; message: string },
) {
  return request<TutorMessageResponse>(`/api/courses/${courseId}/tutor/message`, {
    method: "POST",
    profile,
    body: payload,
  });
}
