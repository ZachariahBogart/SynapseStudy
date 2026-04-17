import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookCopy,
  BrainCircuit,
  Files,
  Layers2,
  MessageSquareQuote,
  RefreshCcw,
  Target,
  UploadCloud,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ConfidenceSelector } from "../components/ConfidenceSelector";
import { TabButton } from "../components/TabButton";
import {
  createQuizSession,
  getFlashcards,
  getGuidedLearning,
  getIngestionStatus,
  getOverview,
  sendTutorMessage,
  startTutorSession,
  submitAttempt,
  uploadAsset,
} from "../lib/api";
import type {
  AttemptResult,
  GuidedLearningResponse,
  LearningItem,
  Overview,
  Profile,
  TutorMessageResponse,
  TutorStartResponse,
} from "../lib/types";

type CoursePageProps = {
  profile: Profile | null;
};

type TabKey = "overview" | "tutor" | "flashcards" | "quiz" | "guided";
type ChatMessage = { role: "assistant" | "user"; content: string };

export function CoursePage({ profile }: CoursePageProps) {
  const { courseId = "" } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedUploadName, setSelectedUploadName] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["course-overview", profile?.id, courseId],
    queryFn: () => getOverview(profile!, courseId),
    enabled: Boolean(profile && courseId),
  });

  const statusQuery = useQuery({
    queryKey: ["course-status", profile?.id, courseId],
    queryFn: () => getIngestionStatus(profile!, courseId),
    enabled: Boolean(profile && courseId),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "processing" ? 2_500 : false;
    },
  });

  const flashcardsQuery = useQuery({
    queryKey: ["flashcards", profile?.id, courseId],
    queryFn: () => getFlashcards(profile!, courseId),
    enabled: Boolean(profile && courseId),
  });

  const guidedQuery = useQuery({
    queryKey: ["guided-learning", profile?.id, courseId],
    queryFn: () => getGuidedLearning(profile!, courseId),
    enabled: Boolean(profile && courseId),
  });

  function invalidateCourseQueries() {
    queryClient.invalidateQueries({ queryKey: ["course-overview", profile?.id, courseId] });
    queryClient.invalidateQueries({ queryKey: ["course-status", profile?.id, courseId] });
    queryClient.invalidateQueries({ queryKey: ["flashcards", profile?.id, courseId] });
    queryClient.invalidateQueries({ queryKey: ["guided-learning", profile?.id, courseId] });
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAsset(profile!, courseId, file),
    onSuccess: () => {
      setSelectedUploadName("");
      invalidateCourseQueries();
    },
  });

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const [flashcardConfidence, setFlashcardConfidence] = useState<number | null>(null);
  const [flashcardFeedback, setFlashcardFeedback] = useState<AttemptResult | null>(null);

  const flashcardAttemptMutation = useMutation({
    mutationFn: (payload: { itemId: string; confidence: number }) =>
      submitAttempt(profile!, payload.itemId, { response: "", confidence_1_5: payload.confidence }),
    onSuccess: (result) => {
      setFlashcardFeedback(result);
      invalidateCourseQueries();
    },
  });

  const flashcards = flashcardsQuery.data ?? [];
  const currentFlashcard =
    flashcards.length > 0 ? flashcards[Math.min(flashcardIndex, flashcards.length - 1)] : null;

  useEffect(() => {
    if (flashcardIndex >= flashcards.length) {
      setFlashcardIndex(0);
    }
  }, [flashcards.length, flashcardIndex]);

  function moveToNextFlashcard() {
    if (!flashcards.length) {
      return;
    }
    setFlashcardIndex((previous) => (previous + 1) % flashcards.length);
    setFlashcardRevealed(false);
    setFlashcardConfidence(null);
    setFlashcardFeedback(null);
  }

  const [quizItems, setQuizItems] = useState<LearningItem[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizConfidence, setQuizConfidence] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<AttemptResult | null>(null);

  const startQuizMutation = useMutation({
    mutationFn: () => createQuizSession(profile!, courseId, 5),
    onSuccess: (session) => {
      setQuizItems(session.items);
      setQuizIndex(0);
      setQuizAnswer("");
      setQuizConfidence(null);
      setQuizFeedback(null);
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: (payload: { itemId: string; answer: string; confidence: number }) =>
      submitAttempt(profile!, payload.itemId, {
        response: payload.answer,
        confidence_1_5: payload.confidence,
      }),
    onSuccess: (result) => {
      setQuizFeedback(result);
      invalidateCourseQueries();
    },
  });

  const activeQuizItem =
    quizItems.length > 0 ? quizItems[Math.min(quizIndex, quizItems.length - 1)] : null;

  function nextQuizItem() {
    if (quizIndex + 1 >= quizItems.length) {
      setQuizIndex(0);
      setQuizItems([]);
    } else {
      setQuizIndex((previous) => previous + 1);
    }
    setQuizAnswer("");
    setQuizConfidence(null);
    setQuizFeedback(null);
  }

  const [tutorSessionId, setTutorSessionId] = useState<string | null>(null);
  const [tutorMessages, setTutorMessages] = useState<ChatMessage[]>([]);
  const [tutorDraft, setTutorDraft] = useState("");
  const [tutorStage, setTutorStage] = useState("idle");

  const startTutorMutation = useMutation({
    mutationFn: () => startTutorSession(profile!, courseId),
    onSuccess: (payload: TutorStartResponse) => {
      setTutorSessionId(payload.session_id);
      setTutorMessages([{ role: "assistant", content: payload.response }]);
      setTutorStage("opening");
      setActiveTab("tutor");
    },
  });

  const tutorMessageMutation = useMutation({
    mutationFn: (payload: { sessionId: string; message: string }) =>
      sendTutorMessage(profile!, courseId, {
        session_id: payload.sessionId,
        message: payload.message,
      }),
    onSuccess: (payload: TutorMessageResponse) => {
      setTutorMessages(payload.transcript);
      setTutorStage(payload.stage);
      invalidateCourseQueries();
    },
  });

  const [selectedGuidedItemId, setSelectedGuidedItemId] = useState<string | null>(null);
  const [guidedAnswer, setGuidedAnswer] = useState("");
  const [guidedConfidence, setGuidedConfidence] = useState<number | null>(null);
  const [guidedFeedback, setGuidedFeedback] = useState<AttemptResult | null>(null);
  const guidedItems = guidedQuery.data?.items ?? [];
  const selectedGuided =
    guidedItems.find((entry) => entry.learning_item.id === selectedGuidedItemId) ?? guidedItems[0] ?? null;

  const guidedAttemptMutation = useMutation({
    mutationFn: (payload: { itemId: string; answer: string; confidence: number }) =>
      submitAttempt(profile!, payload.itemId, {
        response: payload.answer,
        confidence_1_5: payload.confidence,
      }),
    onSuccess: (result) => {
      setGuidedFeedback(result);
      invalidateCourseQueries();
    },
  });

  useEffect(() => {
    if (!guidedItems.length) {
      setSelectedGuidedItemId(null);
      return;
    }

    if (!selectedGuidedItemId || !guidedItems.some((entry) => entry.learning_item.id === selectedGuidedItemId)) {
      setSelectedGuidedItemId(guidedItems[0].learning_item.id);
    }
  }, [guidedItems, selectedGuidedItemId]);

  useEffect(() => {
    setGuidedAnswer("");
    setGuidedConfidence(null);
    setGuidedFeedback(null);
  }, [selectedGuided?.learning_item.id]);

  if (!profile) {
    return (
      <div className="glass-panel px-6 py-10 text-center text-sm text-ink/65">
        Create a study profile first so this course can load.
      </div>
    );
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="glass-panel px-6 py-10 text-center text-sm text-ink/65">
        Loading course workspace...
      </div>
    );
  }

  if (overviewQuery.error || !overviewQuery.data) {
    return (
      <div className="glass-panel px-6 py-10 text-center text-sm text-ink/65">
        {(overviewQuery.error as Error)?.message ?? "Unable to load this course."}
      </div>
    );
  }

  const overview = overviewQuery.data;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setSelectedUploadName(file.name);
    uploadMutation.mutate(file);
    event.target.value = "";
  }

  function handleTutorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tutorSessionId || !tutorDraft.trim()) {
      return;
    }

    const userMessage = tutorDraft.trim();
    setTutorMessages((previous) => [...previous, { role: "user", content: userMessage }]);
    setTutorDraft("");
    tutorMessageMutation.mutate({ sessionId: tutorSessionId, message: userMessage });
  }

  function moveToNextGuidedTopic() {
    if (!guidedItems.length || !selectedGuided) {
      return;
    }

    const currentIndex = guidedItems.findIndex(
      (entry) => entry.learning_item.id === selectedGuided.learning_item.id,
    );
    const nextEntry = guidedItems[(currentIndex + 1) % guidedItems.length];
    setSelectedGuidedItemId(nextEntry.learning_item.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 no-underline" to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </Link>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-medium text-ink transition hover:border-coral"
          onClick={() => invalidateCourseQueries()}
          type="button"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh data
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel overflow-hidden px-7 py-8 md:px-9">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-coral/15 px-4 py-2 text-sm font-medium text-coral">
              {overview.course.subject}
            </span>
            <StatusChip label={statusQuery.data?.status ?? overview.readiness} />
            <span className="rounded-full bg-ink/5 px-4 py-2 text-sm text-ink/65">
              {overview.topics.length} topics mapped
            </span>
          </div>
          <h1 className="font-display text-5xl leading-[0.95] text-ink md:text-6xl">
            {overview.course.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-ink/72">
            {overview.course.summary || "Upload slides or notes to generate a summary and study plan."}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <MetricCard
              icon={<Files className="h-5 w-5" />}
              label="Assets"
              value={String(statusQuery.data?.assets.length ?? overview.assets.length)}
              detail={`${statusQuery.data?.ready_assets ?? 0} ready`}
            />
            <MetricCard
              icon={<BookCopy className="h-5 w-5" />}
              label="Flashcards"
              value={String(overview.learning_counts.flashcard ?? 0)}
              detail={`${overview.learning_counts.quiz ?? 0} quiz prompts`}
            />
            <MetricCard
              icon={<Target className="h-5 w-5" />}
              label="Weak topics"
              value={String(overview.weak_topics.length)}
              detail="used to shape guided review"
            />
          </div>
        </div>

        <div className="glass-panel px-7 py-8 text-ink">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-coral/12 p-3">
              <UploadCloud className="h-6 w-6 text-coral" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-ink/55">Upload material</div>
              <div className="font-display text-3xl">Add a PDF or slide deck</div>
            </div>
          </div>
          <p className="text-sm text-ink/72">
            Upload course files into this container. Each new asset gets parsed into source-linked
            study items and the guided queue will refresh when processing finishes.
          </p>
          <label className="mt-6 block cursor-pointer rounded-[26px] border border-dashed border-ink/10 bg-white/80 px-5 py-7 text-center transition hover:border-coral">
            <input className="hidden" type="file" accept=".pdf,.pptx" onChange={handleFileChange} />
            <div className="text-sm font-semibold text-ink">Choose a `.pdf` or `.pptx`</div>
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-ink/50">
              Source-linked analysis
            </div>
          </label>
          <div className="mt-4 text-sm text-ink/75">
            {uploadMutation.isPending
              ? `Uploading ${selectedUploadName || "file"}...`
              : selectedUploadName
                ? `${selectedUploadName} queued for analysis.`
                : "No new upload in progress."}
          </div>
          {uploadMutation.error ? (
            <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-ink">
              {(uploadMutation.error as Error).message}
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass-panel px-4 py-4 md:px-6">
        <div className="flex flex-wrap gap-2">
          <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <TabButton label="Tutor" active={activeTab === "tutor"} onClick={() => setActiveTab("tutor")} />
          <TabButton label="Flashcards" active={activeTab === "flashcards"} onClick={() => setActiveTab("flashcards")} />
          <TabButton label="Quiz" active={activeTab === "quiz"} onClick={() => setActiveTab("quiz")} />
          <TabButton label="Guided Learning" active={activeTab === "guided"} onClick={() => setActiveTab("guided")} />
        </div>
      </section>

      {activeTab === "overview" ? (
        <OverviewPanel overview={overview} status={statusQuery.data?.status ?? overview.readiness} />
      ) : null}

      {activeTab === "tutor" ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel px-6 py-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Tutor mode</div>
                <h2 className="section-title">Socratic coaching</h2>
              </div>
              <button
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
                onClick={() => startTutorMutation.mutate()}
                type="button"
              >
                {startTutorMutation.isPending ? "Starting..." : tutorSessionId ? "Restart tutor" : "Start tutor"}
              </button>
            </div>

            <div className="space-y-4 rounded-[28px] bg-ink/5 p-4">
              {tutorMessages.length ? (
                tutorMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[85%] rounded-[22px] px-4 py-3 text-sm ${
                      message.role === "assistant" ? "bg-white text-ink" : "ml-auto bg-ink text-white"
                    }`}
                  >
                    {message.content}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/60">
                  Start a tutor session to begin a source-backed guided conversation.
                </div>
              )}
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleTutorSubmit}>
              <textarea
                className="h-32 w-full rounded-[24px] border border-ink/10 bg-white px-4 py-4 text-sm text-ink outline-none transition focus:border-coral"
                placeholder="Explain the concept back in your own words..."
                value={tutorDraft}
                onChange={(event) => setTutorDraft(event.target.value)}
              />
              <button
                className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!tutorSessionId || tutorMessageMutation.isPending}
                type="submit"
              >
                <MessageSquareQuote className="h-4 w-4" />
                {tutorMessageMutation.isPending ? "Thinking..." : "Send to tutor"}
              </button>
            </form>
          </div>

          <div className="glass-panel px-6 py-6">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Tutor signals</div>
            <h3 className="mt-2 font-display text-4xl text-ink">How the coach is steering</h3>
            <div className="mt-5 space-y-4">
              <InsightCard
                title="Current stage"
                body={
                  tutorStage === "hint"
                    ? "The tutor thinks you need a bridge idea or missing link, so it is nudging with a hint rather than a direct explanation."
                    : tutorSessionId
                      ? "The tutor is ready to keep pushing your explanation deeper one question at a time."
                      : "No tutor session is running yet."
                }
              />
              <InsightCard
                title="Socratic behavior"
                body="This mode asks a leading question first, then introduces a hint, and only later fills in the missing explanation."
              />
              <InsightCard
                title="Why it cites sources"
                body="Tutor prompts are grounded in the uploaded material so the student can always trace the question back to the original lecture content."
              />
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "flashcards" ? (
        <section className="glass-panel px-6 py-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Flashcard mode</div>
              <h2 className="section-title">Confidence-aware review</h2>
            </div>
            <div className="text-sm text-ink/60">
              {flashcards.length ? `${flashcardIndex + 1} / ${flashcards.length}` : "No cards yet"}
            </div>
          </div>

          {currentFlashcard ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-ink/10 bg-white px-6 py-7 text-ink">
                <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Prompt</div>
                <div className="mt-3 font-display text-4xl">{currentFlashcard.prompt}</div>

                <div className="mt-8 rounded-[24px] bg-coral/10 p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-ink/50">Answer</div>
                  {flashcardRevealed ? (
                    <div className="mt-3 space-y-4">
                      <p className="text-sm leading-7 text-ink/85">{currentFlashcard.answer_key}</p>
                      <div className="space-y-2 text-xs text-ink/60">
                        {currentFlashcard.source_refs.map((ref) => (
                          <div key={ref.label}>{ref.label}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-ink/70">
                      Reveal the answer, then rate how confident you feel with the idea.
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!flashcardRevealed ? (
                    <button
                      className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral/90"
                      onClick={() => setFlashcardRevealed(true)}
                      type="button"
                    >
                      Reveal answer
                    </button>
                  ) : (
                    <>
                      <button
                        className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral/90 disabled:opacity-50"
                        disabled={flashcardConfidence === null || flashcardAttemptMutation.isPending}
                        onClick={() =>
                          currentFlashcard &&
                          flashcardConfidence !== null &&
                          flashcardAttemptMutation.mutate({
                            itemId: currentFlashcard.id,
                            confidence: flashcardConfidence,
                          })
                        }
                        type="button"
                      >
                        {flashcardAttemptMutation.isPending ? "Saving..." : "Save confidence"}
                      </button>
                      <button
                        className="rounded-full border border-ink/10 px-5 py-3 text-sm font-medium text-ink transition hover:border-coral disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!flashcardFeedback}
                        onClick={moveToNextFlashcard}
                        type="button"
                      >
                        Next card
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-panel px-5 py-5">
                  <ConfidenceSelector
                    label="After seeing the answer, how confident do you feel?"
                    value={flashcardConfidence}
                    onChange={setFlashcardConfidence}
                  />
                </div>
                <div className="glass-panel px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Why the rating matters</div>
                  <p className="mt-3 text-sm leading-7 text-ink/72">
                    A low flashcard confidence score raises this topic's guided-learning priority even
                    if you recognized the answer once the card flipped.
                  </p>
                  {flashcardFeedback ? (
                    <div className="mt-4 rounded-[22px] bg-coral/10 px-4 py-4 text-sm text-ink">
                      {flashcardFeedback.feedback}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState body="Upload material first. Flashcards appear after the ingestion pipeline turns the course into study items." />
          )}
        </section>
      ) : null}

      {activeTab === "quiz" ? (
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-panel px-6 py-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Quiz mode</div>
                <h2 className="section-title">Short-answer recall</h2>
              </div>
              <button
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
                onClick={() => startQuizMutation.mutate()}
                type="button"
              >
                {startQuizMutation.isPending ? "Building..." : "Generate quiz"}
              </button>
            </div>

            {activeQuizItem ? (
              <div className="space-y-5">
                <div className="rounded-[28px] bg-ink/5 p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-ink/55">
                    Question {quizIndex + 1} of {quizItems.length}
                  </div>
                  <div className="mt-3 font-display text-3xl text-ink">{activeQuizItem.prompt}</div>
                  <div className="mt-4 space-y-2 text-xs text-ink/50">
                    {activeQuizItem.source_refs.map((ref) => (
                      <div key={ref.label}>{ref.label}</div>
                    ))}
                  </div>
                </div>

                <textarea
                  className="h-36 w-full rounded-[24px] border border-ink/10 bg-white px-4 py-4 text-sm text-ink outline-none transition focus:border-coral"
                  placeholder="Explain it back in your own words..."
                  value={quizAnswer}
                  onChange={(event) => setQuizAnswer(event.target.value)}
                />

                <ConfidenceSelector
                  label="Before you see feedback, how confident are you in this answer?"
                  value={quizConfidence}
                  onChange={setQuizConfidence}
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!quizAnswer.trim() || quizConfidence === null || submitQuizMutation.isPending}
                    onClick={() =>
                      activeQuizItem &&
                      quizConfidence !== null &&
                      submitQuizMutation.mutate({
                        itemId: activeQuizItem.id,
                        answer: quizAnswer,
                        confidence: quizConfidence,
                      })
                    }
                    type="button"
                  >
                    {submitQuizMutation.isPending ? "Checking..." : "Submit answer"}
                  </button>
                  <button
                    className="rounded-full border border-ink/10 px-5 py-3 text-sm font-medium text-ink transition hover:border-coral disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!quizFeedback}
                    onClick={nextQuizItem}
                    type="button"
                  >
                    Next question
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState body="Generate a quiz to turn your current topics into short-answer prompts." />
            )}
          </div>

          <div className="space-y-4">
            <div className="glass-panel px-5 py-5">
              <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Feedback</div>
              {quizFeedback ? (
                <>
                  <div className="mt-3 rounded-[24px] bg-coral/10 px-4 py-4 text-sm leading-7 text-ink">
                    {quizFeedback.feedback}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ScoreCard label="Mastery" value={`${Math.round(quizFeedback.mastery_score * 100)}%`} />
                    <ScoreCard label="Priority" value={`${Math.round(quizFeedback.priority_score)}`} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-7 text-ink/72">
                  Submit an answer and a confidence rating to see how this topic shifts in guided
                  learning.
                </p>
              )}
            </div>

            <div className="glass-panel px-5 py-5">
              <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Why quiz confidence matters</div>
              <p className="mt-3 text-sm leading-7 text-ink/72">
                Correct but low-confidence answers still count as shaky knowledge, so the guided tab
                keeps those topics near the top until they feel stable.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "guided" ? (
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-panel px-5 py-5">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Priority queue</div>
              <h2 className="section-title">Guided learning</h2>
            </div>

            {guidedItems.length ? (
              <div className="space-y-3">
                {guidedItems.map((entry) => (
                  <button
                    key={entry.topic.id}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      selectedGuided?.learning_item.id === entry.learning_item.id
                        ? "border-coral bg-coral/10"
                        : "border-ink/10 bg-white hover:border-coral/35"
                    }`}
                    onClick={() => setSelectedGuidedItemId(entry.learning_item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-ink">{entry.topic.title}</div>
                        <div className="mt-2 text-sm text-ink/65">
                          Priority {Math.round(entry.dynamic_priority)} - Mastery{" "}
                          {Math.round(entry.topic.mastery_score * 100)}%
                        </div>
                      </div>
                      <Layers2 className="mt-1 h-5 w-5 text-coral" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState body="Guided learning appears once the course has topics and study items." />
            )}
          </div>

          <div className="glass-panel px-6 py-6">
            {selectedGuided ? (
              <GuidedDetail
                answer={guidedAnswer}
                confidence={guidedConfidence}
                entry={selectedGuided}
                feedback={guidedFeedback}
                isSubmitting={guidedAttemptMutation.isPending}
                onAnswerChange={setGuidedAnswer}
                onConfidenceChange={setGuidedConfidence}
                onNext={moveToNextGuidedTopic}
                onSubmit={() => {
                  if (!selectedGuided || guidedConfidence === null || !guidedAnswer.trim()) {
                    return;
                  }
                  guidedAttemptMutation.mutate({
                    itemId: selectedGuided.learning_item.id,
                    answer: guidedAnswer,
                    confidence: guidedConfidence,
                  });
                }}
              />
            ) : (
              <EmptyState body="Choose a prioritized topic to see its recap, guiding question, hint, and quick check." />
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function OverviewPanel({ overview, status }: { overview: Overview; status: string }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="glass-panel px-6 py-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-ink p-3 text-white">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Course map</div>
            <h2 className="section-title">Topic coverage</h2>
          </div>
        </div>
        <div className="space-y-4">
          {overview.topics.length ? (
            overview.topics.map((topic) => (
              <div key={topic.id} className="rounded-[24px] border border-ink/10 bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{topic.title}</div>
                    <div className="mt-2 text-sm text-ink/65">{topic.summary}</div>
                  </div>
                  <div className="rounded-full bg-ink/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink/60">
                    Priority {Math.round(topic.priority_score)}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-ink/55">
                    <span>Mastery</span>
                    <span>{Math.round(topic.mastery_score * 100)}%</span>
                  </div>
                  <div className="meter-bar">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-coral to-teal"
                      style={{ width: `${Math.max(topic.mastery_score * 100, 6)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState body="The topic map will fill in once at least one upload finishes processing." />
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-panel px-6 py-6">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Ingestion status</div>
          <h2 className="mt-2 font-display text-4xl text-ink">Source pipeline</h2>
          <div className="mt-5 rounded-[24px] bg-ink/5 px-4 py-4 text-sm text-ink">
            Current state: <strong>{status}</strong>
          </div>
          <div className="mt-4 space-y-3">
            {overview.assets.length ? (
              overview.assets.map((asset) => (
                <div key={asset.id} className="rounded-[22px] border border-ink/10 bg-white/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-ink">{asset.original_filename}</div>
                      <div className="mt-1 text-sm text-ink/60">
                        {asset.type.toUpperCase()} - {asset.status}
                      </div>
                    </div>
                    <StatusChip label={asset.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState body="No source files uploaded yet." />
            )}
          </div>
        </div>

        <div className="glass-panel px-6 py-6">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Weakest first</div>
          <h2 className="mt-2 font-display text-4xl text-ink">What guided learning will attack</h2>
          <div className="mt-5 space-y-3">
            {overview.weak_topics.length ? (
              overview.weak_topics.map((topic) => (
                <div key={topic.id} className="rounded-[24px] border border-coral/20 bg-coral/10 px-4 py-4">
                  <div className="font-semibold text-ink">{topic.title}</div>
                  <div className="mt-2 text-sm text-ink/72">{topic.summary}</div>
                </div>
              ))
            ) : (
              <EmptyState body="Weak topics appear after the first study items are generated." />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuidedDetail({
  answer,
  confidence,
  entry,
  feedback,
  isSubmitting,
  onAnswerChange,
  onConfidenceChange,
  onNext,
  onSubmit,
}: {
  answer: string;
  confidence: number | null;
  entry: GuidedLearningResponse["items"][number];
  feedback: AttemptResult | null;
  isSubmitting: boolean;
  onAnswerChange: (value: string) => void;
  onConfidenceChange: (value: number) => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Selected guided step</div>
      <h2 className="mt-2 font-display text-5xl leading-[0.98] text-ink">{entry.topic.title}</h2>
      <p className="mt-4 text-base leading-8 text-ink/72">{entry.topic.summary}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-teal/20 bg-teal/10 px-5 py-5 text-ink">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Lead with this</div>
          <div className="mt-3 text-lg font-semibold">{entry.learning_item.prompt}</div>
        </div>
        <div className="rounded-[24px] bg-coral/12 px-5 py-5 text-ink">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Hint</div>
          <div className="mt-3 text-sm leading-7">{entry.learning_item.hint}</div>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-ink/10 bg-white/70 px-5 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Quick check</div>
        <div className="mt-3 text-lg font-medium text-ink">{entry.learning_item.quick_check}</div>
      </div>

      <div className="mt-4 rounded-[24px] border border-ink/10 bg-white/70 px-5 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Your explanation</div>
        <textarea
          className="mt-3 h-36 w-full rounded-[24px] border border-ink/10 bg-white px-4 py-4 text-sm text-ink outline-none transition focus:border-coral"
          placeholder="Explain the concept in your own words, then rate your confidence."
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
        />

        <div className="mt-5">
          <ConfidenceSelector
            label="How confident are you after working through this step?"
            value={confidence}
            onChange={onConfidenceChange}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!answer.trim() || confidence === null || isSubmitting}
            onClick={onSubmit}
            type="button"
          >
            {isSubmitting ? "Saving..." : "Submit guided response"}
          </button>
          <button
            className="rounded-full border border-ink/10 px-5 py-3 text-sm font-medium text-ink transition hover:border-coral disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!feedback}
            onClick={onNext}
            type="button"
          >
            Next priority topic
          </button>
        </div>

        {feedback ? (
          <div className="mt-5 rounded-[22px] bg-coral/10 px-4 py-4 text-sm leading-7 text-ink">
            <div>{feedback.feedback}</div>
            <div className="mt-3 text-xs uppercase tracking-[0.18em] text-ink/55">
              Mastery {Math.round(feedback.mastery_score * 100)}% - Priority {Math.round(feedback.priority_score)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-[24px] border border-ink/10 bg-white/70 px-5 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Source trail</div>
        <div className="mt-3 space-y-2 text-sm text-ink/70">
          {entry.learning_item.source_refs.map((ref) => (
            <div key={ref.label}>{ref.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-ink/8 bg-white/65 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white">
        {icon}
      </div>
      <div className="text-xs uppercase tracking-[0.18em] text-ink/50">{label}</div>
      <div className="mt-2 font-display text-4xl text-ink">{value}</div>
      <div className="mt-2 text-sm text-ink/60">{detail}</div>
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  const palette =
    label === "ready"
      ? "bg-teal/15 text-teal"
      : label === "failed"
        ? "bg-red-500/10 text-red-600"
        : "bg-gold/15 text-gold";

  return (
    <span className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${palette}`}>
      {label}
    </span>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-ink/10 bg-white px-4 py-4 text-ink">
      <div className="text-xs uppercase tracking-[0.18em] text-ink/55">{label}</div>
      <div className="mt-2 font-display text-4xl">{value}</div>
    </div>
  );
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-ink/10 bg-white/70 px-4 py-4">
      <div className="font-semibold text-ink">{title}</div>
      <p className="mt-2 text-sm leading-7 text-ink/70">{body}</p>
    </div>
  );
}

function EmptyState({ body }: { body: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-ink/60">
      {body}
    </div>
  );
}
