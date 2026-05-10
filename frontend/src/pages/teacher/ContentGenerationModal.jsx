import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, ChevronDown, ChevronRight, Trash2,
    FileText, HelpCircle, Sparkles, CheckCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ContentGenerationModal({
    isOpen,
    onClose,
    generatedContent,
    isGeneratingContent,
    onGenerateQuizzes,
    onDeleteLesson,
    onDeleteQuiz,
    expectedParams,
    onRegenerate
}) {
    const [expandedModules, setExpandedModules] = useState([]);
    const [editingQuizzes, setEditingQuizzes] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [showValidation, setShowValidation] = useState(true);

    const toggleModule = (moduleIdx) => {
        setExpandedModules(prev =>
            prev.includes(moduleIdx)
                ? prev.filter(i => i !== moduleIdx)
                : [...prev, moduleIdx]
        );
    };

    const handleQuizEdit = (quizId, value) => {
        setEditingQuizzes(prev => ({
            ...prev,
            [quizId]: value
        }));
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;

        const { type, id } = deleteConfirm;
        if (type === 'lesson') {
            onDeleteLesson(id);
        } else if (type === 'quiz') {
            onDeleteQuiz(id);
        }

        setDeleteConfirm(null);
        toast.success(`${type === 'lesson' ? 'Lesson' : 'Quiz'} removed`);
    };

    const getTotalCounts = () => {
        if (!generatedContent?.modules) return { lessons: 0, quizzes: 0, questions: 0 };

        let lessons = 0, quizzes = 0, questions = 0;

        generatedContent.modules.forEach(module => {
            lessons += module.lessons?.length || 0;
            quizzes += module.quizzes?.length || 0;
        });

        // Questions count is determined by AI (not predictable)
        return { lessons, quizzes, questions: null };
    };


    const counts = getTotalCounts();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-10 w-full max-w-4xl bg-[#030014] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                                <Sparkles className="text-purple-400" /> Generated Content Review
                            </h2>
                            <p className="text-sm text-slate-500">
                                Review generated lessons, adjust quiz sizes, then generate questions
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>


                    {/* Summary Stats */}
                    <div className="flex gap-4 mt-6">
                        <div className="flex-1 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                            <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-1">Lessons</div>
                            <div className="text-2xl font-black text-white">{counts.lessons}</div>
                        </div>
                        <div className="flex-1 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                            <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">Quizzes</div>
                            <div className="text-2xl font-black text-white">{counts.quizzes}</div>
                        </div>
                        <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <div className="text-xs text-green-400 font-bold uppercase tracking-wider mb-1">Total Questions</div>
                            <div className="text-2xl font-black text-white">{counts.questions ?? 'AI decides'}</div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                    {isGeneratingContent ? (
                        <div className="space-y-6">
                            {/* Animated Generation Progress */}
                            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="relative">
                                        <div className="w-3 h-3 rounded-full bg-purple-500 animate-ping absolute" />
                                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-[0.3em] text-purple-300">AI Content Generator Active</span>
                                </div>

                                {/* Real-time lesson generation feed */}
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {generatedContent?.modules?.map((module, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="bg-white/5 border border-purple-500/20 rounded-xl p-4"
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <Sparkles size={14} className="text-purple-400" />
                                                <span className="font-bold text-white text-sm">{module.title}</span>
                                            </div>
                                            <div className="pl-6 space-y-2">
                                                {/* Lessons */}
                                                {module.lessons?.map((lesson, lessonIdx) => (
                                                    <motion.div
                                                        key={`lesson-${lessonIdx}`}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: lessonIdx * 0.1 }}
                                                        className={`text-xs flex items-center gap-2 ${lesson.generated ? 'text-green-400' : 'text-slate-500'}`}
                                                    >
                                                        {lesson.generated ? (
                                                            <>
                                                                <CheckCircle size={14} />
                                                                <FileText size={12} className="text-purple-400" />
                                                                <span className="font-medium">{lesson.title}</span>
                                                                <span className="text-slate-500">• {lesson.blockCount} blocks, {lesson.codeCount} code</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Loader2 size={14} className="animate-spin" />
                                                                <span>Generating: {lesson.title}...</span>
                                                            </>
                                                        )}
                                                    </motion.div>
                                                ))}

                                                {/* Quizzes */}
                                                {module.quizzes?.map((quiz, quizIdx) => (
                                                    <motion.div
                                                        key={`quiz-${quizIdx}`}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: (module.lessons?.length || 0) * 0.1 + quizIdx * 0.1 }}
                                                        className={`text-xs flex items-center gap-2 ${quiz.generated ? 'text-cyan-400' : 'text-slate-500'}`}
                                                    >
                                                        {quiz.generated ? (
                                                            <>
                                                                <CheckCircle size={14} />
                                                                <HelpCircle size={12} className="text-cyan-400" />
                                                                <span className="font-medium">{quiz.title}</span>
                                                                <span className="text-slate-500">• {quiz.questionCount} questions</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Loader2 size={14} className="animate-spin text-cyan-400" />
                                                                <span>Generating quiz: {quiz.title}...</span>
                                                            </>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        generatedContent?.modules?.map((module, moduleIdx) => (
                            <div key={moduleIdx} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                                {/* Module Header */}
                                <button
                                    onClick={() => toggleModule(moduleIdx)}
                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors border-none bg-transparent cursor-pointer text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedModules.includes(moduleIdx) ? (
                                            <ChevronDown size={20} className="text-purple-400" />
                                        ) : (
                                            <ChevronRight size={20} className="text-slate-500" />
                                        )}
                                        <span className="text-lg font-bold text-white">{module.title}</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                        <span>{module.lessons?.length || 0} lessons</span>
                                        <span>{module.quizzes?.length || 0} quizzes</span>
                                    </div>
                                </button>

                                {/* Module Content */}
                                <AnimatePresence>
                                    {expandedModules.includes(moduleIdx) && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-white/5"
                                        >
                                            <div className="p-6 space-y-4">
                                                {/* Lessons */}
                                                {module.lessons?.map((lesson, lessonIdx) => (
                                                    <div key={lessonIdx} className="flex items-start justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 group hover:border-purple-500/30 transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <FileText size={16} className="text-purple-400" />
                                                                <span className="font-semibold text-white">{lesson.title}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 space-x-3">
                                                                <span>{lesson.blockCount || 0} blocks</span>
                                                                {lesson.codeCount > 0 && <span>{lesson.codeCount} code examples</span>}
                                                                {lesson.hasImage && <span>• 1 image</span>}
                                                                {lesson.hasVideo && <span>• 1 video</span>}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setDeleteConfirm({ type: 'lesson', id: lesson.id, title: lesson.title })}
                                                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all bg-transparent border-none cursor-pointer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Quizzes */}
                                                {module.quizzes?.map((quiz, quizIdx) => (
                                                    <div key={quizIdx} className="flex items-start justify-between p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/20 group hover:border-cyan-500/40 transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <HelpCircle size={16} className="text-cyan-400" />
                                                                <span className="font-semibold text-white">{quiz.title}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs text-slate-500 italic">AI determines question count</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setDeleteConfirm({ type: 'quiz', id: quiz.id, title: quiz.title })}
                                                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all bg-transparent border-none cursor-pointer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-all border-none cursor-pointer"
                    >
                        Discard All
                    </button>
                    <button
                        onClick={() => onGenerateQuizzes(editingQuizzes)}
                        disabled={isGeneratingContent}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black rounded-xl text-sm font-black uppercase tracking-wider transition-all border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Sparkles size={16} />
                        Generate Quizzes & Save
                    </button>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirm(null)}
                            className="absolute inset-0 bg-black/60"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative z-10 w-full max-w-md bg-[#030014] border border-red-500/30 rounded-2xl p-8"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle size={24} className="text-red-400" />
                                <h3 className="text-xl font-bold text-white">Delete {deleteConfirm.type === 'lesson' ? 'Lesson' : 'Quiz'}?</h3>
                            </div>
                            <p className="text-slate-400 mb-2">"{deleteConfirm.title}"</p>
                            <p className="text-sm text-slate-500 mb-6">
                                This will permanently remove the generated content. This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all border-none cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all border-none cursor-pointer"
                                >
                                    Delete Forever
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
