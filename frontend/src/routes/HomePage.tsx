import { type FormEvent, type ReactNode, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, Brain, Layers3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { createCourse, listCourses } from "../lib/api";
import type { Profile } from "../lib/types";

type HomePageProps = {
  profile: Profile | null;
};

export function HomePage({ profile }: HomePageProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");

  const coursesQuery = useQuery({
    queryKey: ["courses", profile?.id],
    queryFn: () => listCourses(profile!),
    enabled: Boolean(profile),
  });

  const createCourseMutation = useMutation({
    mutationFn: (payload: { title: string; subject: string }) => createCourse(profile!, payload),
    onSuccess: (course) => {
      setTitle("");
      setSubject("");
      navigate(`/courses/${course.id}`);
    },
  });

  function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !title.trim() || !subject.trim()) {
      return;
    }
    createCourseMutation.mutate({ title: title.trim(), subject: subject.trim() });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel subtle-grid overflow-hidden px-7 py-8 md:px-10 md:py-10">
          <div className="mb-4 inline-flex rounded-full bg-coral/15 px-4 py-2 text-sm font-medium text-coral">
            Upload slides. Study smarter.
          </div>
          <h1 className="font-display text-5xl leading-[0.95] text-ink md:text-7xl">
            Turn class material into a tutor that actually pushes you to think.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink/72">
            Synapse Study ingests PDFs and PowerPoints, turns them into flashcards and quizzes,
            and keeps reshaping your guided review around the topics where your confidence is
            lowest.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FeatureStat
              icon={<BookOpenText className="h-5 w-5" />}
              title="Source-cited study sets"
              body="Each card, question, and tutor prompt points back to the original page or slide."
            />
            <FeatureStat
              icon={<Brain className="h-5 w-5" />}
              title="Socratic tutoring"
              body="The tutor leads with questions, then hints, before stepping in with the explanation."
            />
            <FeatureStat
              icon={<Layers3 className="h-5 w-5" />}
              title="Confidence-aware guided review"
              body="Every 1-5 confidence rating changes what rises to the top next."
            />
          </div>
        </div>

        <div className="glass-panel animate-fadeUp px-7 py-8 text-ink md:px-8 md:py-9">
          <div className="mb-4 text-xs uppercase tracking-[0.25em] text-ink/55">New course</div>
          <div className="font-display text-4xl">Create a study container</div>
          <p className="mt-3 text-sm text-ink/72">
            Group all related uploads by course so the app can connect weak topics over time.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleCreateCourse}>
            <label className="block text-sm font-medium text-ink">
              Course title
              <input
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink/35 focus:border-coral"
                placeholder="AP Chemistry Unit 6"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              Subject
              <input
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink/35 focus:border-coral"
                placeholder="Chemistry"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!profile || createCourseMutation.isPending}
              type="submit"
            >
              {createCourseMutation.isPending ? "Creating..." : "Create course"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {createCourseMutation.error ? (
            <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-ink">
              {(createCourseMutation.error as Error).message}
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass-panel px-7 py-8 md:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-ink/55">Dashboard</div>
            <h2 className="section-title">Your courses</h2>
          </div>
          <div className="text-sm text-ink/60">
            {coursesQuery.data?.courses.length ?? 0} course
            {(coursesQuery.data?.courses.length ?? 0) === 1 ? "" : "s"}
          </div>
        </div>

        {!profile ? (
          <div className="rounded-[24px] border border-dashed border-ink/15 px-6 py-8 text-sm text-ink/60">
            Create a local study profile to start organizing courses.
          </div>
        ) : coursesQuery.isLoading ? (
          <div className="rounded-[24px] border border-dashed border-ink/15 px-6 py-8 text-sm text-ink/60">
            Loading your study spaces...
          </div>
        ) : coursesQuery.data?.courses.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coursesQuery.data.courses.map((course) => (
              <Link
                key={course.id}
                className="group rounded-[26px] border border-ink/10 bg-white/70 p-5 no-underline transition hover:-translate-y-1 hover:border-coral/40"
                to={`/courses/${course.id}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-ink/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink/60">
                    {course.subject}
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink/35 transition group-hover:translate-x-1 group-hover:text-coral" />
                </div>
                <div className="font-display text-3xl leading-tight text-ink">{course.title}</div>
                <p className="mt-3 line-clamp-3 text-sm text-ink/65">
                  {course.summary || "Upload slides or lecture handouts to generate your first study guide."}
                </p>
                <div className="mt-5 text-xs uppercase tracking-[0.18em] text-ink/45">
                  Updated {new Date(course.updated_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-ink/15 px-6 py-10 text-sm text-ink/60">
            No courses yet. Create one above, then start uploading your PDFs or slide decks.
          </div>
        )}
      </section>
    </div>
  );
}

function FeatureStat({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-ink/8 bg-white/55 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white">
        {icon}
      </div>
      <div className="text-base font-semibold text-ink">{title}</div>
      <p className="mt-2 text-sm text-ink/65">{body}</p>
    </div>
  );
}
