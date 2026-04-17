export type Profile = {
  id: string;
  displayName: string;
};

export type SourceRef = {
  label: string;
  asset_id?: string | null;
  asset_name?: string | null;
  location?: string | null;
};

export type Course = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  course_id: string;
  type: "pdf" | "pptx" | "image" | "audio" | "video";
  status: "queued" | "processing" | "ready" | "failed";
  storage_path: string;
  original_filename: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Topic = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  summary: string;
  mastery_score: number;
  priority_score: number;
  source_refs: SourceRef[];
  key_terms: string[];
  created_at: string;
  updated_at: string;
};

export type LearningItem = {
  id: string;
  course_id: string;
  topic_id: string;
  kind: "flashcard" | "quiz" | "guided_step";
  prompt: string;
  answer_key: string;
  hint: string;
  quick_check: string;
  source_refs: SourceRef[];
  created_at: string;
  updated_at: string;
};

export type Overview = {
  course: Course;
  assets: Asset[];
  topics: Topic[];
  learning_counts: Record<string, number>;
  weak_topics: Topic[];
  readiness: string;
};

export type IngestionStatus = {
  course_id: string;
  status: "empty" | "processing" | "ready" | "failed";
  ready_assets: number;
  processing_assets: number;
  failed_assets: number;
  assets: Asset[];
};

export type CourseListResponse = {
  user: {
    id: string;
    display_name: string;
  };
  courses: Course[];
};

export type AssetUploadResponse = {
  asset: Asset;
  message: string;
};

export type QuizSession = {
  course_id: string;
  items: LearningItem[];
};

export type AttemptResult = {
  attempt_id: string;
  learning_item_id: string;
  topic_id: string;
  correctness: boolean | null;
  confidence_1_5: number;
  feedback: string;
  mastery_score: number;
  priority_score: number;
};

export type TutorStartResponse = {
  session_id: string;
  status: "active" | "completed";
  topic: Topic | null;
  response: string;
  source_refs: SourceRef[];
};

export type TutorMessageResponse = {
  session_id: string;
  status: "active" | "completed";
  topic_id: string | null;
  stage: string;
  response: string;
  source_refs: SourceRef[];
  transcript: Array<{ role: "assistant" | "user"; content: string }>;
};

export type GuidedLearningResponse = {
  course_id: string;
  items: Array<{
    topic: Topic;
    learning_item: LearningItem;
    dynamic_priority: number;
  }>;
};
