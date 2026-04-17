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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
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
