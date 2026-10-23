import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, FileQuestion, PauseCircle, Pencil, Check, Zap, CircleAlert, Loader2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import TerminalLog from '../../components/generation/TerminalLog';
import ProgressBar from '../../components/generation/ProgressBar';
import EditableLessonContent from '../../components/generation/EditableLessonContent';
import EditableQuizContent from '../../components/generation/EditableQuizContent';
import StudioErrorBoundary from '../../components/generation/StudioErrorBoundary';

/**
 * The generation studio — a fullscreen two-pane view the teacher watches while
 * AI content streams in: live activity on the left, the actual lessons and
 * quizzes materializing (and inline-editable) on the right.
 *
 * If the stream dies partway (rate limits, network), everything already
 * finished stays saved and a Continue banner lets the teacher finish the rest
 * without starting over.
 */

/** Click-to-edit title for the selected lesson/quiz. Persists through the same
 *  endpoints the editors use (PUT /teacher/lessons/{id} or /teacher/quizzes/{id}). */
function EditableTitle({ item, onRename }) {
  const editable = !!item.generated && typeof item.id === 'number';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(item.title); }, [item.title, item.id]);

  const commit = async () => {
    setEditing(false);
    const next = value.trim();
    if (!editable || !next || next === item.title) return;
    setSaving(true);
    const endpoint = item.type === 'quiz' ? `/teacher/quizzes/${item.id}` : `/teacher/lessons/${item.id}`;
    try {
      await api.put(endpoint, { title: next });
      onRename(item.id, next);
    } catch {
      setValue(item.title);
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return <h2 style={{ marginBottom: 10, color: 'var(--db-text)', fontFamily: 'var(--db-font-display)', fontSize: 26, fontWeight: 700 }}>{item.title}</h2>;
  }

  if (editing) {
    return (
      <div style={{ marginBottom: 10, gap: 8 }} className="flex items-center">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(item.title); setEditing(false); } e.stopPropagation(); }}
          className="gen-input"
          style={{ fontFamily: 'var(--db-font-display)', fontWeight: 700, fontSize: 18 }}
        />
        <button onClick={commit} className="gen-btn gen-btn-primary" style={{ padding: '8px 12px' }}>
          {saving ? '…' : <Check size={14} />}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10, gap: 8 }} className="group/title flex items-center">
      <h2 style={{ color: 'var(--db-text)', fontFamily: 'var(--db-font-display)', fontSize: 26, fontWeight: 700, margin: 0 }}>{item.title}</h2>
      <button
        onClick={() => setEditing(true)}
        style={{ padding: '4px 9px', gap: 5, borderRadius: 8, fontSize: 11, fontWeight: 700, border: '1px solid var(--db-border-strong)', background: 'var(--db-card-2)', color: 'var(--db-text-2)' }}
        className="inline-flex items-center opacity-0 group-hover/title:opacity-100 transition-all cursor-pointer"
      >
        <Pencil size={11} /> Rename
      </button>
    </div>
  );
}

export default function GenerationConsole({
  isOpen,
  generatedContent,
  isGenerating,
  logs = [],
  onClose,
  onContentChange,
  onContinue,
  onPause,
  paused,
  startedAt,
  courseLanguage
}) {
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [completedLessonsList, setCompletedLessonsList] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [displayedBlocks, setDisplayedBlocks] = useState({});
  const [activeTab, setActiveTab] = useState('activity');
  const lessonContentRef = useRef(null);
  const tabTouchedRef = useRef(false);

  // Calculate overall progress and collect completed lessons (including quizzes)
  useEffect(() => {
    if (!generatedContent?.modules) return;

    let completed = 0;
    let total = 0;
    const lessons = [];

    generatedContent.modules.forEach(module => {
      // Count lessons - show in tabs as soon as they have blocks (not waiting for generated flag)
      module.lessons?.forEach(lesson => {
        if (lesson.blocks && lesson.blocks.length > 0) {
          lessons.push({
            // Lessons and quizzes live in separate id tables — their numeric
            // ids collide, so selection/keys must be namespaced by type or a
            // quiz click highlights (and opens) a same-numbered lesson.
            key: `lesson-${lesson.id}`,
            id: lesson.id,
            title: lesson.title,
            blocks: lesson.blocks || [],
            moduleTitle: module.title,
            type: 'lesson',
            generated: !!lesson.generated
          });
        }
        if (lesson.generated) {
          completed++;
        }
        total++;
      });

      // Add quizzes to preview list
      module.quizzes?.forEach(quiz => {
        if (quiz.generated || (quiz.questions && quiz.questions.length > 0)) {
          lessons.push({
            key: `quiz-${quiz.id}`,
            id: quiz.id,
            title: quiz.title,
            questions: quiz.questions || [],
            moduleTitle: module.title,
            type: 'quiz',
            generated: !!quiz.generated
          });
        }
        if (quiz.generated) {
          completed++;
        }
        total++;
      });
    });

    setCompletedLessons(completed);
    setCompletedLessonsList(lessons);
    // Auto-select first lesson as soon as it appears
    if (lessons.length > 0 && !selectedLessonId) {
      setSelectedLessonId(lessons[0].key);
    }
    // Jump to the content tab the moment there is something to look at,
    // unless the teacher deliberately chose the activity feed
    if (lessons.length > 0 && !tabTouchedRef.current) {
      setActiveTab('content');
    }
    const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    setOverallProgress(newProgress);
  }, [generatedContent]);

  // Auto-select first lesson when lessons list changes
  useEffect(() => {
    if (completedLessonsList.length > 0) {
      if (!selectedLessonId || !completedLessonsList.find(l => l.key === selectedLessonId)) {
        setSelectedLessonId(completedLessonsList[0].key);
      }
    }
  }, [completedLessonsList]);

  // Stagger block display for section-by-section effect
  useEffect(() => {
    if (!selectedLessonId || completedLessonsList.length === 0) return;

    const lesson = completedLessonsList.find(l => l.key === selectedLessonId);
    if (!lesson) return;

    const blockCount = lesson.blocks?.length || 0;
    const currentCount = displayedBlocks[selectedLessonId] || 0;

    // Persisted lessons (and finished runs) render fully — the teacher may be
    // editing them, so never drip-feed blocks they're looking at.
    if (lesson.generated || !isGenerating) {
      if (currentCount < blockCount) {
        setDisplayedBlocks(prev => ({ ...prev, [selectedLessonId]: blockCount }));
      }
      return;
    }

    // While generating, stagger the reveal
    if (currentCount < blockCount) {
      const timer = setTimeout(() => {
        setDisplayedBlocks(prev => ({
          ...prev,
          [selectedLessonId]: Math.min((prev[selectedLessonId] || 0) + 1, blockCount)
        }));
      }, 300 + Math.random() * 200); // Natural stagger 300-500ms

      return () => clearTimeout(timer);
    }
  }, [selectedLessonId, completedLessonsList, displayedBlocks, isGenerating]);

  const totalItems = generatedContent?.modules?.reduce(
    (sum, m) => sum + (m.lessons?.length || 0) + (m.quizzes?.length || 0),
    0
  ) || 0;
  const remainingItems = totalItems - completedLessons;

  // An interrupted run: the stream ended while items are still missing. The
  // teacher can push the AI to finish exactly those — nothing starts over.
  const interrupted = !isGenerating && totalItems > 0 && remainingItems > 0;

  // Honest clock: how long this run has actually been going (a fabricated
  // "minutes remaining" was always wrong the moment an LLM call varied)
  const elapsedMin = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : 0;

  const selectedLesson = completedLessonsList.find(l => l.key === selectedLessonId);
  const visibleBlockCount = displayedBlocks[selectedLessonId] || 0;

  // Auto-scroll lesson content to bottom when new blocks appear — but only
  // for lessons still streaming. A completed lesson may be open for inline
  // editing and must never be yanked around.
  const selectedLessonForScroll = completedLessonsList.find(l => l.key === selectedLessonId);
  useEffect(() => {
    if (!isGenerating) return;
    if (selectedLessonForScroll?.generated) return;
    if (lessonContentRef.current) {
      requestAnimationFrame(() => {
        if (lessonContentRef.current) {
          lessonContentRef.current.scrollTop = lessonContentRef.current.scrollHeight;
        }
      });
    }
  }, [visibleBlockCount, isGenerating, selectedLessonForScroll?.generated]);

  // Update one lesson's blocks (from the inline editor) inside generatedContent.
  const handleLessonBlocksChange = (lessonId, nextBlocks) => {
    onContentChange?.(prev => ({
      ...prev,
      modules: prev.modules.map(m => ({
        ...m,
        lessons: m.lessons.map(l => (l.id === lessonId ? { ...l, blocks: nextBlocks } : l))
      }))
    }));
  };

  // Rename a lesson or quiz from the console (updates tabs + editors live).
  const handleRename = (itemId, nextTitle) => {
    onContentChange?.(prev => ({
      ...prev,
      modules: prev.modules.map(m => ({
        ...m,
        lessons: m.lessons.map(l => (l.id === itemId ? { ...l, title: nextTitle } : l)),
        quizzes: m.quizzes.map(q => (q.id === itemId ? { ...q, title: nextTitle } : q))
      }))
    }));
  };

  // Update one question inside a generated quiz.
  const handleQuizQuestionsChange = (quizId, nextQuestions) => {
    onContentChange?.(prev => ({
      ...prev,
      modules: prev.modules.map(m => ({
        ...m,
        quizzes: m.quizzes.map(q => (q.id === quizId ? { ...q, questions: nextQuestions } : q))
      }))
    }));
  };

  const handleFinish = () => {
    if (isGenerating) {
      setShowFinishConfirm(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="gc-root fixed inset-0 flex flex-col"
      style={{ zIndex: 200, background: 'var(--db-canvas)', color: 'var(--db-text)' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: 16, borderBottom: '1px solid var(--db-border)', flexShrink: 0,
          background: 'var(--db-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: 'var(--db-accent)', color: '#ffffff', fontFamily: 'var(--db-font-display)',
              fontWeight: 700, fontSize: 15,
            }}
          >
            AI
          </div>
          <div>
            <span className="ed-card-label">Making your content</span>
            <h1 style={{ margin: 0, color: 'var(--db-text)', fontFamily: 'var(--db-font-display)', fontSize: 19, fontWeight: 700 }}>
              Your content, as it's built
            </h1>
          </div>
          {isGenerating && (
            <span style={{ gap: 7 }} className="inline-flex items-center gen-note">
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--db-accent-bright)' }} />
              Generating…
            </span>
          )}
          {interrupted && (
            <span
              style={{
                gap: 6, color: 'var(--db-amber)', border: '1px solid var(--db-amber)',
                background: 'rgba(251, 191, 36, 0.08)', borderRadius: 999, padding: '3px 11px',
                fontSize: 11.5, fontWeight: 700,
              }}
              className="inline-flex items-center"
            >
              <CircleAlert size={12} /> {paused ? 'Paused' : 'Stopped early'}
            </span>
          )}
          {!isGenerating && !interrupted && totalItems > 0 && (
            <span
              style={{
                gap: 6, color: 'var(--db-green)', border: '1px solid var(--db-green-border)',
                background: 'var(--db-green-soft)', borderRadius: 999, padding: '3px 11px',
                fontSize: 11.5, fontWeight: 700,
              }}
              className="inline-flex items-center"
            >
              <Check size={12} /> Complete
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isGenerating && onPause && (
            <button
              onClick={onPause}
              className="gen-btn gen-btn-ghost"
              title="Pause — the AI stops here; everything finished stays saved and you can continue later"
            >
              <PauseCircle size={15} /> Pause
            </button>
          )}
          <button
            onClick={handleFinish}
            className={isGenerating ? 'gen-btn gen-btn-ghost' : 'gen-btn gen-btn-primary'}
            title={isGenerating ? 'Stop generating — everything finished so far stays saved' : 'Close the studio'}
          >
            {isGenerating ? <><Zap size={14} /> Stop</> : <><Check size={14} /> Finish</>}
          </button>
        </div>
      </div>

      {/* Progress + continue banner */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--db-border)', flexShrink: 0 }}>
        <ProgressBar value={overallProgress} label={`${completedLessons} of ${totalItems} items generated`} />
        <div style={{ gap: 14, marginTop: 10, color: 'var(--db-text-3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} className="flex items-center">
          <span>{overallProgress}% complete</span>
          {isGenerating && <span>· started {elapsedMin} min ago</span>}
        </div>
        {interrupted && (
          <div
            style={{
              marginTop: 12, padding: '12px 16px', borderRadius: 12, gap: 12,
              display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              background: 'rgba(251, 191, 36, 0.08)', border: '1px solid var(--db-amber)',
            }}
          >
            <CircleAlert size={16} style={{ color: 'var(--db-amber)', flex: 'none' }} />
            <p style={{ margin: 0, flex: '1 1 220px', minWidth: 220, color: 'var(--db-text)', fontSize: 13.5 }}>
              {paused
                ? <>Paused — <strong>{completedLessons} of {totalItems}</strong> items are done and saved.</>
                : <>The AI stopped before finishing — <strong>{completedLessons} of {totalItems}</strong> items are done and saved.</>}
              {' '}Continue to generate only the missing {remainingItems}.
            </p>
            {onContinue && (
              <button onClick={onContinue} className="gen-btn gen-btn-primary" style={{ padding: '9px 16px', flex: 'none' }}>
                <Zap size={13} /> Continue generation
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area — two tabs, each full width */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        style={{ padding: '10px 28px', borderBottom: '1px solid var(--db-border)', background: 'var(--db-card)' }}
      >
        {[
          ['activity', 'Progress'],
          ['content', 'Lessons & quizzes'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setActiveTab(key); tabTouchedRef.current = true; }}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${activeTab === key ? 'var(--db-accent-border)' : 'var(--db-border)'}`,
              background: activeTab === key ? 'var(--db-accent-soft)' : 'transparent',
              color: activeTab === key ? 'var(--db-accent-bright)' : 'var(--db-text-2)',
            }}
          >
            {label}
            {key === 'activity' && isGenerating && (
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--db-accent-bright)', display: 'inline-block' }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Activity feed tab */}
        {activeTab === 'activity' && (
          <div
            style={{ padding: '22px 26px', background: 'var(--db-card)' }}
            className="w-full overflow-hidden flex flex-col flex-1"
          >
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              <StudioErrorBoundary>
                <TerminalLog logs={logs} />
              </StudioErrorBoundary>
            </div>

            {isGenerating && (
              <div
                style={{ padding: '12px 16px', marginTop: 14, gap: 10, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', background: 'var(--db-card-2)', border: '1px solid var(--db-border)' }}
              >
                <motion.div
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--db-accent-bright)' }}
                />
                <span className="gen-note">
                  Generating item {Math.min(completedLessons + 1, totalItems)} of {totalItems}…
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content tab: materializing + inline editing */}
        {activeTab === 'content' && (
        <div className="w-full overflow-hidden flex flex-col flex-1" style={{ background: 'var(--db-canvas)' }}>
          {/* Item tabs */}
          <div style={{ padding: '16px 26px', borderBottom: '1px solid var(--db-border)', overflowX: 'auto', flexShrink: 0, background: 'var(--db-card)' }}>
            <div style={{ gap: 8 }} className="flex">
              {completedLessonsList.map((lesson) => {
                const isLesson = lesson.type === 'lesson';
                const isSelected = selectedLessonId === lesson.key;

                return (
                  <button
                    key={lesson.key}
                    onClick={() => setSelectedLessonId(lesson.key)}
                    style={{
                      padding: '9px 14px', gap: 7, borderRadius: 10, fontSize: 13, fontWeight: 600,
                      whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                      border: `1px solid ${isSelected ? 'var(--db-accent-border)' : 'var(--db-border)'}`,
                      background: isSelected ? 'var(--db-accent-soft)' : 'var(--db-card-2)',
                      color: isSelected ? 'var(--db-accent-bright)' : 'var(--db-text-2)',
                    }}
                    title={lesson.generated ? 'Generated — inline editing is live' : 'Still generating'}
                  >
                    {isLesson ? <BookOpen size={15} /> : <FileQuestion size={15} />}
                    <span>{lesson.title}</span>
                    {!lesson.generated && <Loader2 size={11} className="animate-spin" style={{ opacity: 0.7 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area - Lessons or Quizzes */}
          <div ref={lessonContentRef} style={{ padding: '26px 32px' }} className="flex-1 overflow-y-auto">
            <StudioErrorBoundary>
            {selectedLesson ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div>
                  <h3 className="ed-card-label" style={{ marginBottom: 6 }}>
                    {selectedLesson.moduleTitle}
                    {selectedLesson.type === 'quiz' && ' · Quiz'}
                  </h3>
                  <EditableTitle item={selectedLesson} onRename={handleRename} />
                  {!selectedLesson.generated && (
                    <p className="gen-note" style={{ gap: 6 }} >
                      Inline editing unlocks for this {selectedLesson.type === 'quiz' ? 'quiz' : 'lesson'} as soon as its generation completes.
                    </p>
                  )}
                </div>

                {/* Lesson Content (inline-editable once the lesson is persisted) */}
                {selectedLesson.type === 'lesson' && (
                  <EditableLessonContent
                    lesson={selectedLesson}
                    onBlocksChange={handleLessonBlocksChange}
                    courseLanguage={courseLanguage}
                  />
                )}

                {/* Quiz Content (inline-editable once real question ids sync) */}
                {selectedLesson.type === 'quiz' && (
                  <EditableQuizContent
                    questions={selectedLesson.questions || []}
                    onQuestionsChange={(next) => handleQuizQuestionsChange(selectedLesson.id, next)}
                    quizId={typeof selectedLesson.id === 'number' ? selectedLesson.id : null}
                    courseLanguage={courseLanguage}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--db-text-3)' }}>
                <p style={{ fontSize: 16, textAlign: 'center', padding: '0 24px' }}>
                  Nothing here yet — follow the live progress in the Activity tab.
                  Lessons and quizzes will appear here the moment they are written.
                </p>
              </div>
            )}
            </StudioErrorBoundary>
          </div>
        </div>
        )}
      </div>

      {/* Finish Confirmation Dialog */}
      <AnimatePresence>
        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="gen-overlay"
            style={{ zIndex: 201 }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFinishConfirm(false)}
              className="gen-backdrop"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="gen-card"
              style={{ width: 'min(100%, 460px)' }}
            >
              <h3 style={{ margin: 0, color: 'var(--db-text)', fontFamily: 'var(--db-font-display)', fontSize: 19, fontWeight: 700 }}>
                Stop generating?
              </h3>
              <p className="gen-note" style={{ fontSize: 14 }}>
                Everything already generated and saved stays in your class — only the remaining items won't be created. You can continue any time.
              </p>
              <div className="gen-foot">
                <button onClick={() => setShowFinishConfirm(false)} className="gen-btn gen-btn-ghost">
                  Keep generating
                </button>
                <button onClick={() => { setShowFinishConfirm(false); onClose(); }} className="gen-btn gen-btn-primary">
                  Stop &amp; keep progress
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
