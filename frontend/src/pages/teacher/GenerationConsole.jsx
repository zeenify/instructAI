import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, BookOpen, FileQuestion, Pencil } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import TerminalLog from '../../components/generation/TerminalLog';
import ProgressBar from '../../components/generation/ProgressBar';
import ModuleProgressCard from '../../components/generation/ModuleProgressCard';
import EditableLessonContent from '../../components/generation/EditableLessonContent';
import EditableQuizContent from '../../components/generation/EditableQuizContent';

export default function GenerationConsole({
  isOpen,
  generatedContent,
  isGenerating,
  logs = [],
  onClose,
  onContentChange
}) {
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [completedLessonsList, setCompletedLessonsList] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [displayedBlocks, setDisplayedBlocks] = useState({});
  const lessonContentRef = useRef(null);

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
      setSelectedLessonId(lessons[0].id);
    }
    const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    setOverallProgress(newProgress);
  }, [generatedContent]);

  // Auto-select first lesson when lessons list changes
  useEffect(() => {
    if (completedLessonsList.length > 0) {
      if (!selectedLessonId || !completedLessonsList.find(l => l.id === selectedLessonId)) {
        setSelectedLessonId(completedLessonsList[0].id);
      }
    }
  }, [completedLessonsList]);

  // Stagger block display for section-by-section effect
  useEffect(() => {
    if (!selectedLessonId || completedLessonsList.length === 0) return;

    const lesson = completedLessonsList.find(l => l.id === selectedLessonId);
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

  const estimatedTime =
    totalItems > 0
      ? Math.max(1, Math.ceil((totalItems - completedLessons) * 45 / 1000))
      : 0;

  const selectedLesson = completedLessonsList.find(l => l.id === selectedLessonId);
  const visibleBlockCount = displayedBlocks[selectedLessonId] || 0;

  // Auto-scroll lesson content to bottom when new blocks appear — but only
  // for lessons still streaming. A completed lesson may be open for inline
  // editing and must never be yanked around.
  const selectedLessonForScroll = completedLessonsList.find(l => l.id === selectedLessonId);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fullscreen Console */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#0a0a0f] text-slate-300 flex flex-col"
          >
            {/* Header */}
            <div style={{ padding: '32px 40px', gap: '24px' }} className="border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div style={{ gap: '16px' }} className="flex items-center">
                <div style={{ padding: '10px 12px' }} className="bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div>
                  <h1 style={{ marginBottom: '4px' }} className="font-semibold text-white text-2xl">
                    AI Content Generator
                  </h1>
                  <p className="text-sm text-slate-500 font-mono">
                    gemini-3.5-flash-lite
                  </p>
                </div>
              </div>
              <button
                onClick={handleFinish}
                style={{ padding: '12px 24px', gap: '8px' }}
                className={`rounded-lg font-semibold flex items-center transition-all ${
                  isGenerating
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                {isGenerating ? 'Generating...' : 'Finish'}
              </button>
            </div>

            {/* Global Progress */}
            <div style={{ padding: '32px 40px', marginBottom: '0' }} className="border-b border-slate-800 flex-shrink-0">
              <ProgressBar value={overallProgress} label="Overall Progress" />
              <div style={{ gap: '16px', marginTop: '20px' }} className="flex items-center text-sm text-slate-400 font-mono">
                <span>{completedLessons}/{totalItems} items generated</span>
                <span>•</span>
                <span>{overallProgress}% complete</span>
                {isGenerating && (
                  <>
                    <span>•</span>
                    <span>~{estimatedTime}min remaining</span>
                  </>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Terminal Log (50%) */}
              <div style={{ padding: '32px 40px' }} className="w-1/2 overflow-hidden flex flex-col border-r border-slate-800">
                <div style={{ marginBottom: '32px' }} className="flex-1 overflow-y-auto pr-2">
                  <TerminalLog logs={logs} />
                </div>

                {/* Status indicator */}
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ padding: '16px 20px', gap: '12px' }}
                    className="bg-slate-900/50 border border-slate-800 rounded-lg flex-shrink-0"
                  >
                    <div style={{ gap: '12px' }} className="flex items-center">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-3 h-3 rounded-full bg-cyan-400"
                      />
                      <span className="text-sm text-slate-300">
                        Generating lesson {completedLessons + 1} of {totalItems}...
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right: Lesson Preview (50%) */}
              <div className="w-1/2 border-l border-slate-800 overflow-hidden flex flex-col">
                {/* Lesson Tabs */}
                <div style={{ padding: '24px 32px' }} className="border-b border-slate-800 overflow-x-auto flex-shrink-0">
                  <div style={{ gap: '8px' }} className="flex">
                    {completedLessonsList.map((lesson) => {
                      const isLesson = lesson.type === 'lesson';
                      const isQuiz = lesson.type === 'quiz';
                      const isSelected = selectedLessonId === lesson.id;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          style={{ padding: '12px 16px', gap: '8px' }}
                          className={`rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center border ${
                            isSelected
                              ? isLesson
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-900/30 text-slate-400 hover:text-slate-300 border-slate-800'
                          }`}
                        >
                          {isLesson ? (
                            <BookOpen size={16} />
                          ) : (
                            <FileQuestion size={16} />
                          )}
                          <span>{lesson.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content Area - Lessons or Quizzes */}
                <div ref={lessonContentRef} style={{ padding: '32px 40px' }} className="flex-1 overflow-y-auto">
                  {selectedLesson ? (
                    <div style={{ gap: '24px' }} className="space-y-6">
                      <div>
                        <h3 style={{ marginBottom: '8px', gap: '8px' }} className="text-xs text-slate-500 uppercase tracking-widest font-bold flex items-center">
                          {selectedLesson.moduleTitle}
                          {selectedLesson.type === 'quiz' && <span className="text-cyan-400 text-xs">QUIZ</span>}
                        </h3>
                        <h2 style={{ marginBottom: '24px' }} className="text-3xl font-bold text-white">
                          {selectedLesson.title}
                        </h2>
                        {!selectedLesson.generated && (
                          <p style={{ marginBottom: '12px' }} className="text-xs text-slate-500 flex items-center" >
                            <Pencil size={11} style={{ marginRight: '6px' }} />
                            Inline editing unlocks for this {selectedLesson.type === 'quiz' ? 'quiz' : 'lesson'} as soon as its generation completes.
                          </p>
                        )}
                      </div>

                      {/* Lesson Content (inline-editable once the lesson is persisted) */}
                      {selectedLesson.type === 'lesson' && (
                        <EditableLessonContent
                          lesson={selectedLesson}
                          onBlocksChange={handleLessonBlocksChange}
                        />
                      )}

                      {/* Quiz Content (inline-editable once real question ids sync) */}
                      {selectedLesson.type === 'quiz' && (
                        <EditableQuizContent
                          questions={selectedLesson.questions || []}
                          onQuestionsChange={(next) => handleQuizQuestionsChange(selectedLesson.id, next)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      <p className="text-lg">Content will appear as it is generated...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Finish Confirmation Dialog */}
          <AnimatePresence>
            {showFinishConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[201] flex items-center justify-center bg-black/70 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-sm shadow-2xl"
                >
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Exit Generation?
                  </h3>
                  <p className="text-slate-400 text-base mb-8 leading-relaxed">
                    Generation is still in progress. Exiting now will cancel the process and waste your AI tokens. Are you sure?
                  </p>
                  <div className="flex gap-4 justify-end">
                    <button
                      onClick={() => setShowFinishConfirm(false)}
                      className="px-6 py-3 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors font-medium"
                    >
                      Keep Generating
                    </button>
                    <button
                      onClick={() => {
                        setShowFinishConfirm(false);
                        onClose();
                      }}
                      className="px-6 py-3 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors font-medium border border-red-500/50"
                    >
                      Exit Anyway
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}