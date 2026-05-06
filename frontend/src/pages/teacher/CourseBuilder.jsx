import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    ChevronLeft, Plus, FileText, HelpCircle, Loader2,
    Sparkles, ExternalLink, X, Check, GripVertical, Eye, EyeOff, Globe, Lock, Rocket, Trash2, Edit3, Send, Layers, GripHorizontal, Upload, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import Button from '../../components/ui/Button';
import DeleteModal from '../../components/ui/DeleteModal';
import AiArchitectModal from './AiArchitectModal';
import CurriculumReviewModal from './CurriculumReviewModal.jsx';
import ContentParametersModal from './ContentParametersModal.jsx';
import ContentGenerationModal from './ContentGenerationModal.jsx';
import './CourseBuilder.css';

export default function CourseBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Core States
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPublished, setIsPublished] = useState(false);
    
    // UI View States
    const [activeModuleId, setActiveModuleId] = useState(null); 
    const [isReorderMode, setIsReorderMode] = useState(false); 
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); 
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    
    // Modals & Inputs
    const [moduleModal, setModuleModal] = useState({ isOpen: false, mode: 'create', id: null, title: '' });
    const [activeInput, setActiveInput] = useState({ type: null, value: '' });
    const debounceTimer = useRef(null);

    // AI States
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isEngineering, setIsEngineering] = useState(false);
    const [aiLogs, setAiLogs] = useState([]);
    const [aiResult, setAiResult] = useState(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    // Content Generation States
    const [structureParams, setStructureParams] = useState(null);
    const [contentParams, setContentParams] = useState(null);
    const [savedModulesData, setSavedModulesData] = useState(null);
    const [isContentParamsOpen, setIsContentParamsOpen] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [isContentModalOpen, setIsContentModalOpen] = useState(false);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);

    // Delete State
    const [deleteConfig, setDeleteModal] = useState({ isOpen: false, type: '', id: null });
    const [isDeleting, setIsDeleting] = useState(false);

    // Curriculum File State
    const [showCurriculumModal, setShowCurriculumModal] = useState(false);
    const [uploadingCurriculum, setUploadingCurriculum] = useState(false);

    useEffect(() => { fetchCourse(); }, [id]);

    const fetchCourse = async () => {
        try {
            const res = await api.get(`/teacher/courses/${id}`);
            const enrichedModules = res.data.modules.map(m => ({
                ...m,
                lessons: (m.lessons || []).map(l => ({ ...l, itemType: 'lesson' })),
                quizzes: (m.quizzes || []).map(q => ({ ...q, itemType: 'quiz' }))
            }));
            setCourse({ ...res.data, modules: enrichedModules });
            setIsPublished(res.data.is_published);
        } catch (err) { navigate('/dashboard/teacher'); }
        finally { setLoading(false); }
    };

    // --- ACTIONS ---
    const toggleCourseStatus = async () => {
        setIsUpdatingStatus(true);
        const newStatus = !isPublished;
        try {
            await api.post(`/teacher/courses/${id}/publish`, { is_published: newStatus });
            setIsPublished(newStatus);
            toast.success(newStatus ? "Course is now live" : "Course set to draft");
        } catch (err) { toast.error("Update failed"); }
        finally { setIsUpdatingStatus(false); }
    };

    const publishAllItems = async () => {
        setIsUpdatingStatus(true);
        const toastId = toast.loading("Publishing all contents...");
        try {
            await api.post(`/teacher/courses/${id}/publish-all`);
            toast.success("All contents published successfully", { id: toastId });
            fetchCourse();
        } catch (err) { toast.error("Publishing failed", { id: toastId }); }
        finally { setIsUpdatingStatus(false); }
    };

    const handleModuleSubmit = async (e) => {
        e.preventDefault();
        if (!moduleModal.title.trim()) return;
        setIsSubmittingItem(true);
        try {
            if (moduleModal.mode === 'create') {
                const res = await api.post(`/teacher/courses/${id}/modules`, { title: moduleModal.title });
                setCourse(prev => ({ ...prev, modules: [...prev.modules, { ...res.data, lessons: [], quizzes: [] }] }));
                toast.success("Created");
            } else {
                await api.put(`/teacher/modules/${moduleModal.id}`, { title: moduleModal.title });
                setCourse(prev => ({
                    ...prev,
                    modules: prev.modules.map(m => m.id === moduleModal.id ? { ...m, title: moduleModal.title } : m)
                }));
                toast.success("Renamed");
            }
            setModuleModal({ isOpen: false, mode: 'create', id: null, title: '' });
        } catch (err) { toast.error("Failed"); }
        finally { setIsSubmittingItem(false); }
    };

    const handleReorderModules = (newOrder) => {
        setCourse(prev => ({ ...prev, modules: newOrder }));
    };

    const handleReorderItems = (newOrder) => {
        setCourse(prev => ({
            ...prev,
            modules: prev.modules.map(m => m.id === activeModuleId ? {
                ...m,
                lessons: newOrder.filter(i => i.itemType === 'lesson'),
                quizzes: newOrder.filter(i => i.itemType === 'quiz'),
                _lastOrder: newOrder 
            } : m)
        }));

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            try {
                const payload = newOrder.map(item => ({ id: item.id, itemType: item.itemType }));
                await api.post(`/teacher/modules/${activeModuleId}/reorder`, { items: payload });
            } catch (err) {}
        }, 1000);
    };

    const getSortedItems = useCallback((module) => {
        if (!module) return [];
        if (module._lastOrder) return module._lastOrder;
        return [...module.lessons, ...module.quizzes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }, []);

    const toggleItemStatus = async (item) => {
        const newStatus = !item.is_published;
        const type = item.itemType === 'lesson' ? 'lessons' : 'quizzes';
        
        setCourse(prev => ({
            ...prev,
            modules: prev.modules.map(m => {
                if (m.id === activeModuleId) {
                    return {
                        ...m,
                        [type]: m[type].map(i => i.id === item.id ? { ...i, is_published: newStatus } : i)
                    };
                }
                return m;
            })
        }));

        try { await api.put(`/teacher/${type}/${item.id}`, { is_published: newStatus }); }
        catch (err) { fetchCourse(); }
    };

    const handleCreateItem = async () => {
        if (!activeInput.value.trim() || !activeModuleId) return;
        setIsSubmittingItem(true);
        const { type, value } = activeInput;
        const endpoint = `/teacher/modules/${activeModuleId}/${type === 'lesson' ? 'lessons' : 'quizzes'}`;
        try {
            const res = await api.post(endpoint, { title: value });
            const newItem = { ...res.data, itemType: type };
            setCourse(prev => ({
                ...prev,
                modules: prev.modules.map(m => m.id === activeModuleId ? { 
                    ...m, 
                    [type === 'lesson' ? 'lessons' : 'quizzes']: [...m[type === 'lesson' ? 'lessons' : 'quizzes'], newItem] 
                } : m)
            }));
            setActiveInput({ type: null, value: '' });
            toast.success("Added");
        } catch (err) { toast.error("Failed"); }
        finally { setIsSubmittingItem(false); }
    };

    const handlePermanentDelete = async () => {
        const { type, id: itemId } = deleteConfig;
        setIsDeleting(true);
        const plural = type === 'quiz' ? 'quizzes' : `${type}s`;

        try {
            // Delete from backend
            await api.delete(`/teacher/${plural}/${itemId}`);

            // Invalidate cache to ensure fresh data
            invalidateCache(`/teacher/courses/${id}`);
            invalidateCache(`/teacher/${plural}/${itemId}`);

            // Optimistically update UI immediately
            if (type === 'module') {
                setCourse(prev => ({
                    ...prev,
                    modules: prev.modules.filter(m => m.id !== itemId)
                }));
                if (itemId === activeModuleId) setActiveModuleId(null);
            } else {
                // For lessons and quizzes, update all modules to remove the item
                setCourse(prev => ({
                    ...prev,
                    modules: prev.modules.map(m => ({
                        ...m,
                        lessons: type === 'lesson' ? m.lessons.filter(l => l.id !== itemId) : m.lessons,
                        quizzes: type === 'quiz' ? m.quizzes.filter(q => q.id !== itemId) : m.quizzes
                    }))
                }));
            }

            setDeleteModal({ isOpen: false, type: '', id: null });
            toast.success("Deleted successfully");

        } catch (err) {
            toast.error("Failed to delete");
            console.error('Delete error:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExecuteAI = async (prompt, file, params) => {
        setIsAiModalOpen(false);
        setIsEngineering(true);
        setAiLogs(['🚀 Initializing AI Curriculum Architect...']);
        setAiResult({ new_modules: [] });

        // Save structure params for later
        setStructureParams(params);

        try {
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('difficulty', params.difficulty);
            formData.append('module_count', params.moduleCount);
            formData.append('lessons_per_module', params.lessonsPerModule);
            formData.append('include_quiz', params.includeQuiz);
            formData.append('include_coding', params.includeCodingExercises);
            formData.append('pacing', params.pacing);
            if (file) formData.append('file', file);

            // Fetch with correct base URL
            const baseURL = import.meta.env.VITE_API_URL || 'http://instructai.test/api';
            const response = await fetch(`${baseURL}/teacher/courses/${id}/ai-generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: formData,
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedModules = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'status') {
                                setAiLogs(prev => [...prev, `📡 ${data.message}`]);
                            } else if (data.type === 'module') {
                                // New module received - add with animation delay
                                const moduleData = data.data;
                                setAiLogs(prev => [...prev, `✨ Generated: ${moduleData.title}`]);

                                // Rate-limit: wait before showing
                                await new Promise(resolve => setTimeout(resolve, 800));

                                accumulatedModules.push(moduleData);
                                setAiResult({
                                    new_modules: accumulatedModules.map(m => ({
                                        title: m.title || 'Untitled Module',
                                        items: [
                                            ...(m.lessons || []).map(l => ({ title: l.title, type: 'lesson' })),
                                            ...(m.quizzes || []).map(q => ({ title: q.title, type: 'quiz' }))
                                        ]
                                    }))
                                });

                                // Type out lessons/quizzes with delays
                                const items = [...(moduleData.lessons || []), ...(moduleData.quizzes || [])];
                                for (const item of items) {
                                    await new Promise(resolve => setTimeout(resolve, 300));
                                    setAiLogs(prev => [...prev, `  📘 ${item.title}`]);
                                }
                            } else if (data.type === 'complete') {
                                setAiLogs(prev => [...prev, '✅ Curriculum generation complete!']);
                                const rawModules = data.data?.new_modules || [];
                                const normalizedData = {
                                    new_modules: rawModules.map(m => ({
                                        title: m.title || 'Untitled Module',
                                        items: [
                                            ...(m.lessons || []).map(l => ({ title: l.title, type: 'lesson' })),
                                            ...(m.quizzes || []).map(q => ({ title: q.title, type: 'quiz' }))
                                        ]
                                    }))
                                };
                                setAiResult(normalizedData);
                                setIsReviewOpen(true);
                                setIsEngineering(false);
                            } else if (data.type === 'error') {
                                setAiLogs(prev => [...prev, `❌ Error: ${data.message}`]);
                                toast.error('AI generation failed');
                                setIsEngineering(false);
                            }
                        } catch (parseErr) {
                            console.error('Failed to parse SSE data:', parseErr);
                        }
                    }
                }
            }
        } catch (err) {
            setAiLogs(prev => [...prev, `❌ Connection error: ${err.message}`]);
            toast.error('Failed to connect to AI service');
            setIsEngineering(false);
        }
    };

    const handleConfirmAI = async (finalData) => {
        setIsReviewOpen(false);

        try {
            // Stage 1: Save structure (titles only)
            const toastId = toast.loading('Saving curriculum structure...');
            const response = await api.post(`/teacher/courses/${id}/ai-commit`, finalData);
            const savedModules = response.data.new_modules;
            toast.success('Structure saved!', { id: toastId });

            // Invalidate cache so new modules appear
            invalidateCache(`/teacher/courses/${id}`);

            // Immediately save modules and open content parameters modal (no delay)
            setSavedModulesData(savedModules);

            // Use setTimeout to ensure state updates before modal opens
            setTimeout(() => {
                setIsContentParamsOpen(true);
            }, 100);

        } catch (err) {
            toast.error('Failed to save curriculum');
        }
    };

    const handleStartContentGeneration = (allParams) => {
        // Check if curriculum document exists
        if (!course.curriculum_text && !course.curriculum_file_url) {
            toast.error("Please upload a curriculum document first! Without it, AI will generate generic content.");
            setIsContentParamsOpen(false);
            setShowCurriculumModal(true);
            return;
        }

        if (!course.curriculum_text) {
            toast.warning("Curriculum file uploaded but text may not be extracted. Content might be generic.");
        }

        // Start content generation immediately with params
        generateLessonContent(savedModulesData, allParams);
    };

    const generateLessonContent = async (modules, params) => {
        setIsGeneratingContent(true);
        setIsContentModalOpen(true);
        setContentParams(params); // Save for validation

        // Build structure for content generation with predicted quiz counts
        const structure = modules.map(module => ({
            title: module.title,
            lessons: module.lessons.map(l => ({ id: l.id, title: l.title })),
            quizzes: module.quizzes.map(q => ({
                id: q.id,
                title: q.title,
                predictedQuestions: predictQuestionCount(q.title, params.questionsPerQuiz)
            }))
        }));

        setGeneratedContent({ modules: structure.map(m => ({
            ...m,
            lessons: m.lessons.map(l => ({ ...l, blockCount: 0, codeCount: 0 })),
            quizzes: m.quizzes.map(q => ({ ...q, questionCount: 0 }))
        }))});

        // Add artificial delay to show streaming UI
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const baseURL = import.meta.env.VITE_API_URL || 'http://instructai.test/api';

            // Convert to streaming response
            const fetchResponse = await fetch(`${baseURL}/teacher/courses/${id}/ai-generate-content`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    curriculum_structure: JSON.stringify(structure),
                    content_params: params
                })
            });

            const reader = fetchResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            let lessonsCompleted = 0;
            const totalLessons = structure.reduce((sum, m) => sum + m.lessons.length, 0);

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Stream ended - check if all lessons were completed
                    if (lessonsCompleted < totalLessons) {
                        console.warn(`Stream ended early: ${lessonsCompleted}/${totalLessons} lessons completed`);
                        toast.warning(`Content partially generated (${lessonsCompleted}/${totalLessons} lessons)`);
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'status') {
                                console.log('Status:', data.message);
                            } else if (data.type === 'lesson_complete') {
                                lessonsCompleted++;
                                const lessonData = data.data;
                                setGeneratedContent(prev => ({
                                    ...prev,
                                    modules: prev.modules.map(m => ({
                                        ...m,
                                        lessons: m.lessons.map(l =>
                                            l.id === lessonData.lesson_id
                                                ? {
                                                    ...l,
                                                    blockCount: lessonData.blocks?.length || 0,
                                                    codeCount: lessonData.blocks?.filter(b => b.type === 'code').length || 0,
                                                    hasImage: lessonData.blocks?.some(b => b.type === 'image'),
                                                    hasVideo: lessonData.blocks?.some(b => b.type === 'video'),
                                                    generated: true
                                                }
                                                : l
                                        )
                                    }))
                                }));
                            } else if (data.type === 'quiz_complete') {
                                const quizData = data.data;
                                setGeneratedContent(prev => ({
                                    ...prev,
                                    modules: prev.modules.map(m => ({
                                        ...m,
                                        quizzes: m.quizzes.map(q =>
                                            q.id === quizData.quiz_id
                                                ? {
                                                    ...q,
                                                    questionCount: quizData.questions?.length || 0,
                                                    generated: true
                                                }
                                                : q
                                        )
                                    }))
                                }));
                            } else if (data.type === 'complete') {
                                toast.success('All content generated successfully!');
                                setIsGeneratingContent(false);

                                // Invalidate cache to force fresh data
                                invalidateCache(`/teacher/courses/${id}`);
                                invalidateCache('/teacher/lessons/');
                                invalidateCache('/teacher/quizzes/');

                                await fetchCourse(); // Refresh to show new content
                            } else if (data.type === 'error') {
                                toast.error('Content generation failed');
                                setIsGeneratingContent(false);
                            }
                        } catch (parseErr) {
                            console.error('Failed to parse SSE data:', parseErr);
                        }
                    }
                }
            }
        } catch (err) {
            toast.error('Failed to generate content');
            setIsGeneratingContent(false);
        }
    };

    const predictQuestionCount = (quizTitle, baseCountOrRange = '10-15') => {
        const title = quizTitle.toLowerCase();

        // Parse base count (could be "10" or "10-15")
        let baseMin, baseMax;
        if (typeof baseCountOrRange === 'string' && baseCountOrRange.includes('-')) {
            const parts = baseCountOrRange.split('-').map(Number);
            baseMin = parts[0];
            baseMax = parts[1];
        } else {
            const num = typeof baseCountOrRange === 'string' ? parseInt(baseCountOrRange) : baseCountOrRange;
            baseMin = num;
            baseMax = num;
        }

        const baseMid = Math.floor((baseMin + baseMax) / 2);

        // Analyze quiz type and intelligently predict count
        if (title.includes('final') || title.includes('exam')) {
            return Math.max(baseMid * 4, 50); // Finals need lots of questions
        }
        if (title.includes('midterm')) {
            return Math.max(baseMid * 2.5, 30);
        }
        if (title.includes('comprehensive') || title.includes('assessment')) {
            return Math.max(baseMid * 3, 35);
        }
        if (title.includes('basics') || title.includes('intro') || title.includes('primer')) {
            return Math.max(Math.floor(baseMid * 0.6), 5); // Introductory quizzes are shorter
        }
        if (title.includes('practice') || title.includes('exercise')) {
            return Math.max(Math.floor(baseMid * 1.2), 8);
        }

        // Default: use middle of range
        return baseMid;
    };

    const handleGenerateQuizzes = async (editedQuestionCounts) => {
        // Update question counts and trigger quiz generation
        toast.info('Generating quiz questions...');
        // TODO: Stream quiz generation similar to lesson content
        // For now, quizzes are generated during lesson content generation

        // Close modal and refresh
        setIsContentModalOpen(false);
        await fetchCourse();
        toast.success('All content saved!');
    };

    const handleDeleteLesson = (lessonId) => {
        setGeneratedContent(prev => ({
            ...prev,
            modules: prev.modules.map(m => ({
                ...m,
                lessons: m.lessons.filter(l => l.id !== lessonId)
            }))
        }));
    };

    const handleDeleteQuiz = (quizId) => {
        setGeneratedContent(prev => ({
            ...prev,
            modules: prev.modules.map(m => ({
                ...m,
                quizzes: m.quizzes.filter(q => q.id !== quizId)
            }))
        }));
    };

    const handleCurriculumUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please upload a PDF, DOC, DOCX, or TXT file');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            return;
        }

        setUploadingCurriculum(true);
        try {
            const formData = new FormData();
            formData.append('curriculum_file', file);

            await api.post(`/teacher/courses/${id}/upload-curriculum`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Curriculum document uploaded!');
            fetchCourse();
            setShowCurriculumModal(false);
        } catch (err) {
            toast.error('Failed to upload curriculum');
        } finally {
            setUploadingCurriculum(false);
        }
    };

    if (loading || !course) return <div className="flex h-screen items-center justify-center bg-[#02010a]"><Loader2 className="animate-spin text-purple-500" size={48} /></div>;

    const activeModuleData = activeModuleId ? course.modules.find(m => m.id === activeModuleId) : null;

    return (
        <div className="builder-container">
            <header className="mb-12">
                <button onClick={() => activeModuleId ? setActiveModuleId(null) : navigate(-1)} className="back-btn border-none bg-transparent cursor-pointer mb-6">
                    <ChevronLeft size={16} /> {activeModuleId ? 'Return to Modules' : 'Exit to Classroom'}
                </button>
                <div className="builder-header">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-3 tracking-tighter leading-[1.1]">{activeModuleId ? activeModuleData?.title : course.title}</h1>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className={`status-pill ${isPublished ? 'live' : 'draft'}`}>{isPublished ? <Globe size={10} /> : <Lock size={10} />} {isPublished ? 'Live' : 'Draft'}</div>

                            {!activeModuleId && course.curriculum_file_url && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-[10px] font-bold uppercase">
                                    <FileText size={12} />
                                    <span>Curriculum Attached</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={isUpdatingStatus}
                                    onClick={publishAllItems}
                                    className="text-[10px] font-black text-purple-400 hover:text-white uppercase tracking-widest border-none bg-transparent cursor-pointer underline underline-offset-4 disabled:opacity-50"
                                >
                                    Publish All Contents
                                </button>
                                {isUpdatingStatus && <Loader2 size={10} className="animate-spin text-purple-400" />}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {!activeModuleId && (
                            <>
                                <button
                                    onClick={() => setShowCurriculumModal(true)}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-[10px] font-black uppercase border-none cursor-pointer flex items-center gap-2 transition-all"
                                >
                                    <FileText size={16} />
                                    {course.curriculum_file_url ? 'Manage Curriculum' : 'Upload Curriculum'}
                                </button>
                                <button onClick={toggleCourseStatus} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-none cursor-pointer flex items-center gap-2 ${isPublished ? 'bg-slate-800 text-slate-400' : 'bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:scale-105'}`}>{isPublished ? 'Unpublish' : 'Go Live'}</button>
                                <button onClick={() => setIsAiModalOpen(true)} className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-black rounded-2xl text-[10px] font-black uppercase border-none cursor-pointer flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-cyan-500/20"><Sparkles size={16} /> AI Architect</button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <AnimatePresence mode="wait">
                {!activeModuleId ? (
                    <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                        <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-3xl">
                            <button onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border-none cursor-pointer flex items-center gap-2 transition-all"><Plus size={16} /> New Module</button>
                            <button onClick={() => setIsReorderMode(!isReorderMode)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-none cursor-pointer transition-all ${isReorderMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-transparent text-slate-500'}`}><GripHorizontal size={16} /> {isReorderMode ? 'Save Order' : 'Rearrange Grid'}</button>
                        </div>

                        <Reorder.Group axis="x" values={course.modules} onReorder={handleReorderModules} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 relative">
                            {course.modules.map((module) => {
                                const total = (module.lessons?.length || 0) + (module.quizzes?.length || 0);
                                const published = [...(module.lessons || []), ...(module.quizzes || [])].filter(i => i.is_published).length;
                                const unpublished = total - published;
                                const statusText = total === 0 ? 'Empty' : (unpublished === 0 ? 'Published' : `${unpublished} Unpublished`);
                                const statusClass = total === 0 ? 'bg-slate-500/10 text-slate-500' : (unpublished === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500');

                                return (
                                    <Reorder.Item key={module.id} value={module} dragListener={isReorderMode} layout
                                        whileDrag={{ scale: 1.05, boxShadow: "0 20px 50px rgba(0,0,0,0.5)", zIndex: 50 }}
                                        className={`relative group ${isReorderMode ? 'is-wiggling cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                                        onClick={() => !isReorderMode && setActiveModuleId(module.id)}
                                    >
                                        <div className="h-full min-h-[220px] rounded-[35px] border border-white/10 bg-[#050505] overflow-hidden transition-all flex flex-col group-hover:border-purple-500/50">
                                            <div className="h-24 bg-gradient-to-br from-purple-900/40 to-blue-900/20 p-6 flex justify-between items-start relative">
                                                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl"><Layers size={20}/></div>
                                                {!isReorderMode && (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xl rounded-xl p-1 border border-white/10 shadow-xl">
                                                        <button onClick={(e) => { e.stopPropagation(); setModuleModal({ isOpen: true, mode: 'edit', id: module.id, title: module.title }); }} className="p-2 text-slate-400 hover:text-white border-none bg-transparent cursor-pointer transition-colors"><Edit3 size={16}/></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, type: 'module', id: module.id }); }} className="p-2 text-slate-400 hover:text-red-500 border-none bg-transparent cursor-pointer transition-colors"><Trash2 size={16}/></button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-6 flex-grow flex flex-col justify-between">
                                                <h3 className="text-xl font-bold text-white mb-6 line-clamp-2 leading-snug">{module.title}</h3>
                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        <span>{module.lessons?.length || 0} Lessons</span>
                                                        <span>{module.quizzes?.length || 0} Quizzes</span>
                                                    </div>
                                                    <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusClass}`}>
                                                        {statusText}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Reorder.Item>
                                );
                            })}
                        </Reorder.Group>
                    </motion.div>
                ) : (
                    <motion.div key="timeline" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="bg-[#050505] border border-white/5 rounded-[45px] p-10 shadow-2xl">
                        <div className="flex justify-between items-center mb-12">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(167,139,250,0.1)]"><Layers size={32}/></div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 block mb-1">Architecture View</span>
                                    <h2 className="text-2xl font-black text-white">{activeModuleData?.title}</h2>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteModal({ isOpen: true, type: 'module', id: activeModuleId })} className="p-3 bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-xl border-none cursor-pointer transition-all shadow-sm"><Trash2 size={18}/></button>
                            </div>
                        </div>

                        {/* Creation UI At Top */}
                        <div className="mb-10 pb-10 border-b border-white/5">
                            <AnimatePresence mode="wait">
                                {activeInput.type ? (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 bg-black p-3 rounded-2xl border border-white/10 shadow-xl">
                                        <input autoFocus placeholder={`Name your new ${activeInput.type}...`} value={activeInput.value} onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()} className="flex-grow bg-transparent border-none outline-none text-white font-bold p-2" />
                                        <button onClick={() => setActiveInput({ type: null, value: '' })} className="p-2 text-slate-500 border-none bg-transparent cursor-pointer"><X size={20}/></button>
                                        <button disabled={isSubmittingItem || !activeInput.value.trim()} onClick={handleCreateItem} className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center border-none cursor-pointer">{isSubmittingItem ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}</button>
                                    </motion.div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setActiveInput({ type: 'lesson', value: '' })} className="py-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-purple-500/50 text-slate-500 hover:text-white transition-all border-none cursor-pointer flex items-center justify-center gap-3 group"><Plus size={18}/><span className="text-[10px] font-black uppercase tracking-widest">New Lesson</span></button>
                                        <button onClick={() => setActiveInput({ type: 'quiz', value: '' })} className="py-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-cyan-500/50 text-slate-500 hover:text-white transition-all border-none cursor-pointer flex items-center justify-center gap-3 group"><Plus size={18}/><span className="text-[10px] font-black uppercase tracking-widest">New Quiz</span></button>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>

                        <Reorder.Group axis="y" values={getSortedItems(activeModuleData)} onReorder={handleReorderItems} className="timeline-group list-none p-0">
                            {getSortedItems(activeModuleData).map((item) => (
                                <Reorder.Item key={`${item.itemType}-${item.id}`} value={item} onDragStart={() => setIsDragging(true)} onDragEnd={() => setIsDragging(false)} 
                                    className={`timeline-item ${item.itemType}-item ${!item.is_published ? 'is-draft' : ''}`}
                                >
                                    <div className="flex items-center gap-5 w-full">
                                        <div className="item-drag-handle"><GripVertical size={16} /></div>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.itemType === 'lesson' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                            {item.itemType === 'lesson' ? <FileText size={20}/> : <HelpCircle size={20}/>}
                                        </div>
                                        <div className="flex-grow text-left">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-bold text-white">{item.title}</span>
                                                <span className={`status-badge ${item.is_published ? 'published' : 'draft'}`}>{item.is_published ? 'Live' : 'Draft'}</span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">{item.itemType}</span>
                                        </div>
                                        {!isDragging && (
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => toggleItemStatus(item)} className={`p-2 rounded-lg bg-white/5 border-none cursor-pointer transition-all ${item.is_published ? 'text-emerald-500' : 'text-slate-600'}`}>
                                                    {item.is_published ? <Eye size={18} /> : <EyeOff size={18} />}
                                                </button>
                                                <button onClick={() => navigate(`/dashboard/teacher/class/${course.class_id}/${item.itemType}/${item.id}`)} className="px-4 py-2 bg-white text-black text-[9px] font-black uppercase rounded-lg hover:bg-purple-500 hover:text-white transition-all border-none cursor-pointer">Open</button>
                                                <button onClick={() => setDeleteModal({ isOpen: true, type: item.itemType, id: item.id })} className="p-2 text-slate-600 hover:text-red-500 border-none bg-transparent cursor-pointer"><Trash2 size={18}/></button>
                                            </div>
                                        )}
                                    </div>
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODALS */}
            <AnimatePresence>
                {moduleModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModuleModal({ ...moduleModal, isOpen: false })} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative z-10 w-full max-w-md bg-[#05011d] border border-white/10 rounded-[40px] p-10 shadow-2xl">
                            <h2 className="text-2xl font-black text-white mb-8">{moduleModal.mode === 'create' ? 'New Module' : 'Rename Module'}</h2>
                            <form onSubmit={handleModuleSubmit} className="space-y-6">
                                <input autoFocus value={moduleModal.title} onChange={(e) => setModuleModal({ ...moduleModal, title: e.target.value })} placeholder="Chapter Name..." className="w-full bg-black border border-white/10 rounded-2xl p-6 text-white font-bold outline-none focus:border-purple-500/50" />
                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setModuleModal({ ...moduleModal, isOpen: false })} className="flex-1 py-4 bg-white/5 rounded-2xl text-slate-400 font-black text-[10px] uppercase border-none cursor-pointer">Cancel</button>
                                    <button disabled={isSubmittingItem || !moduleModal.title.trim()} type="submit" className="flex-1 py-4 bg-purple-600 text-white font-black text-[10px] uppercase rounded-2xl border-none cursor-pointer shadow-lg shadow-purple-500/20">{isSubmittingItem ? <Loader2 className="animate-spin mx-auto" size={16}/> : 'Confirm'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <DeleteModal isOpen={deleteConfig.isOpen} title={deleteConfig.type} loading={isDeleting} onClose={() => setDeleteModal({ ...deleteConfig, isOpen: false })} onConfirm={handlePermanentDelete} />
            <AiArchitectModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                onExecute={handleExecuteAI}
                curriculumFile={course?.curriculum_file_url ? course.curriculum_file_url.split('/').pop() : null}
            />
            <CurriculumReviewModal isOpen={isReviewOpen} data={aiResult} expectedParams={structureParams} onCancel={() => setIsReviewOpen(false)} onConfirm={handleConfirmAI} />

            {/* Content Parameters Modal (Stage 2: Configure content details) */}
            <ContentParametersModal
                isOpen={isContentParamsOpen}
                onClose={() => setIsContentParamsOpen(false)}
                onGenerate={handleStartContentGeneration}
                structureParams={structureParams}
            />

            {/* Content Generation Modal */}
            <ContentGenerationModal
                isOpen={isContentModalOpen}
                onClose={() => {
                    setIsContentModalOpen(false);
                    fetchCourse();
                }}
                generatedContent={generatedContent}
                isGeneratingContent={isGeneratingContent}
                onGenerateQuizzes={handleGenerateQuizzes}
                onDeleteLesson={handleDeleteLesson}
                onDeleteQuiz={handleDeleteQuiz}
                expectedParams={contentParams}
                onRegenerate={() => {
                    setIsContentModalOpen(false);
                    setIsAiModalOpen(true);
                    toast.info('Adjust parameters and regenerate');
                }}
            />

            {/* Curriculum Management Modal */}
            <AnimatePresence>
                {showCurriculumModal && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCurriculumModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative z-10 w-full max-w-lg bg-[#030014] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                        <FileText className="text-purple-400" /> Curriculum Document
                                    </h2>
                                    <button
                                        onClick={() => setShowCurriculumModal(false)}
                                        className="text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {course.curriculum_file_url ? (
                                    <div className="space-y-6">
                                        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <CheckCircle size={20} className="text-green-400" />
                                                <span className="text-white font-bold">Current File</span>
                                            </div>
                                            <a
                                                href={course.curriculum_file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-green-400 hover:text-green-300 underline break-all"
                                            >
                                                {course.curriculum_file_url.split('/').pop()}
                                            </a>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                                Replace with new file
                                            </label>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.txt"
                                                onChange={handleCurriculumUpload}
                                                disabled={uploadingCurriculum}
                                                className="hidden"
                                                id="curriculum-replace"
                                            />
                                            <label
                                                htmlFor="curriculum-replace"
                                                className="flex items-center justify-center gap-2 w-full bg-white/[0.03] border border-white/10 hover:border-purple-500/50 rounded-xl py-4 px-4 text-slate-400 hover:text-purple-400 cursor-pointer transition-all"
                                            >
                                                {uploadingCurriculum ? (
                                                    <Loader2 size={18} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <Upload size={18} />
                                                        <span className="text-sm">Choose new file (PDF, DOC, DOCX, TXT)</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-slate-400 text-sm mb-6">
                                            Upload your syllabus, DLL, or course guide. This will be used by the AI to generate curriculum aligned with your document.
                                        </p>
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={handleCurriculumUpload}
                                            disabled={uploadingCurriculum}
                                            className="hidden"
                                            id="curriculum-upload-first"
                                        />
                                        <label
                                            htmlFor="curriculum-upload-first"
                                            className="flex items-center justify-center gap-2 w-full bg-white/[0.03] border border-white/10 hover:border-purple-500/50 rounded-xl py-6 px-4 text-slate-400 hover:text-purple-400 cursor-pointer transition-all"
                                        >
                                            {uploadingCurriculum ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <Upload size={18} />
                                                    <span className="text-sm">Choose file (PDF, DOC, DOCX, TXT)</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isEngineering && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-4xl px-4"
                    >
                        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-2xl border border-purple-500/40 rounded-[32px] p-8 shadow-2xl shadow-purple-500/20 relative overflow-hidden">
                            {/* Animated gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-purple-500/5 animate-pulse" />

                            <div className="relative z-10">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-3 h-3 rounded-full bg-purple-500 animate-ping absolute" />
                                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-black uppercase tracking-[0.3em] text-purple-300 block">AI Curriculum Architect</span>
                                            <span className="text-[10px] text-slate-500">Generating in real-time...</span>
                                        </div>
                                    </div>
                                    <Sparkles size={20} className="text-purple-400 animate-pulse" />
                                </div>

                                {/* Module Preview with Animations */}
                                {aiResult?.new_modules && aiResult.new_modules.length > 0 && (
                                    <div className="mb-6 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                                        {aiResult.new_modules.map((module, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                transition={{ delay: idx * 0.2 }}
                                                className="bg-white/5 border border-purple-500/20 rounded-2xl p-4"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Sparkles size={14} className="text-purple-400" />
                                                    <span className="font-bold text-white">{module.title}</span>
                                                </div>
                                                <div className="pl-6 space-y-1">
                                                    {module.items?.map((item, itemIdx) => (
                                                        <motion.div
                                                            key={itemIdx}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: itemIdx * 0.1 }}
                                                            className="text-xs text-slate-400 flex items-center gap-2"
                                                        >
                                                            <span>{item.type === 'lesson' ? '📘' : '📝'}</span>
                                                            <span>{item.title}</span>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}

                                {/* Log Feed */}
                                <div className="bg-black/40 rounded-2xl p-4 max-h-40 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar border border-white/5">
                                    {aiLogs.map((log, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-slate-300 flex items-start gap-3"
                                        >
                                            <span className="text-purple-500 font-bold shrink-0 text-[10px]">
                                                {new Date().toLocaleTimeString()}
                                            </span>
                                            <span className="flex-1">{log}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}