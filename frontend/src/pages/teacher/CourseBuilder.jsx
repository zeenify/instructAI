import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls, Reorder } from 'framer-motion';
import {
    ChevronLeft, Plus, FileText, HelpCircle, Loader2,
    Sparkles, ExternalLink, X, Check, GripVertical, Eye, EyeOff, Globe, Lock, Rocket, Trash2, Edit3, Send, Layers, GripHorizontal, Upload, CheckCircle, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import Button from '../../components/ui/Button';
import DeleteModal from '../../components/ui/DeleteModal';
import AiArchitectModal from './AiArchitectModal';
import CurriculumReviewModal from './CurriculumReviewModal.jsx';
import ContentParametersModal from './ContentParametersModal.jsx';
import GenerationConsole from './GenerationConsole.jsx';
import IndexingStatsModal from '../../components/teacher/IndexingStatsModal';
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
    const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
    const [selectedModuleIds, setSelectedModuleIds] = useState(new Set());
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    
    // Modals & Inputs
    const [moduleModal, setModuleModal] = useState({ isOpen: false, mode: 'create', id: null, title: '' });
    const [activeInput, setActiveInput] = useState({ type: null, value: '' });
    const [isTitleEditing, setIsTitleEditing] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [draggingModuleId, setDraggingModuleId] = useState(null);
    const [dragOverModuleId, setDragOverModuleId] = useState(null);
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
    const [isSavingStructure, setIsSavingStructure] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [isContentModalOpen, setIsContentModalOpen] = useState(false);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [generationLogs, setGenerationLogs] = useState([]);

    // Delete State
    const [deleteConfig, setDeleteModal] = useState({ isOpen: false, type: '', id: null });
    const [isDeleting, setIsDeleting] = useState(false);

    // Curriculum File State
    const [showCurriculumModal, setShowCurriculumModal] = useState(false);
    const [uploadingCurriculum, setUploadingCurriculum] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(null);

    // Indexing Stats Modal State
    const [showIndexingStats, setShowIndexingStats] = useState(false);

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
            invalidateCache(`/teacher/courses/${id}`);
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
            invalidateCache(`/teacher/courses/${id}`);
            toast.success("All contents published successfully", { id: toastId });
            fetchCourse();
        } catch (err) { toast.error("Publishing failed", { id: toastId }); }
        finally { setIsUpdatingStatus(false); }
    };

    const handleIndexCourse = async () => {
        // Check if already indexed by looking for stats
        // If stats exist, just open the modal without re-indexing
        try {
            const statsRes = await api.get(`/teacher/courses/${id}/indexing-stats`);
            if (statsRes.data.total_chunks > 0) {
                // Already indexed, just open modal
                setShowIndexingStats(true);
                return;
            }
        } catch (err) {
            // Not indexed yet, proceed with indexing
        }

        // Index the course
        setIsUpdatingStatus(true);
        try {
            const response = await api.post(`/teacher/courses/${id}/index`);
            // Indexing succeeded, open modal to show results
            setShowIndexingStats(true);
        } catch (err) {
            toast.error("Indexing failed: " + (err.response?.data?.error || "Please try again"));
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleModuleSubmit = async (e) => {
        e.preventDefault();
        if (!moduleModal.title.trim()) return;
        setIsSubmittingItem(true);
        try {
            if (moduleModal.mode === 'create') {
                const res = await api.post(`/teacher/courses/${id}/modules`, { title: moduleModal.title });
                invalidateCache(`/teacher/courses/${id}`);
                setCourse(prev => ({ ...prev, modules: [...prev.modules, { ...res.data, lessons: [], quizzes: [] }] }));
                toast.success("Created");
            } else {
                await api.put(`/teacher/modules/${moduleModal.id}`, { title: moduleModal.title });
                invalidateCache(`/teacher/courses/${id}`);
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

    const handleCourseTitle = async (newTitle) => {
        if (!newTitle || !newTitle.trim() || newTitle === course.title) {
            setIsTitleEditing(false);
            return;
        }
        try {
            await api.put(`/teacher/courses/${id}`, { title: newTitle.trim() });
            setCourse(prev => ({ ...prev, title: newTitle.trim() }));
            invalidateCache(`/teacher/courses/${id}`);
            toast.success('Course renamed');
            setIsTitleEditing(false);
        } catch (err) {
            toast.error('Failed to rename');
        }
    };

    const handleSwap = async (draggedId, targetId) => {
        if (!draggedId || !targetId || draggedId === targetId) return;

        const draggedIndex = course.modules.findIndex(m => m.id === draggedId);
        const targetIndex = course.modules.findIndex(m => m.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newModules = [...course.modules];
        [newModules[draggedIndex], newModules[targetIndex]] = [newModules[targetIndex], newModules[draggedIndex]];

        setCourse(prev => ({ ...prev, modules: newModules }));

        // Save to backend
        api.post(`/teacher/courses/${id}/modules/reorder`, {
            modules: newModules.map(m => m.id)
        }).then(() => {
            invalidateCache(`/teacher/courses/${id}`);
            toast.success('Reordered');
        }).catch(() => {
            toast.error('Failed to save order');
            fetchCourse();
        });
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
                invalidateCache(`/teacher/courses/${id}`);
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

        try {
            await api.put(`/teacher/${type}/${item.id}`, { is_published: newStatus });
            invalidateCache(`/teacher/courses/${id}`);
        }
        catch (err) {
            invalidateCache(`/teacher/courses/${id}`);
            fetchCourse();
        }
    };

    const handleCreateItem = async () => {
        if (!activeInput.value.trim() || !activeModuleId) return;
        setIsSubmittingItem(true);
        const { type, value } = activeInput;
        const endpoint = `/teacher/modules/${activeModuleId}/${type === 'lesson' ? 'lessons' : 'quizzes'}`;
        try {
            const res = await api.post(endpoint, { title: value });
            const newItem = { ...res.data, itemType: type };
            invalidateCache(`/teacher/courses/${id}`);
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

    const handleBulkDelete = async () => {
        if (selectedModuleIds.size === 0) {
            toast.error("No modules selected");
            return;
        }

        setIsDeleting(true);
        const count = selectedModuleIds.size;
        const toastId = toast.loading(`Deleting ${count} module${count === 1 ? '' : 's'}...`);

        try {
            // Delete each selected module
            for (const moduleId of selectedModuleIds) {
                await api.delete(`/teacher/modules/${moduleId}`);
            }

            // Update UI to remove deleted modules
            setCourse(prev => ({
                ...prev,
                modules: prev.modules.filter(m => !selectedModuleIds.has(m.id))
            }));

            // Invalidate cache
            invalidateCache(`/teacher/courses/${id}`);
            if (activeModuleId && selectedModuleIds.has(activeModuleId)) {
                setActiveModuleId(null);
            }

            setSelectedModuleIds(new Set());
            setIsBulkDeleteMode(false);
            toast.success(`Deleted ${count} module${count === 1 ? '' : 's'} successfully`, { id: toastId });
        } catch (err) {
            toast.error("Failed to delete modules", { id: toastId });
            console.error('Bulk delete error:', err);
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

        // Show content parameters modal instantly - teacher can select options while saving
        setSavedModulesData(finalData.new_modules);
        setIsContentParamsOpen(true);
        setIsSavingStructure(true); // Lock confirm button

        // Save structure to DB in background and fetch real IDs
        const toastId = toast.loading('Saving curriculum structure...');
        try {
            await api.post(`/teacher/courses/${id}/ai-commit`, finalData);
            toast.success('Structure saved!', { id: toastId });

            // Fetch the saved course with real module/lesson/quiz IDs
            const courseData = await api.get(`/teacher/courses/${id}`);
            setSavedModulesData(courseData.data.modules || []);

            // Invalidate cache so new modules appear
            invalidateCache(`/teacher/courses/${id}`);
        } catch (err) {
            toast.error('Failed to save curriculum', { id: toastId });
        } finally {
            setIsSavingStructure(false); // Unlock confirm button
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

    // Add log entry for generation console with optional stagger delay
    const addLog = (type, message, delayMs = 0) => {
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        if (delayMs > 0) {
            // Queue the log for delayed addition without blocking stream reading
            setTimeout(() => {
                setGenerationLogs(prev => [...prev, { type, message, timestamp }]);
            }, delayMs);
        } else {
            setGenerationLogs(prev => [...prev, { type, message, timestamp }]);
        }
    };

    const generateLessonContent = async (modules, params) => {
        setIsGeneratingContent(true);
        setIsContentModalOpen(true);
        setContentParams(params); // Save for validation
        setGenerationLogs([]); // Clear previous logs

        // Build structure for content generation (AI determines quiz question counts)
        const structure = modules.map(module => {
            // Handle both old format (lessons/quizzes arrays) and new format (items array)
            const lessons = module.lessons ? module.lessons : (module.items || []).filter(item => item.type === 'lesson');
            const quizzes = module.quizzes ? module.quizzes : (module.items || []).filter(item => item.type === 'quiz');

            return {
                title: module.title,
                lessons: lessons.map((l, idx) => ({ id: l.id || `lesson_${idx}`, title: l.title })),
                quizzes: quizzes.map((q, idx) => ({
                    id: q.id || `quiz_${idx}`,
                    title: q.title
                    // No predictedQuestions - AI decides the count
                }))
            };
        });

        setGeneratedContent({ modules: structure.map(m => ({
            ...m,
            lessons: m.lessons.map(l => ({ ...l, blockCount: 0, codeCount: 0, generating: false, generated: false })),
            quizzes: m.quizzes.map(q => ({ ...q, questionCount: 0, generating: false, generated: false }))
        }))});

        // Add initial logs
        addLog('start', 'Initializing AI content generation pipeline...');
        addLog('info', 'Connecting to Groq API (llama-3.3-70b-versatile)');

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
            let logDelayOffset = 0;
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
                                addLog('progress', data.message, logDelayOffset);
                                logDelayOffset += 40;
                            } else if (data.type === 'section_complete') {
                                const sectionData = data.data;
                                addLog('info', `✓ Section ${sectionData.section_index}/${sectionData.total_sections}: ${sectionData.section_title}`, logDelayOffset);
                                logDelayOffset += 30;
                            } else if (data.type === 'section_preview') {
                                // Add section preview as it's generated
                                const previewData = data.data;
                                setGeneratedContent(prev => ({
                                    ...prev,
                                    modules: prev.modules.map(m => ({
                                        ...m,
                                        lessons: m.lessons.map(l =>
                                            l.id === previewData.lesson_id
                                                ? {
                                                    ...l,
                                                    blocks: [...(l.blocks || []), previewData.section_block],
                                                    generated: false  // Not fully done yet
                                                }
                                                : l
                                        )
                                    }))
                                }));
                            } else if (data.type === 'lesson_complete') {
                                lessonsCompleted++;
                                const lessonData = data.data;
                                addLog('complete', `✓ Lesson "${lessonData.lesson_title}" complete`, logDelayOffset);
                                logDelayOffset += 60;
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
                                                    blocks: lessonData.blocks,
                                                    generated: true,
                                                    generating: false
                                                }
                                                : l
                                        )
                                    }))
                                }));
                            } else if (data.type === 'quiz_complete') {
                                const quizData = data.data;
                                addLog('complete', `✓ Quiz "${quizData.quiz_title}" complete`, logDelayOffset);
                                logDelayOffset += 60;

                                // Extract questions based on structure (grouped or flat)
                                let questions = [];
                                if (quizData.multiple_choice || quizData.true_false || quizData.identification || quizData.enumeration || quizData.coding) {
                                  // Grouped structure
                                  questions = [
                                    ...(quizData.multiple_choice || []),
                                    ...(quizData.true_false || []),
                                    ...(quizData.identification || []),
                                    ...(quizData.enumeration || []),
                                    ...(quizData.coding || [])
                                  ];
                                } else if (quizData.questions) {
                                  questions = quizData.questions;
                                }

                                setGeneratedContent(prev => ({
                                    ...prev,
                                    modules: prev.modules.map(m => ({
                                        ...m,
                                        quizzes: m.quizzes.map(q =>
                                            q.id === quizData.quiz_id
                                                ? {
                                                    ...q,
                                                    questions: questions,
                                                    questionCount: questions.length,
                                                    generated: true,
                                                    generating: false
                                                }
                                                : q
                                        )
                                    }))
                                }));
                            } else if (data.type === 'complete') {
                                addLog('complete', '✓ All content generated successfully', logDelayOffset + 100);
                                setTimeout(() => {
                                    toast.success('All content generated successfully!');
                                    setIsGeneratingContent(false);

                                    // Invalidate cache to force fresh data
                                    invalidateCache(`/teacher/courses/${id}`);
                                    invalidateCache('/teacher/lessons/');
                                    invalidateCache('/teacher/quizzes/');

                                    fetchCourse(); // Refresh to show new content
                                }, logDelayOffset + 100);
                            } else if (data.type === 'error') {
                                addLog('error', `✗ Error: ${data.message}`, logDelayOffset);
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

    const calculateQuestionCount = (quizData) => {
        // Handle new grouped structure or old flat structure
        if (quizData.multiple_choice || quizData.true_false || quizData.identification || quizData.enumeration || quizData.coding) {
            // New grouped structure
            return (
                (quizData.multiple_choice?.length || 0) +
                (quizData.true_false?.length || 0) +
                (quizData.identification?.length || 0) +
                (quizData.enumeration?.length || 0) +
                (quizData.coding?.length || 0)
            );
        }
        // Old flat structure
        return quizData.questions?.length || 0;
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
        setUploadSuccess(null);
        try {
            const formData = new FormData();
            formData.append('curriculum_file', file);

            const response = await api.post(`/teacher/courses/${id}/upload-curriculum`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const { is_coding } = response.data;

            // Show success message in modal
            setUploadSuccess({
                fileName: file.name,
                isCoding: is_coding,
                message: is_coding ? '📚 Programming Course Detected' : '📖 Non-Programming Course'
            });

            // Invalidate cache and refetch
            invalidateCache(`/teacher/courses/${id}`);
            fetchCourse();

            // Auto-close modal after 3 seconds
            setTimeout(() => {
                setShowCurriculumModal(false);
                setUploadSuccess(null);
            }, 3000);
        } catch (err) {
            console.error('Upload error:', err);
            setUploadSuccess({
                error: err.response?.data?.error || 'Failed to upload curriculum'
            });
        } finally {
            setUploadingCurriculum(false);
        }
    };

    if (loading || !course) return (
        <div className="builder-container">
            <header style={{ marginBottom: '40px' }}>
                <div style={{ marginBottom: '24px', height: '24px' }} className="w-32 bg-white/5 rounded-lg animate-pulse" />

                <div style={{ padding: '24px 28px', marginBottom: '32px' }} className="rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
                        <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
                    </div>
                    <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse ml-auto" />
                </div>

                <div style={{ marginBottom: '32px', gap: '24px' }} className="flex flex-col md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                        <div style={{ marginBottom: '12px' }} className="h-12 w-48 bg-white/5 rounded-lg animate-pulse" />
                        <div className="h-6 w-full bg-white/5 rounded-lg animate-pulse" />
                    </div>
                    <div className="flex gap-3">
                        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
                        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
                        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
                    </div>
                </div>
            </header>

            <div style={{ marginBottom: '32px' }}>
                <div style={{ padding: '20px 28px', marginBottom: '32px' }} className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.02]">
                    <div className="h-10 w-32 bg-white/5 rounded-xl animate-pulse" />
                    <div className="ml-auto flex gap-2">
                        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
                        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} style={{ padding: '24px' }} className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
                            <div style={{ marginBottom: '16px', height: '120px' }} className="bg-white/5 animate-pulse rounded-lg" />
                            <div className="space-y-4">
                                <div className="h-6 w-full bg-white/5 rounded-lg animate-pulse" />
                                <div className="h-4 w-3/4 bg-white/5 rounded-lg animate-pulse" />
                                <div style={{ marginTop: '16px', paddingTop: '16px' }} className="flex gap-3 border-t border-white/5">
                                    <div className="h-6 w-24 bg-white/5 rounded-lg animate-pulse" />
                                    <div className="h-6 w-16 bg-white/5 rounded-lg animate-pulse ml-auto" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const activeModuleData = activeModuleId ? course.modules.find(m => m.id === activeModuleId) : null;

    return (
        <div className="builder-container">
            <header style={{ marginBottom: '40px' }} className="mb-10">
                <button onClick={() => activeModuleId ? setActiveModuleId(null) : navigate(-1)} style={{ marginBottom: '24px', padding: '12px 0' }} className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                    <ChevronLeft size={18} />
                    <span className="text-xs font-bold uppercase tracking-[0.1em]">{activeModuleId ? 'Return to Modules' : 'Exit to Classroom'}</span>
                </button>

                {/* Top Control Bar - Enhanced */}
                {!activeModuleId && (
                    <div style={{ padding: '24px 28px', marginBottom: '32px' }} className="rounded-2xl bg-gradient-to-r from-purple-900/30 to-transparent border border-purple-500/20 flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span style={{ padding: '10px 16px' }} className={`rounded-lg text-xs font-bold uppercase tracking-wider ${
                                isPublished
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-slate-600/20 text-slate-300 border border-slate-500/30'
                            }`}>
                                {isPublished ? '✓ Live' : '◊ Draft'}
                            </span>
                            {course.curriculum_file_url && (
                                <div style={{ padding: '10px 16px' }} className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold uppercase">
                                    <FileText size={14} />
                                    <span className="text-[11px]">{course.curriculum_file_url.split('/').pop()?.slice(0, 30) || 'Curriculum'}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                            <button
                                disabled={isUpdatingStatus}
                                onClick={publishAllItems}
                                style={{ padding: '10px 16px' }}
                                className="text-xs font-bold text-purple-300 hover:text-purple-200 uppercase tracking-wider border-none bg-transparent cursor-pointer hover:bg-purple-500/10 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : 'Publish All'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Header Title and Action Buttons */}
                <div style={{ marginBottom: '32px', gap: '24px' }} className="flex flex-col md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                        {!activeModuleId ? (
                            <>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em]">Course</span>
                                <div style={{ marginTop: '12px', gap: '12px' }} className="flex items-center group">
                                    {isTitleEditing ? (
                                        <div className="flex items-center gap-2 bg-white/5 border border-purple-500/50 rounded-xl p-2 flex-1">
                                            <input
                                                autoFocus
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCourseTitle(editingTitle);
                                                    if (e.key === 'Escape') setIsTitleEditing(false);
                                                }}
                                                className="flex-1 bg-transparent border-none text-white text-4xl font-black outline-none"
                                            />
                                            <button
                                                onClick={() => handleCourseTitle(editingTitle)}
                                                className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                                            >
                                                <Check size={20} />
                                            </button>
                                            <button
                                                onClick={() => setIsTitleEditing(false)}
                                                className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <h1 className="text-5xl font-black text-white tracking-tight cursor-pointer hover:text-purple-400 transition-colors" onClick={() => {
                                                setEditingTitle(course.title);
                                                setIsTitleEditing(true);
                                            }}>
                                                {course.title}
                                            </h1>
                                            <span className="text-slate-500 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                                        </>
                                    )}
                                </div>
                                {course.description && (
                                    <p className="text-slate-400 text-sm mt-3 max-w-2xl">{course.description}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em]">Module</span>
                                <h1 style={{ marginTop: '12px' }} className="text-5xl font-black text-white tracking-tight">
                                    {activeModuleData?.title}
                                </h1>
                            </>
                        )}
                    </div>

                    {/* Action Buttons - Redesigned */}
                    {!activeModuleId && (
                        <div className="flex flex-wrap gap-4 md:flex-nowrap md:justify-end">
                            <button
                                onClick={() => setShowCurriculumModal(true)}
                                style={{ padding: '14px 22px' }}
                                className="bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl text-xs font-bold uppercase border border-white/10 hover:border-white/20 flex items-center gap-2 transition-all cursor-pointer"
                            >
                                <FileText size={16} />
                                {course.curriculum_file_url ? 'Manage' : 'Upload'}
                            </button>
                            <button
                                onClick={toggleCourseStatus}
                                style={{ padding: '14px 22px' }}
                                className={`rounded-xl text-xs font-bold uppercase transition-all border flex items-center gap-2 cursor-pointer ${
                                    isPublished
                                        ? 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:bg-slate-700/40'
                                        : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white border-purple-600/50 shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-purple-600'
                                }`}
                            >
                                {isPublished ? 'Unpublish' : 'Go Live'}
                            </button>
                            <button
                                onClick={() => setIsAiModalOpen(true)}
                                style={{ padding: '14px 22px' }}
                                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-bold uppercase border-none cursor-pointer flex items-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
                            >
                                <Sparkles size={16} /> AI
                            </button>
                            <button
                                onClick={handleIndexCourse}
                                disabled={isUpdatingStatus}
                                style={{ padding: '14px 22px' }}
                                className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-xs font-bold uppercase border-none cursor-pointer flex items-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                                Index for AI
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <AnimatePresence mode="wait">
                {!activeModuleId ? (
                    <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                        {/* Control Toolbar */}
                        <div style={{ padding: '20px 28px', marginBottom: '32px' }} className="flex flex-wrap justify-between items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.03] to-transparent">
                            <button
                                onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })}
                                style={{ padding: '14px 22px' }}
                                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider border-none cursor-pointer flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                            >
                                <Plus size={16} /> New Module
                            </button>

                            <div className="flex gap-2 ml-auto">
                                <button
                                    onClick={() => setIsReorderMode(!isReorderMode)}
                                    style={{ padding: '12px 18px' }}
                                    className={`rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
                                        isReorderMode
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                            : 'bg-transparent text-slate-500 border-white/10 hover:text-slate-300 hover:border-white/20'
                                    }`}
                                >
                                    <GripHorizontal size={16} />
                                    {isReorderMode ? 'Done' : 'Reorder'}
                                </button>

                                <button
                                    onClick={() => {
                                        setIsBulkDeleteMode(!isBulkDeleteMode);
                                        setSelectedModuleIds(new Set());
                                    }}
                                    style={{ padding: '12px 18px' }}
                                    className={`rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
                                        isBulkDeleteMode
                                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                            : 'bg-transparent text-slate-500 border-white/10 hover:text-slate-300 hover:border-white/20'
                                    }`}
                                >
                                    <Trash2 size={16} />
                                    {isBulkDeleteMode ? 'Cancel' : 'Delete'}
                                </button>

                                {isBulkDeleteMode && selectedModuleIds.size > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={isDeleting}
                                        style={{ padding: '12px 18px' }}
                                        className="rounded-xl text-xs font-bold uppercase tracking-wider border-none cursor-pointer transition-all bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/20"
                                    >
                                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        Delete {selectedModuleIds.size}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 relative">
                            {course.modules.map((module) => {
                                const total = (module.lessons?.length || 0) + (module.quizzes?.length || 0);
                                const published = [...(module.lessons || []), ...(module.quizzes || [])].filter(i => i.is_published).length;
                                const unpublished = total - published;
                                const statusText = total === 0 ? 'Empty' : (unpublished === 0 ? 'All Published' : `${unpublished} Draft`);
                                const statusColor = total === 0 ? 'slate' : (unpublished === 0 ? 'emerald' : 'amber');
                                const isDragging = draggingModuleId === module.id;

                                return (
                                    <div
                                        key={module.id}
                                        draggable={isReorderMode}
                                        onDragStart={(e) => {
                                            setDraggingModuleId(module.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onDragEnd={() => {
                                            if (dragOverModuleId) {
                                                handleSwap(draggingModuleId, dragOverModuleId);
                                            }
                                            setDraggingModuleId(null);
                                            setDragOverModuleId(null);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (draggingModuleId !== module.id) {
                                                setDragOverModuleId(module.id);
                                            }
                                        }}
                                        onDragLeave={() => setDragOverModuleId(null)}
                                        className={`relative group transition-opacity ${isReorderMode ? 'cursor-grab active:cursor-grabbing' : isBulkDeleteMode ? 'cursor-pointer' : 'cursor-pointer'} ${draggingModuleId === module.id ? 'opacity-40' : ''} ${dragOverModuleId === module.id ? 'opacity-60 scale-95' : ''}`}
                                        onClick={() => {
                                            if (isBulkDeleteMode) {
                                                const newSelected = new Set(selectedModuleIds);
                                                if (newSelected.has(module.id)) {
                                                    newSelected.delete(module.id);
                                                } else {
                                                    newSelected.add(module.id);
                                                }
                                                setSelectedModuleIds(newSelected);
                                            } else if (!isReorderMode) {
                                                setActiveModuleId(module.id);
                                            }
                                        }}
                                    >
                                        <div style={{ padding: '24px' }} className={`h-full min-h-[280px] rounded-3xl border transition-all flex flex-col overflow-hidden ${
                                            isBulkDeleteMode && selectedModuleIds.has(module.id)
                                                ? 'border-red-500/60 bg-red-500/10'
                                                : isReorderMode
                                                ? 'border-purple-500/40 bg-gradient-to-br from-purple-900/30 to-transparent shadow-lg shadow-purple-500/20'
                                                : 'border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent group-hover:shadow-xl group-hover:shadow-purple-500/10 hover:border-purple-500/40 hover:from-purple-900/20'
                                        }`}>
                                            {/* Header Section */}
                                            <div style={{ margin: '-24px -24px 20px -24px', padding: '20px 24px' }} className="bg-gradient-to-br from-purple-900/50 to-purple-900/20 flex justify-between items-start border-b border-white/5 relative group/header">
                                                {isReorderMode && (
                                                    <div className="absolute top-1/2 left-3 -translate-y-1/2 w-8 h-10 rounded-lg bg-purple-500/40 border-2 border-purple-500/70 flex items-center justify-center text-purple-200 text-lg font-bold opacity-100 transition-all group-hover/header:bg-purple-500/60 group-hover/header:border-purple-400 cursor-grab active:cursor-grabbing shadow-lg shadow-purple-500/30">
                                                        ⋮⋮
                                                    </div>
                                                )}
                                                {isBulkDeleteMode ? (
                                                    <div className="relative w-full flex items-center justify-between gap-3">
                                                        <div className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedModuleIds.has(module.id)}
                                                                onChange={() => {}}
                                                                className="w-6 h-6 rounded-lg border-2 border-white/30 bg-white/5 cursor-pointer checked:bg-red-500 checked:border-red-500 accent-red-500 appearance-none"
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-white flex-1 line-clamp-2">{module.title}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-white shadow-lg">
                                                            <Layers size={24} />
                                                        </div>
                                                        {!isReorderMode && !isBulkDeleteMode && (
                                                            <div style={{ padding: '8px 10px', gap: '6px' }} className="flex opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setModuleModal({ isOpen: true, mode: 'edit', id: module.id, title: module.title });
                                                                    }}
                                                                    style={{ padding: '8px 10px' }}
                                                                    className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                                                                    title="Edit module"
                                                                >
                                                                    <Edit3 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteModal({ isOpen: true, type: 'module', id: module.id });
                                                                    }}
                                                                    style={{ padding: '8px 10px' }}
                                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                                                                    title="Delete module"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Content Section */}
                                            <div className="flex-grow flex flex-col justify-between">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-4 line-clamp-2 leading-snug">{module.title}</h3>
                                                    <div className="flex gap-4 text-sm text-slate-400 mb-6">
                                                        <div className="flex items-center gap-2">
                                                            <BookOpen size={16} className="text-purple-400" />
                                                            <span className="font-semibold">{module.lessons?.length || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <HelpCircle size={16} className="text-blue-400" />
                                                            <span className="font-semibold">{module.quizzes?.length || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer with Status */}
                                                <div style={{ marginTop: '20px', paddingTop: '16px' }} className="border-t border-white/5 flex items-center justify-between">
                                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider inline-block bg-${statusColor}-500/20 text-${statusColor}-400 border border-${statusColor}-500/30`}>
                                                        {statusText}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-semibold">{total} items</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="timeline" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} style={{ padding: '40px 48px' }} className="bg-[#050505] border border-white/5 rounded-[45px] shadow-2xl">
                        <div style={{ marginBottom: '32px', paddingBottom: '24px' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                    <BookOpen size={24}/>
                                </div>
                                <p className="text-sm text-slate-400 font-semibold">{(activeModuleData?.lessons?.length || 0)} lessons • {(activeModuleData?.quizzes?.length || 0)} quizzes</p>
                            </div>
                            <div className="flex gap-2 flex-wrap md:flex-nowrap">
                                <button
                                    disabled={isUpdatingStatus}
                                    onClick={() => {
                                        setIsUpdatingStatus(true);
                                        const lessonIds = activeModuleData?.lessons?.map(l => l.id) || [];
                                        const quizIds = activeModuleData?.quizzes?.map(q => q.id) || [];
                                        const allPublished = [...(activeModuleData?.lessons || []), ...(activeModuleData?.quizzes || [])].every(i => i.is_published);

                                        Promise.all([
                                            ...lessonIds.map(lid => api.put(`/teacher/lessons/${lid}`, { is_published: !allPublished })),
                                            ...quizIds.map(qid => api.put(`/teacher/quizzes/${qid}`, { is_published: !allPublished }))
                                        ]).then(() => {
                                            invalidateCache(`/teacher/courses/${id}`);
                                            fetchCourse();
                                            toast.success(allPublished ? 'All unpublished' : 'All published');
                                        }).catch(() => toast.error('Failed to update')).finally(() => setIsUpdatingStatus(false));
                                    }}
                                    style={{ padding: '12px 18px' }}
                                    className="text-xs font-bold rounded-lg border transition-all disabled:opacity-50 flex items-center gap-2 bg-white/10 hover:bg-white/15 text-slate-300 border-white/20 cursor-pointer"
                                >
                                    {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : 'Toggle All'}
                                </button>
                                <button onClick={() => setDeleteModal({ isOpen: true, type: 'module', id: activeModuleId })} style={{ padding: '12px 14px' }} className="bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-xl border-none cursor-pointer transition-all shadow-sm"><Trash2 size={18}/></button>
                            </div>
                        </div>

                        {/* Creation UI At Top */}
                        <div style={{ marginBottom: '32px', paddingBottom: '32px' }} className="border-b border-white/5">
                            <AnimatePresence mode="wait">
                                {activeInput.type ? (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ padding: '16px 20px', gap: '12px' }} className="flex items-center bg-black rounded-2xl border border-white/10 shadow-xl">
                                        <input autoFocus placeholder={`Name your new ${activeInput.type}...`} value={activeInput.value} onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()} className="flex-grow bg-transparent border-none outline-none text-white font-bold" />
                                        <button onClick={() => setActiveInput({ type: null, value: '' })} style={{ padding: '8px 10px' }} className="text-slate-500 border-none bg-transparent cursor-pointer"><X size={20}/></button>
                                        <button disabled={isSubmittingItem || !activeInput.value.trim()} onClick={handleCreateItem} style={{ padding: '12px 14px', minWidth: '44px' }} className="bg-purple-600 text-white rounded-xl flex items-center justify-center border-none cursor-pointer hover:bg-purple-500 transition-all">{isSubmittingItem ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}</button>
                                    </motion.div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setActiveInput({ type: 'lesson', value: '' })} style={{ padding: '20px 16px' }} className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-purple-500/50 text-slate-500 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-3"><Plus size={18}/><span className="text-[10px] font-black uppercase tracking-widest">New Lesson</span></button>
                                        <button onClick={() => setActiveInput({ type: 'quiz', value: '' })} style={{ padding: '20px 16px' }} className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-cyan-500/50 text-slate-500 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-3"><Plus size={18}/><span className="text-[10px] font-black uppercase tracking-widest">New Quiz</span></button>
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
                                            <div style={{ gap: '12px' }} className="flex items-center">
                                                <button onClick={() => toggleItemStatus(item)} className={`action-icon-btn ${item.is_published ? 'active' : ''}`} title={item.is_published ? 'Hide' : 'Show'}>
                                                    {item.is_published ? <Eye size={18} /> : <EyeOff size={18} />}
                                                </button>
                                                <button onClick={() => navigate(`/dashboard/teacher/class/${course.class_id}/${item.itemType}/${item.id}`)} style={{ padding: '10px 16px' }} className="bg-white text-black text-[9px] font-black uppercase rounded-lg hover:bg-purple-500 hover:text-white transition-all border-none cursor-pointer">Open</button>
                                                <button onClick={() => setDeleteModal({ isOpen: true, type: item.itemType, id: item.id })} className="action-icon-btn hover:text-red-500 hover:border-red-500/30" title="Delete"><Trash2 size={18}/></button>
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
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ padding: '50px 40px' }} className="relative z-10 w-full max-w-md bg-[#05011d] border border-white/10 rounded-[40px] shadow-2xl">
                            <h2 style={{ marginBottom: '32px', fontSize: '1.75rem' }} className="font-black text-white">{moduleModal.mode === 'create' ? 'New Module' : 'Rename Module'}</h2>
                            <form onSubmit={handleModuleSubmit} className="space-y-6">
                                <input autoFocus value={moduleModal.title} onChange={(e) => setModuleModal({ ...moduleModal, title: e.target.value })} placeholder="Chapter Name..." style={{ padding: '16px 20px' }} className="w-full bg-black border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-purple-500/50" />
                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setModuleModal({ ...moduleModal, isOpen: false })} style={{ padding: '16px 24px' }} className="flex-1 bg-white/5 rounded-2xl text-slate-400 font-black text-[10px] uppercase border-none cursor-pointer hover:bg-white/10 transition-all">Cancel</button>
                                    <button disabled={isSubmittingItem || !moduleModal.title.trim()} type="submit" style={{ padding: '16px 24px' }} className="flex-1 bg-purple-600 text-white font-black text-[10px] uppercase rounded-2xl border-none cursor-pointer hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">{isSubmittingItem ? <Loader2 className="animate-spin mx-auto" size={16}/> : 'Confirm'}</button>
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

            {/* Indexing Stats Modal */}
            <IndexingStatsModal courseId={id} isOpen={showIndexingStats} onClose={() => setShowIndexingStats(false)} />

            {/* Content Parameters Modal (Stage 2: Configure content details) */}
            <ContentParametersModal
                isOpen={isContentParamsOpen}
                onClose={() => setIsContentParamsOpen(false)}
                onGenerate={handleStartContentGeneration}
                structureParams={structureParams}
                course={course}
                isSavingStructure={isSavingStructure}
            />

            {/* Generation Console (Terminal-style UI) */}
            <GenerationConsole
                isOpen={isContentModalOpen}
                onClose={() => {
                    setIsContentModalOpen(false);
                    fetchCourse();
                }}
                generatedContent={generatedContent}
                isGenerating={isGeneratingContent}
                logs={generationLogs}
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
                            style={{ padding: '50px 40px' }}
                            className="relative z-10 w-full max-w-lg bg-[#030014] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                        >
                            {uploadSuccess && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    style={{ marginBottom: '24px', padding: '16px 20px' }}
                                    className={`${uploadSuccess.error ? 'bg-red-500/10 border-b border-red-500/30' : 'bg-green-500/10 border-b border-green-500/30'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {uploadSuccess.error ? (
                                            <>
                                                <X size={20} className="text-red-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-red-400 font-semibold text-sm">{uploadSuccess.error}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-green-400 font-semibold text-sm">{uploadSuccess.fileName} uploaded!</p>
                                                    <p className="text-green-300/80 text-xs mt-1">{uploadSuccess.message}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                            <div>
                                <div style={{ marginBottom: '32px' }} className="flex justify-between items-center">
                                    <h2 style={{ fontSize: '1.75rem', marginBottom: 0 }} className="font-bold text-white flex items-center gap-2">
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
                                    <div style={{ gap: '24px' }} className="flex flex-col">
                                        <div style={{ padding: '20px 24px' }} className="bg-green-500/10 border border-green-500/30 rounded-2xl">
                                            <div style={{ marginBottom: '12px' }} className="flex items-center gap-3">
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
                                            <div style={{ marginTop: '16px', paddingTop: '16px' }} className="border-t border-green-500/20">
                                                <button
                                                    onClick={async () => {
                                                        const newValue = !course.is_coding;
                                                        setCourse(prev => ({ ...prev, is_coding: newValue }));
                                                        try {
                                                            await api.put(`/teacher/courses/${course.id}`, { is_coding: newValue });
                                                        } catch (err) {
                                                            toast.error('Failed to update course setting');
                                                            setCourse(prev => ({ ...prev, is_coding: !newValue }));
                                                        }
                                                    }}
                                                    style={{ padding: '12px 16px' }}
                                                    className="flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer text-slate-400 hover:text-white"
                                                >
                                                    {course.is_coding ? (
                                                        <>
                                                            <span className="text-blue-400">📚</span>
                                                            <span>Programming Course Detected (Click to toggle)</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-amber-400">📖</span>
                                                            <span>Non-Programming Course (Click to toggle)</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ marginBottom: '12px', display: 'block' }} className="text-xs font-bold text-slate-500 uppercase tracking-widest">
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
                                                style={{ padding: '18px 16px' }}
                                                className="flex items-center justify-center gap-2 w-full bg-white/[0.03] border border-white/10 hover:border-purple-500/50 rounded-xl text-slate-400 hover:text-purple-400 cursor-pointer transition-all"
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
                                        <p style={{ marginBottom: '24px' }} className="text-slate-400 text-sm">
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
                                            style={{ padding: '24px 16px' }}
                                            className="flex items-center justify-center gap-2 w-full bg-white/[0.03] border border-white/10 hover:border-purple-500/50 rounded-xl text-slate-400 hover:text-purple-400 cursor-pointer transition-all"
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
                                    <div style={{ gap: '12px' }} className="flex items-center">
                                        <div className="relative">
                                            <div className="w-3 h-3 rounded-full bg-purple-500 animate-ping absolute" />
                                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                                        </div>
                                        <div>
                                            <span style={{ marginBottom: '4px', display: 'block' }} className="text-xs font-black uppercase tracking-[0.3em] text-purple-300">AI Curriculum Architect</span>
                                            <span className="text-[10px] text-slate-500">Generating in real-time...</span>
                                        </div>
                                    </div>
                                    <Sparkles size={20} className="text-purple-400 animate-pulse" />
                                </div>

                                {/* Module Preview with Animations */}
                                {aiResult?.new_modules && aiResult.new_modules.length > 0 && (
                                    <div style={{ marginBottom: '24px', gap: '12px' }} className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                                        {aiResult.new_modules.map((module, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                transition={{ delay: idx * 0.2 }}
                                                style={{ padding: '16px 20px', gap: '12px' }}
                                                className="bg-white/5 border border-purple-500/20 rounded-2xl"
                                            >
                                                <div style={{ marginBottom: '12px', gap: '8px' }} className="flex items-center">
                                                    <Sparkles size={14} className="text-purple-400" />
                                                    <span className="font-bold text-white">{module.title}</span>
                                                </div>
                                                <div style={{ paddingLeft: '24px', gap: '4px' }} className="space-y-1">
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
                                <div style={{ padding: '16px 20px', gap: '8px' }} className="bg-black/40 rounded-2xl max-h-40 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar border border-white/5">
                                    {aiLogs.map((log, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            style={{ gap: '8px' }}
                                            className="text-slate-300 flex items-start"
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