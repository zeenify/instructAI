import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { queryClient } from '../../lib/queryClient';
import { courseContentKey } from '../../queries/classDetails';
import { motion, AnimatePresence, useDragControls, Reorder } from 'framer-motion';
import {
    ChevronLeft, ChevronUp, ChevronDown, Plus, FileText, HelpCircle, Loader2,
    Sparkles, ExternalLink, X, Check, GripVertical, Eye, EyeOff, Globe, Lock, Rocket, Trash2, Edit3, Send, Layers, GripHorizontal, Upload, CheckCircle, BookOpen, ArrowRight,
    FileCheck2, FileUp, Code2, FileWarning, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import Button from '../../components/ui/Button';
import DeleteModal from '../../components/ui/DeleteModal';
import Dropdown from '../../components/ui/Dropdown';
import ModuleModal from '../../components/teacher/ModuleModal';
import AiArchitectModal from './AiArchitectModal';
import CurriculumReviewModal from './CurriculumReviewModal.jsx';
import ContentParametersModal from './ContentParametersModal.jsx';
import GenerationConsole from './GenerationConsole.jsx';
import IndexingStatsModal from '../../components/teacher/IndexingStatsModal';
import './CourseBuilder.css';

/** Rough student reading cost from lesson content blocks (same heuristic as the student view). */
function lessonMinutes(lesson) {
    const blocks = Array.isArray(lesson.content) ? lesson.content : [];
    if (!blocks.length) return null;
    const words = blocks.reduce((n, b) => {
        const t = b?.type === 'text' || b?.type === 'h1' ? String(b?.data?.text || '') : '';
        return n + t.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    }, 0);
    const videos = blocks.filter((b) => b.type === 'video').length;
    return Math.max(1, Math.round(words / 180) + videos * 3);
}

/**
 * One draggable row in a module's content sequence. Dragging starts only
 * from the grip (dragListener={false}) so the row's click-to-editor never
 * fights the drag gesture.
 */
function ModuleItemRow({ item, index, lastIndex, onOpen, onToggle, onMove, onDelete, toggling }) {
    const controls = useDragControls();
    const [dragging, setDragging] = useState(false);
    const movedRef = useRef(false);
    const isLesson = item.itemType === 'lesson';
    const mins = isLesson ? lessonMinutes(item) : null;
    const qCount = item.questions_count;

    return (
        <Reorder.Item
            value={item}
            dragListener={false}
            dragControls={controls}
            className={`cd-md-row ${!item.is_published ? 'is-draft' : ''} ${dragging ? 'dragging' : ''}`}
            onDragStart={() => { movedRef.current = true; setDragging(true); }}
            onDragEnd={() => {
                setDragging(false);
                // The click event fires right after pointer-up on a drag; keep
                // the guard up for a tick so a drop never opens the editor.
                setTimeout(() => { movedRef.current = false; }, 150);
            }}
            onClick={() => { if (!movedRef.current && !dragging) onOpen(item); }}
        >
            <button
                type="button"
                className="cd-md-grip"
                title="Drag to reorder"
                aria-label="Drag to reorder"
                onPointerDown={(e) => controls.start(e)}
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={16} />
            </button>
            <span className="cd-md-num">{String(index + 1).padStart(2, '0')}</span>
            <span className={`cd-md-type ${isLesson ? 'lesson' : 'quiz'}`}>
                {isLesson ? <FileText size={12} /> : <HelpCircle size={12} />}
                {isLesson ? 'LESSON' : 'QUIZ'}
            </span>
            <div className="cd-md-body">
                <div className="cd-md-name">{item.title}</div>
                <div className={`cd-md-sub ${(isLesson && mins === null) || (!isLesson && qCount === 0) ? 'warn' : ''}`}>
                    {isLesson
                        ? (mins === null ? 'No content yet — open to write it' : `~${mins} min read`)
                        : (qCount === undefined
                            ? ' '
                            : (qCount === 0 ? 'No questions yet' : `${qCount} question${qCount === 1 ? '' : 's'}`))}
                </div>
            </div>
            {/* The status pill IS the per-item publish switch — the eye icon
                says "this toggles visibility" at a glance */}
            <button
                type="button"
                className={`cd-md-status ${item.is_published ? 'live' : 'draft'}`}
                title={item.is_published
                    ? 'Live — students can see this. Click to hide it.'
                    : "Draft — students can't see this yet. Click to publish."}
                disabled={toggling === item.id}
                onClick={() => onToggle(item)}
            >
                {toggling === item.id ? <Loader2 size={11} className="animate-spin" /> : (item.is_published ? <Eye size={11} /> : <EyeOff size={11} />)}
                {item.is_published ? 'Live' : 'Draft'}
            </button>
            <div className="cd-md-tools" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="cd-tool-move"
                    title="Move up"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => onMove(item, -1)}
                >
                    <ChevronUp size={15} />
                </button>
                <button
                    type="button"
                    className="cd-tool-move"
                    title="Move down"
                    aria-label="Move down"
                    disabled={index === lastIndex}
                    onClick={() => onMove(item, 1)}
                >
                    <ChevronDown size={15} />
                </button>
                <button type="button" className="cd-tool-del" title="Delete" onClick={() => onDelete(item)}>
                    <Trash2 size={16} />
                </button>
            </div>
            <span className="cd-md-go">
                Open
                <ArrowRight size={13} />
            </span>
        </Reorder.Item>
    );
}

/**
 * Course editor. Normally a page (route param supplies the course id), but it
 * can also be EMBEDDED in the class page's Content tab: pass `courseId` and
 * `embedded` — embedded hides the page chrome (back link, course title) that
 * would duplicate the class page header, keeping every content action.
 * See docs/data-layer-plan.md (strict 1 class = 1 course).
 *
 * The open module can be CONTROLLED (openModuleId + onOpenModule — the class
 * page mirrors it into ?module= so refresh/back/share keep the view) or left
 * uncontrolled (standalone route keeps it in local state).
 */
export default function CourseBuilder({
    courseId = null,
    embedded = false,
    initialCourse = null,
    openModuleId = null,
    onOpenModule = null,
}) {
    const params = useParams();
    const id = courseId ?? params.id;
    const navigate = useNavigate();

    // Core States. When embedded, the parent passes initialCourse (already
    // loaded by the class page) so the builder mounts pre-filled — its own
    // background refetch never flashes a second skeleton.
    const enrichCourse = (data) => data ? {
        ...data,
        modules: (data.modules || []).map(m => ({
            ...m,
            lessons: (m.lessons || []).map(l => ({ ...l, itemType: 'lesson' })),
            quizzes: (m.quizzes || []).map(q => ({ ...q, itemType: 'quiz' })),
        })),
    } : null;
    const [course, setCourse] = useState(() => enrichCourse(initialCourse));
    const [loading, setLoading] = useState(!initialCourse);
    // Seed from the cached course — a remount must never show a state the
    // cache already knows is wrong.
    const [isPublished, setIsPublished] = useState(Boolean(initialCourse?.is_published));
    
    // UI View States
    const [internalModuleId, setInternalModuleId] = useState(null);
    const activeModuleId = onOpenModule ? (openModuleId ?? null) : internalModuleId;
    // Single entry point for opening/closing a module — keeps the URL param
    // (controlled) and local state (standalone) in step.
    const openModule = useCallback((moduleId) => {
        setInternalModuleId(moduleId);
        onOpenModule?.(moduleId);
    }, [onOpenModule]);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
    const [selectedModuleIds, setSelectedModuleIds] = useState(new Set());
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [confirmUnpublishAll, setConfirmUnpublishAll] = useState(false);
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    const [togglingItemId, setTogglingItemId] = useState(null);
    
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
    const [savedModulesData, setSavedModulesData] = useState(null);
    const [isContentParamsOpen, setIsContentParamsOpen] = useState(false);
    const [isSavingStructure, setIsSavingStructure] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [isContentModalOpen, setIsContentModalOpen] = useState(false);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [generationLogs, setGenerationLogs] = useState([]);
    const contentAbortRef = useRef(null);
    const [structureError, setStructureError] = useState(null);
    const [contentStartedAt, setContentStartedAt] = useState(null);
    const [contentPaused, setContentPaused] = useState(false);
    const structureAbortRef = useRef(null);
    const lastStructureRequestRef = useRef(null);
    const lastContentParamsRef = useRef(null);
    const savedModulesDataRef = useRef([]);
    const commitPromiseRef = useRef(null);
    // Delete State
    const [deleteConfig, setDeleteModal] = useState({ isOpen: false, type: '', id: null, name: null, items: [] });

    // Context for the confirm dialog: what's being deleted and what goes
    // away with it (e.g. a module's lessons and quizzes).
    const makeDeleteConfig = (type, obj) => {
        if (type === 'module') {
            return {
                type,
                id: obj.id,
                name: obj.title,
                items: [
                    ...(obj.lessons?.length ? [`${obj.lessons.length} ${obj.lessons.length === 1 ? 'lesson' : 'lessons'}`] : []),
                    ...(obj.quizzes?.length ? [`${obj.quizzes.length} ${obj.quizzes.length === 1 ? 'quiz' : 'quizzes'}`] : []),
                ],
            };
        }
        return {
            type,
            id: obj.id,
            name: obj.title,
            items: type === 'quiz' && obj.questions_count
                ? [`${obj.questions_count} ${obj.questions_count === 1 ? 'question' : 'questions'}`]
                : [],
        };
    };
    const [isDeleting, setIsDeleting] = useState(false);

    // Curriculum File State
    const [showCurriculumModal, setShowCurriculumModal] = useState(false);
    const [uploadingCurriculum, setUploadingCurriculum] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(null);
    const [curDrag, setCurDrag] = useState(false);
    const [confirmingCurRemoval, setConfirmingCurRemoval] = useState(false);
    const [courseLanguage, setCourseLanguage] = useState(course?.language || '');
    const [savingLanguage, setSavingLanguage] = useState(false);

    // Re-sync when the modal opens — an upload may have detected a language
    // after this component first rendered
    useEffect(() => {
        if (showCurriculumModal) setCourseLanguage(course?.language || '');
    }, [showCurriculumModal, course?.language]);

    // Indexing Stats Modal State
    const [showIndexingStats, setShowIndexingStats] = useState(false);
    const [indexingStats, setIndexingStats] = useState(null);

    useEffect(() => { fetchCourse(!initialCourse); }, [id]);

    // A ?module= param pointing at a deleted/nonexistent module closes itself
    // (also covers switching classes with a stale param in the URL).
    useEffect(() => {
        if (activeModuleId == null || !course?.modules) return;
        if (!course.modules.some(m => m.id === activeModuleId)) openModule(null);
    }, [activeModuleId, course, openModule]);

    const fetchCourse = async (showLoading = true) => {
        try {
            // The editor always fetches fresh — a stale read here means the
            // teacher edits/publishes against the wrong state. showLoading is
            // false for embedded background refreshes (the parent skeleton
            // already covered the first load).
            const res = await api.get(`/teacher/courses/${id}`, { bypassCache: true });
            setCourse(enrichCourse(res.data));
            setIsPublished(res.data.is_published);
        } catch (err) { navigate('/dashboard/teacher'); }
        finally { if (showLoading) setLoading(false); }
    };

    // --- ACTIONS ---
    // Every mutation invalidates both cache layers: the legacy axios cache
    // AND the TanStack query the class page stat strip reads from.
    const refreshContent = () => {
        invalidateCache(`/teacher/courses/${id}`);
        queryClient.invalidateQueries({ queryKey: ['course', Number(id), 'content'] });
    };
    const toggleCourseStatus = async () => {
        setIsUpdatingStatus(true);
        const newStatus = !isPublished;
        try {
            await api.post(`/teacher/courses/${id}/publish`, { is_published: newStatus });
            refreshContent();
            setIsPublished(newStatus);
            if (newStatus) {
              toast.success("Course is now live");
            } else {
              toast.warning("Course set to draft");
            }
        } catch (err) { toast.error("Update failed"); }
        finally { setIsUpdatingStatus(false); }
    };

    const publishAllItems = async () => {
        setIsUpdatingStatus(true);
        const toastId = toast.loading("Publishing all contents...");
        try {
            await api.post(`/teacher/courses/${id}/publish-all`);
            setIsPublished(true); // optimistic — the refetch below only confirms
            refreshContent();
            toast.success("All contents published successfully", { id: toastId });
            fetchCourse();
        } catch (err) { console.error('publishAll failed:', err); toast.error("Publishing failed", { id: toastId }); fetchCourse(); }
        finally { setIsUpdatingStatus(false); }
    };

    // Embedded toolbar's single publish action: Go Live publishes the course
    // AND every module/item in one shot; Unpublish sets the course to draft.
    const handleGoLive = () => {
        if (isPublished) toggleCourseStatus();
        else publishAllItems();
    };

    const handleIndexCourse = async () => {
        // Open modal immediately with loading state
        setShowIndexingStats(true);
        setIndexingStats(null);

        try {
            // Try to fetch existing stats
            const statsRes = await api.get(`/teacher/courses/${id}/indexing-stats`);
            if (statsRes.data.total_chunks > 0) {
                // Already indexed, show stats
                setIndexingStats(statsRes.data);
                return;
            }
        } catch (err) {
            // Not indexed yet, proceed with indexing
        }

        // Index the course
        try {
            const response = await api.post(`/teacher/courses/${id}/index`);
            // Indexing succeeded, show results
            setIndexingStats(response.data);
        } catch (err) {
            toast.error("Indexing failed: " + (err.response?.data?.error || "Please try again"));
            setShowIndexingStats(false);
        }
    };

    // Called by ModuleModal; throws bubble back into the dialog so the error
    // shows inline and the typed title isn't lost.
    const handleModuleSubmit = async (title) => {
        if (moduleModal.mode === 'create') {
            const res = await api.post(`/teacher/courses/${id}/modules`, { title });
            refreshContent();
            setCourse(prev => ({ ...prev, modules: [...prev.modules, { ...res.data, lessons: [], quizzes: [] }] }));
            toast.success("Module created");
        } else {
            await api.put(`/teacher/modules/${moduleModal.id}`, { title });
            refreshContent();
            setCourse(prev => ({
                ...prev,
                modules: prev.modules.map(m => m.id === moduleModal.id ? { ...m, title } : m)
            }));
            toast.success("Module renamed");
        }
    };

    // Publish / unpublish every lesson and quiz in the open module.
    // Unpublishing blanks the module for every student, so it takes two
    // clicks: the first arms the button, the second commits.
    const handleToggleAllItems = async () => {
        const mod = course.modules.find(m => m.id === activeModuleId);
        if (!mod) return;
        const items = [...(mod.lessons || []), ...(mod.quizzes || [])];
        if (items.length === 0) return;
        const allPublished = items.every(i => i.is_published);

        if (allPublished && !confirmUnpublishAll) {
            setConfirmUnpublishAll(true);
            setTimeout(() => setConfirmUnpublishAll(false), 3000);
            return;
        }
        setConfirmUnpublishAll(false);

        setIsUpdatingStatus(true);
        setCourse(prev => ({
            ...prev,
            modules: prev.modules.map(m => m.id === activeModuleId ? {
                ...m,
                lessons: m.lessons.map(l => ({ ...l, is_published: !allPublished })),
                quizzes: m.quizzes.map(q => ({ ...q, is_published: !allPublished })),
            } : m)
        }));
        try {
            await Promise.all([
                ...mod.lessons.map(l => api.put(`/teacher/lessons/${l.id}`, { is_published: !allPublished })),
                ...mod.quizzes.map(q => api.put(`/teacher/quizzes/${q.id}`, { is_published: !allPublished })),
            ]);
            refreshContent();
            if (allPublished) toast.warning('All items unpublished');
            else toast.success('All items published');
        } catch (err) {
            toast.error('Failed to update');
            fetchCourse();
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleCourseTitle = async (newTitle) => {
        if (!newTitle || !newTitle.trim() || newTitle === course.title) {
            setIsTitleEditing(false);
            return;
        }
        try {
            await api.put(`/teacher/courses/${id}`, { title: newTitle.trim() });
            setCourse(prev => ({ ...prev, title: newTitle.trim() }));
            refreshContent();
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
            refreshContent();
            toast.success('Reordered');
        }).catch(() => {
            toast.error('Failed to save order');
            fetchCourse();
        });
    };

    const handleReorderModules = (newOrder) => {
        setCourse(prev => ({ ...prev, modules: newOrder }));
    };

    // Arrow-button reorder (touch-friendly fallback for drag): swap the item
    // with its neighbour and reuse the debounced drag-save pipeline.
    const handleMoveItem = (item, dir) => {
        const mod = course.modules.find(m => m.id === activeModuleId);
        if (!mod) return;
        const items = [...getSortedItems(mod)];
        const idx = items.findIndex(i => `${i.itemType}-${i.id}` === `${item.itemType}-${item.id}`);
        const to = idx + dir;
        if (idx === -1 || to < 0 || to >= items.length) return;
        [items[idx], items[to]] = [items[to], items[idx]];
        handleReorderItems(items);
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
                refreshContent();
            } catch (err) {}
        }, 1000);
    };

    const getSortedItems = useCallback((module) => {
        if (!module) return [];
        const live = [...(module.lessons || []), ...(module.quizzes || [])]
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        // Reconcile the last drag order with the live items: drop deleted
        // ones, append new ones, and always resolve to the CURRENT item
        // objects — a stale _lastOrder snapshot would render ghost rows and
        // out-of-date publish flags.
        if (Array.isArray(module._lastOrder)) {
            const byKey = new Map(live.map((i) => [`${i.itemType}-${i.id}`, i]));
            const ordered = module._lastOrder.map((i) => byKey.get(`${i.itemType}-${i.id}`)).filter(Boolean);
            const seen = new Set(ordered.map((i) => `${i.itemType}-${i.id}`));
            for (const i of live) {
                if (!seen.has(`${i.itemType}-${i.id}`)) ordered.push(i);
            }
            return ordered;
        }
        return live;
    }, []);

    const toggleItemStatus = async (item) => {
        setTogglingItemId(item.id);
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
            refreshContent();
            if (newStatus) {
              toast.success('Published');
            } else {
              toast.warning('Unpublished');
            }
        }
        catch (err) {
            refreshContent();
            fetchCourse();
            toast.error('Failed to toggle status');
        } finally {
            setTogglingItemId(null);
        }
    };

    const handleCreateItem = async () => {
        if (isSubmittingItem || !activeInput.value.trim() || !activeModuleId) return;
        setIsSubmittingItem(true);
        const { type, value } = activeInput;
        const endpoint = `/teacher/modules/${activeModuleId}/${type === 'lesson' ? 'lessons' : 'quizzes'}`;
        try {
            const res = await api.post(endpoint, { title: value });
            const newItem = { ...res.data, itemType: type };
            refreshContent();
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
            refreshContent();
            invalidateCache(`/teacher/${plural}/${itemId}`);

            // Optimistically update UI immediately
            if (type === 'module') {
                setCourse(prev => ({
                    ...prev,
                    modules: prev.modules.filter(m => m.id !== itemId)
                }));
                if (itemId === activeModuleId) openModule(null);
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

            setDeleteModal({ isOpen: false, type: '', id: null, name: null, items: [] });
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
            refreshContent();
            if (activeModuleId && selectedModuleIds.has(activeModuleId)) {
                openModule(null);
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
        setStructureError(null);
        setAiLogs(['Initializing AI Curriculum Architect…']);
        setAiResult({ new_modules: [] });

        // Save structure params for later — and keep the request so the
        // design modal's "Try again" can re-run it verbatim
        setStructureParams(params);
        lastStructureRequestRef.current = { prompt, params };

        // Closing the design modal aborts the structure stream
        const controller = new AbortController();
        structureAbortRef.current = controller;

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
                signal: controller.signal,
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
                                const moduleData = data.data;
                                setAiLogs(prev => [...prev, `Module ready: ${moduleData.title}`]);

                                // NOTE: never await/sleep inside this read loop. In a
                                // background tab Chrome throttles setTimeout to ~1/min,
                                // the reader stops draining the SSE socket, and the
                                // Laravel proxy deadlocks mid-stream (observed twice).
                                // Keep only instant state updates here; pacing is the
                                // backend's job.
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

                                const items = [...(moduleData.lessons || []), ...(moduleData.quizzes || [])];
                                for (const item of items) {
                                    setAiLogs(prev => [...prev, `${item.type === 'lesson' ? 'Lesson' : 'Quiz'} — ${item.title}`]);
                                }
                            } else if (data.type === 'complete') {
                                setAiLogs(prev => [...prev, 'Curriculum generation complete!']);
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
                                setAiLogs(prev => [...prev, `Error: ${data.message}`]);
                                // Stay in the design modal with a Try-again — the
                                // request is kept, so nothing the teacher typed is lost
                                setStructureError(data.message || 'The AI service hit a problem.');
                            }
                        } catch (parseErr) {
                            console.error('Failed to parse SSE data:', parseErr);
                        }
                    }
                }
            }
        } catch (err) {
            if (err?.name === 'AbortError') {
                setAiLogs(prev => [...prev, 'Stopped by teacher.']);
            } else {
                setAiLogs(prev => [...prev, `Connection error: ${err.message}`]);
                setStructureError('Could not reach the AI service. Check your connection and try again.');
            }
        } finally {
            structureAbortRef.current = null;
        }
    };

    // Pause: stop streaming now; the teacher can resume with the missing
    // items later (everything finished is already saved server-side)
    const handlePauseGeneration = () => {
        if (contentAbortRef.current) {
            contentAbortRef.current.abort();
        }
        setIsGeneratingContent(false);
        setContentPaused(true);
        toast.info('Generation paused — you can continue any time');
    };

    // Refresh-proof studio: persist the run after every progress tick. A
    // refresh kills the stream, but the studio reopens with the state as of
    // that moment and Continue finishes only what's missing.
    useEffect(() => {
        if (!generatedContent || !id) return;
        const key = `ai-run:${id}`;
        const unfinished = (generatedContent.modules || []).some(m =>
            (m.lessons || []).some(l => !l.generated) || (m.quizzes || []).some(q => !q.generated));
        if (!unfinished) {
            localStorage.removeItem(key);
            return;
        }
        try {
            localStorage.setItem(key, JSON.stringify({
                savedAt: Date.now(),
                startedAt: contentStartedAt,
                params: lastContentParamsRef.current,
                structure: generatedContent,
                logs: generationLogs.slice(-40),
            }));
        } catch { /* storage full — the run simply won't survive a refresh */ }
    }, [generatedContent, generationLogs, contentStartedAt, id]);

    // Reopen an interrupted run after a refresh
    useEffect(() => {
        if (!id) return;
        const key = `ai-run:${id}`;
        let run = null;
        try { run = JSON.parse(localStorage.getItem(key) || 'null'); } catch { }
        if (!run?.params || !run?.structure) return;
        if (Date.now() - (run.savedAt || 0) > 6 * 3600 * 1000) { localStorage.removeItem(key); return; }
        const unfinished = (run.structure.modules || []).some(m =>
            (m.lessons || []).some(l => !l.generated) || (m.quizzes || []).some(q => !q.generated));
        if (!unfinished) { localStorage.removeItem(key); return; }

        lastContentParamsRef.current = run.params;
        savedModulesDataRef.current = run.structure.modules || [];
        setContentStartedAt(run.startedAt || null);
        setGeneratedContent(run.structure);
        setGenerationLogs(run.logs || []);
        setIsContentModalOpen(true); // the studio reopens mid-flow, banner + Continue ready
        localStorage.removeItem(key); // the persistence effect re-saves fresh state
        toast.info('Reopened your interrupted generation — continue whenever ready');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Continue after an interrupted run: regenerate ONLY the items that never
    // finished. Everything already saved stays untouched (per-item persistence
    // means this is a safe, targeted top-up — not a restart).
    const handleContinueGeneration = () => {
        const remaining = (generatedContent?.modules || [])
            .map(m => ({
                ...m,
                lessons: (m.lessons || []).filter(l => !l.generated).map(({ id, title }) => ({ id, title })),
                quizzes: (m.quizzes || []).filter(q => !q.generated).map(({ id, title }) => ({ id, title })),
            }))
            .filter(m => m.lessons.length || m.quizzes.length);

        if (!remaining.length) {
            toast.info('Everything already generated.');
            return;
        }
        if (!lastContentParamsRef.current) {
            toast.error('Missing the generation settings — start a new generation instead.');
            return;
        }
        generateLessonContent(remaining, lastContentParamsRef.current);
    };

    const handleConfirmAI = async (finalData) => {
        setIsReviewOpen(false);

        // Show content parameters modal instantly - teacher can select options while saving
        setSavedModulesData(finalData.new_modules);
        savedModulesDataRef.current = finalData.new_modules;
        setIsContentParamsOpen(true);
        setIsSavingStructure(true); // Lock confirm button

        // Save structure to DB in the background and fetch real IDs. The
        // settings modal opens immediately with a LIVE button — content
        // generation simply waits for this promise before streaming.
        commitPromiseRef.current = (async () => {
            const toastId = toast.loading('Saving your outline…');
            try {
                const saved = await api.post(`/teacher/courses/${id}/ai-commit`, finalData);
                toast.success('Outline saved!', { id: toastId });

            // The commit response carries exactly the saved modules WITH their
            // real IDs — generating against the whole course payload here would
            // re-generate every module the class already had.
            savedModulesDataRef.current = saved.data.new_modules || [];
            setSavedModulesData(saved.data.new_modules || []);

            // Invalidate cache so new modules appear
            refreshContent();
            } catch (err) {
                toast.error('Failed to save the outline', { id: toastId });
            } finally {
                setIsSavingStructure(false);
            }
        })();
    };

    const handleStartContentGeneration = async (allParams) => {
        // The outline may still be saving in the background — hold here until
        // real lesson/quiz IDs exist, then stream against those
        if (commitPromiseRef.current) {
            await commitPromiseRef.current.catch(() => {});
            commitPromiseRef.current = null;
        }
        // A curriculum PDF is optional: the structure prompt from the architect
        // modal drives generation when there's no file (backend already treats
        // curriculum_text as optional context)
        if (!course.curriculum_text && !course.curriculum_file_url) {
            toast.info("No curriculum file — generating from your prompt and settings.");
        } else if (!course.curriculum_text) {
            toast.warning(
                "We couldn't read the text inside your file (often a scanned PDF), so the AI will lean on your outline instead. Lessons may be more generic — re-upload a text-based file for best results.",
                { duration: 8000 }
            );
        }

        // Start content generation immediately with params
        generateLessonContent(savedModulesDataRef.current, allParams);
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
        lastContentParamsRef.current = params;
        setContentStartedAt(Date.now());
        setContentPaused(false);
        setIsGeneratingContent(true);
        setIsContentModalOpen(true);
        setGenerationLogs([]); // Clear previous logs

        // AbortController: closing the console mid-run actually stops the
        // stream instead of letting it churn invisibly in the background
        const controller = new AbortController();
        contentAbortRef.current = controller;

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

        addLog('start', 'Writing your content…');

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
                signal: controller.signal,
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
                                // Teacher-facing feed only: skip transport chatter
                                // and section echoes (the ✓ line already covers them)
                                if (/^Connecting to AI service|^Starting content generation|^Section \d+\/\d+:/.test(data.message)) {
                                    continue;
                                }
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

                                // The stream payload has no DB ids — pull the persisted
                                // questions (with ids) so the console's inline editor can
                                // autosave through PUT /teacher/questions/{id}.
                                api.get(`/teacher/quizzes/${quizData.quiz_id}`, { bypassCache: true })
                                    .then(res => {
                                        const persisted = res.data?.questions || [];
                                        if (!persisted.length) return;
                                        setGeneratedContent(prev => ({
                                            ...prev,
                                            modules: prev.modules.map(m => ({
                                                ...m,
                                                quizzes: m.quizzes.map(q =>
                                                    q.id === quizData.quiz_id
                                                        ? { ...q, questions: persisted, generated: true }
                                                        : q
                                                )
                                            }))
                                        }));
                                    })
                                    .catch(() => {});
                            } else if (data.type === 'info') {
                                // Service-level notices (e.g. coding questions
                                // auto-dropped because no lesson looked like code)
                                addLog('info', data.message, logDelayOffset);
                                logDelayOffset += 30;
                            } else if (data.type === 'complete') {
                                addLog('complete', '✓ All content generated successfully', logDelayOffset + 100);
                                setTimeout(() => {
                                    toast.success('All content generated successfully!');
                                    setIsGeneratingContent(false);
                                    contentAbortRef.current = null;

                                    // Invalidate cache to force fresh data
                                    refreshContent();
                                    invalidateCache('/teacher/lessons/');
                                    invalidateCache('/teacher/quizzes/');

                                    fetchCourse(); // Refresh to show new content
                                }, logDelayOffset + 100);
                            } else if (data.type === 'error') {
                                addLog('error', `✗ Error: ${data.message}`, logDelayOffset);
                                toast.error('Content generation failed');
                                setIsGeneratingContent(false);
                                contentAbortRef.current = null;
                            }
                        } catch (parseErr) {
                            console.error('Failed to parse SSE data:', parseErr);
                        }
                    }
                }
            }
        } catch (err) {
            if (err?.name === 'AbortError') {
                addLog('info', 'Generation stopped by teacher — anything already finished stays saved.', 0);
                toast.info('Content generation stopped');
            } else {
                toast.error('Failed to generate content');
            }
            setIsGeneratingContent(false);
            contentAbortRef.current = null;
        }
    };

    const uploadCurriculumFile = async (file) => {
        if (!file) return;

        // Validate file type (MIME first, extension as fallback — dropped files
        // sometimes arrive with an empty type)
        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!validTypes.includes(file.type) && !/\.(pdf|doc|docx|txt)$/i.test(file.name)) {
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

            const { is_coding, curriculum_file_url } = response.data;

            // Show success message in modal
            setUploadSuccess({
                fileName: file.name,
                isCoding: is_coding,
                message: is_coding ? 'Programming course detected' : 'Non-programming course detected'
            });

            // Flip the modal to the file card immediately — don't wait for the
            // refetch, or the body shows "upload a file" under a success strip
            setCourse(prev => prev ? { ...prev, is_coding, curriculum_file_url } : prev);

            // Invalidate cache and refetch
            refreshContent();
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

    const handleCurriculumUpload = (e) => {
        uploadCurriculumFile(e.target.files[0]);
        e.target.value = ''; // re-choosing the same file must fire change again
    };

    const removeCurriculum = async () => {
        try {
            await api.delete(`/teacher/courses/${course.id}/curriculum`);
            setCourse(prev => ({ ...prev, curriculum_file_url: null, curriculum_text: null }));
            setUploadSuccess(null);
            setConfirmingCurRemoval(false);
            refreshContent();
            toast.success('Curriculum file removed');
        } catch (err) {
            toast.error('Failed to remove curriculum file');
            setConfirmingCurRemoval(false);
        }
    };

    const updateCourseType = async (value) => {
        if (!course || course.is_coding === value) return;
        setCourse(prev => ({ ...prev, is_coding: value }));
        if (!value) setCourseLanguage('');
        try {
            await api.put(`/teacher/courses/${course.id}`, { is_coding: value, language: value ? courseLanguage : null });
            toast.success(value ? 'Programming course mode enabled' : 'Non-programming course mode enabled');
        } catch (err) {
            toast.error('Failed to update course setting');
            setCourse(prev => ({ ...prev, is_coding: !value }));
        }
    };

    const updateCourseLanguage = async (lang) => {
        setCourseLanguage(lang);
        setSavingLanguage(true);
        try {
            await api.put(`/teacher/courses/${course.id}`, { language: lang || null });
            setCourse(prev => ({ ...prev, language: lang }));
            toast.success(lang ? `All generated code will use ${lang === 'cpp' ? 'C++' : lang}` : 'Language cleared');
        } catch (err) {
            toast.error('Failed to update the language');
            setCourseLanguage(course?.language || '');
        } finally {
            setSavingLanguage(false);
        }
    };

if (loading || !course) return (
        <div className="builder-container" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
            <header style={{ marginBottom: '40px' }}>
                <div style={{ marginBottom: '24px', height: '24px', background: 'var(--skeleton-bg)' }} className="w-32 rounded-lg animate-pulse" />

                <div style={{ padding: '24px 28px', marginBottom: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
                        <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
                    </div>
                    <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse ml-auto" />
                </div>

<div style={{ marginBottom: '32px', gap: '24px' }} className="flex flex-col md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                        <div style={{ marginBottom: '12px', background: 'var(--skeleton-bg)' }} className="h-12 w-48 rounded-lg animate-pulse" />
                        <div style={{ background: 'var(--skeleton-bg)' }} className="h-6 w-full rounded-lg animate-pulse" />
                    </div>
                    <div className="flex gap-3">
                        <div style={{ background: 'var(--skeleton-bg)' }} className="h-10 w-24 rounded-xl animate-pulse" />
                        <div style={{ background: 'var(--skeleton-bg)' }} className="h-10 w-24 rounded-xl animate-pulse" />
                        <div style={{ background: 'var(--skeleton-bg)' }} className="h-10 w-24 rounded-xl animate-pulse" />
                    </div>
                </div>
            </header>

            <div style={{ marginBottom: '32px' }}>
                <div style={{ padding: '20px 28px', marginBottom: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="flex gap-3 rounded-2xl">
                    <div style={{ background: 'var(--skeleton-bg)' }} className="h-10 w-32 rounded-xl animate-pulse" />
                    <div className="ml-auto flex gap-2">
                        <div style={{ background: 'var(--skeleton-bg)' }} className="h-10 w-24 rounded-xl animate-pulse" />
                        <div style={{ background: 'var(--skeleton-bg)' }} className="h-10 w-24 rounded-xl animate-pulse" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="rounded-3xl overflow-hidden">
                            <div style={{ marginBottom: '16px', height: '120px', background: 'var(--skeleton-bg)' }} className="animate-pulse rounded-lg" />
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
    const moduleIndex = activeModuleId ? course.modules.findIndex(m => m.id === activeModuleId) : -1;
    const mTotal = activeModuleData ? (activeModuleData.lessons?.length || 0) + (activeModuleData.quizzes?.length || 0) : 0;
    const mPublished = activeModuleData
        ? [...(activeModuleData.lessons || []), ...(activeModuleData.quizzes || [])].filter(i => i.is_published).length
        : 0;
    const mPct = mTotal ? Math.round((mPublished / mTotal) * 100) : 0;
    const mAllPublished = mTotal > 0 && mPublished === mTotal;
    // Stable identity per course-state change: Reorder.Group re-syncs when the
    // values array identity moves, so computing it once per render keeps drags
    // smooth instead of fighting mid-gesture re-renders.
    const moduleItems = useMemo(() => getSortedItems(activeModuleData), [activeModuleData]);

    // "Add lesson / add quiz" — shown at the bottom of a populated module and
    // inside the empty state (one source, two homes).
    const addItemsBlock = activeInput.type ? (
        <form
            className="cd-md-add-form"
            onSubmit={(e) => { e.preventDefault(); handleCreateItem(); }}
        >
            <span className={`cd-md-add-tag ${activeInput.type}`}>{activeInput.type === 'lesson' ? 'LESSON' : 'QUIZ'}</span>
            <input
                autoFocus
                placeholder={`Name the new ${activeInput.type}…`}
                value={activeInput.value}
                onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Escape') setActiveInput({ type: null, value: '' }); }}
            />
            <button type="button" className="cd-md-add-cancel" aria-label="Cancel" onClick={() => setActiveInput({ type: null, value: '' })}>
                <X size={16} />
            </button>
            <button type="submit" className="cd-md-add-create" aria-label="Add" disabled={isSubmittingItem || !activeInput.value.trim()}>
                {isSubmittingItem ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
        </form>
    ) : (
        <>
            <button type="button" className="cd-md-add-tile lesson" onClick={() => setActiveInput({ type: 'lesson', value: '' })}>
                <Plus size={16} />
                New lesson
            </button>
            <button type="button" className="cd-md-add-tile quiz" onClick={() => setActiveInput({ type: 'quiz', value: '' })}>
                <Plus size={16} />
                New quiz
            </button>
        </>
    );

    // What students actually see right now — plain-language presentation of
    // the existing publish states (no new logic, just honesty in the UI).
    const totalItems = course?.modules?.reduce((n, m) => n + (m.lessons?.length || 0) + (m.quizzes?.length || 0), 0) ?? 0;
    const publishedItems = course?.modules?.reduce((n, m) => n + (m.lessons || []).filter(l => l.is_published).length + (m.quizzes || []).filter(q => q.is_published).length, 0) ?? 0;
    const visibilityText = !isPublished
        ? 'Hidden from students until you Go Live.'
        : totalItems === 0 || publishedItems === 0
            ? 'Live — but nothing is published yet. Students see an empty class.'
            : `Students can see ${publishedItems} of ${totalItems} items.`;

    return (
        <div className="builder-container" style={embedded ? { maxWidth: 'none', padding: 0, margin: 0 } : undefined}>
            <header style={{ marginBottom: '40px' }} className="mb-10">
{(!embedded || activeModuleId) && (
                <button type="button" onClick={() => activeModuleId ? openModule(null) : navigate(-1)} className="cd-back">
                    <ChevronLeft size={15} />
                    {activeModuleId ? 'Return to Modules' : 'Exit to Classroom'}
                </button>
                )}

                {/* Compact toolbar (embedded in the class page Content tab) */}
                {!activeModuleId && embedded && (
                    <div className="cd-ctoolbar">
                        <span className={`cd-live ${isPublished ? 'on' : 'off'}`}>
                            {isUpdatingStatus ? <Loader2 size={11} className="animate-spin" /> : (isPublished ? <Check size={11} /> : null)}
                            {isPublished ? 'Live' : 'Draft'}
                        </span>
                        <button type="button" className={`cd-tbtn ${isPublished ? '' : 'cd-tbtn-accent'}`} onClick={handleGoLive} disabled={isUpdatingStatus}>
                            <Rocket size={16} />
                            {isPublished ? 'Unpublish' : 'Go Live'}
                        </button>
                        <span className="cd-tsep" />
                        <button
                            type="button"
                            className={`cd-tbtn ${course.curriculum_file_url ? 'cd-tbtn-cur-ok' : ''}`}
                            onClick={() => setShowCurriculumModal(true)}
                            title={course.curriculum_file_url
                                ? `Curriculum uploaded: ${course.curriculum_file_url.split('/').pop()} — click to view or replace`
                                : 'Upload your curriculum file (PDF or DOC) — AI uses it as the source for generated content'}
                        >
                            {course.curriculum_file_url ? <FileCheck2 size={16} /> : <Upload size={16} />}
                            {course.curriculum_file_url ? 'Curriculum' : 'Upload Curriculum'}
                            {course.curriculum_file_url && <span className="cd-cur-dot" aria-label="Curriculum uploaded" />}
                        </button>
                        <button type="button" className="cd-tbtn cd-tbtn-ai" onClick={() => setIsAiModalOpen(true)} title="Generate modules, lessons, and quizzes from your curriculum — or just from your prompt if no file is uploaded">
                            <Sparkles size={16} />
                            Generate with AI
                        </button>
                        <button type="button" className="cd-tbtn" onClick={handleIndexCourse} disabled={isUpdatingStatus} title="Choose what the student AI tutor can answer from">
                            <BookOpen size={16} />
                            AI Tutor Setup
                        </button>
                        <span className="cd-tspacer" />
                        <button type="button" className={`cd-tbtn ${isReorderMode ? 'cd-tbtn-on' : ''}`} onClick={() => setIsReorderMode(!isReorderMode)}>
                            <GripHorizontal size={16} />
                            {isReorderMode ? 'Done' : 'Reorder'}
                        </button>
                        <button type="button" className={`cd-tbtn ${isBulkDeleteMode ? 'cd-tbtn-danger' : ''}`} onClick={() => { setIsBulkDeleteMode(!isBulkDeleteMode); setSelectedModuleIds(new Set()); }}>
                            <Trash2 size={16} />
                            {isBulkDeleteMode ? 'Cancel' : 'Delete'}
                        </button>
                        {isBulkDeleteMode && selectedModuleIds.size > 0 && (
                            <button type="button" className="cd-tbtn cd-tbtn-danger-solid" onClick={handleBulkDelete} disabled={isDeleting}>
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                Delete {selectedModuleIds.size}
                            </button>
                        )}
                        <button type="button" className="cd-tbtn-primary" onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })}>
                            <Plus size={16} />
                            New Module
                        </button>
                    </div>
                )}
                {!activeModuleId && embedded && (
                    <p className="cd-visibility">{visibilityText}</p>
                )}

                {/* Top Control Bar - Enhanced (standalone route only) */}
                {!activeModuleId && !embedded && (
                    <div style={{ padding: '24px 28px', marginBottom: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }} className="rounded-2xl flex flex-wrap items-center justify-between gap-6">
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
                                style={{ padding: '10px 16px', color: '#7e22ce' }}
                                className="text-xs font-bold uppercase tracking-wider border-none bg-transparent cursor-pointer hover:bg-purple-500/10 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : 'Publish All'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Course title (standalone route only — the embedded class page has its own header) */}
                {!embedded && <div style={{ marginBottom: '32px', gap: '24px' }} className="flex flex-col md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                        {(
                            <>
                                {!embedded && <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em]">Course</span>}
                                <div style={{ marginTop: '12px', gap: '12px' }} className="flex items-center group">
{isTitleEditing ? (
                                        <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid #a78bfa' }} className="flex items-center gap-2 rounded-xl p-2 flex-1">
                                            <input
                                                autoFocus
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCourseTitle(editingTitle);
                                                    if (e.key === 'Escape') setIsTitleEditing(false);
                                                }}
                                                style={{ color: 'var(--text-primary)' }}
                                                className="flex-1 bg-transparent border-none text-4xl font-black outline-none"
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
                                            {!embedded && (
                                            <>
                                            <h1 style={{ color: 'var(--text-primary)' }} className="text-5xl font-black tracking-tight cursor-pointer hover:text-purple-400 transition-colors" onClick={() => {
                                                setEditingTitle(course.title);
                                                setIsTitleEditing(true);
                                            }}>
                                                {course.title}
                                            </h1>
                                            <span className="text-slate-500 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                                            </>
                                    )}
                                        </>
                                    )}
                                </div>
                                {course.description && !embedded && (
                                    <p style={{ color: 'var(--text-secondary)' }} className="text-sm mt-3 max-w-2xl">{course.description}</p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Action Buttons - Redesigned */}
                    {!activeModuleId && (
                        <div className="flex flex-wrap gap-4 md:flex-nowrap md:justify-end">
<button
                                onClick={() => setShowCurriculumModal(true)}
                                style={{ padding: '14px 22px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                                className="text-slate-500 hover:text-brand-text rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all cursor-pointer"
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
                    )}</div>}
            </header>

            <AnimatePresence mode="wait">
                {/* The module view only renders when the id actually resolves
                    in THIS course's payload — bogus/stale ids fall back to the
                    grid and self-clean from the URL */}
                {!activeModuleId || !activeModuleData ? (
<motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                        {/* Control Toolbar (standalone route only) */}
                        {!embedded && <div style={{ padding: '20px 28px', marginBottom: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }} className="flex flex-wrap justify-between items-center gap-4 rounded-2xl">
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
                        </div>}

                        {course.modules.length === 0 && (
                            <div className="cd-empty-build">
                                <span className="cd-empty-build-spark"><Sparkles size={26} /></span>
                                <h3 className="cd-empty-build-title">Build your class content</h3>
                                <p className="cd-empty-build-text">
                                    {course.curriculum_file_url
                                        ? 'Your curriculum is uploaded. Let AI turn it into modules, lessons, and quizzes — or build them yourself.'
                                        : 'Upload your curriculum first so AI can build your course from it — or create modules by hand.'}
                                </p>
                                <div className="cd-empty-build-actions">
                                    <button
                                        type="button"
                                        className={`cd-tbtn cd-tbtn-lg ${course.curriculum_file_url ? 'cd-tbtn-ai' : 'cd-tbtn-accent'}`}
                                        onClick={() => (course.curriculum_file_url ? setIsAiModalOpen(true) : setShowCurriculumModal(true))}
                                    >
                                        {course.curriculum_file_url ? <Sparkles size={16} /> : <FileText size={16} />}
                                        {course.curriculum_file_url ? 'Generate with AI' : 'Upload Curriculum'}
                                    </button>
                                    <button type="button" className="cd-tbtn" onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })}>
                                        <Plus size={16} />
                                        New Module
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 relative">
                            {course.modules.map((module, moduleIndex) => {
                                const total = (module.lessons?.length || 0) + (module.quizzes?.length || 0);
                                const published = [...(module.lessons || []), ...(module.quizzes || [])].filter(i => i.is_published).length;
                                const unpublished = total - published;
                                const statusText = total === 0 ? 'Empty' : (unpublished === 0 ? 'All Published' : `${unpublished} Draft`);
                                const progressPct = total ? Math.round((published / total) * 100) : 0;
                                const isDragging = draggingModuleId === module.id;

                                return (
<motion.div
                                        key={module.id}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.28, delay: Math.min(moduleIndex * 0.06, 0.36), ease: 'easeOut' }}
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
                                                openModule(module.id);
                                            }
                                        }}
                                    >
<div className={`cd-mod ${isBulkDeleteMode && selectedModuleIds.has(module.id) ? 'cd-mod-selected' : ''} ${isReorderMode ? 'cd-mod-reorder' : ''} ${dragOverModuleId === module.id && isReorderMode ? 'cd-mod-drop' : ''}`}>
                                            {isReorderMode && (
                                                <div className="cd-mod-grip"><GripVertical size={15} /></div>
                                            )}
                                            <div className="cd-mod-head">
                                                {isBulkDeleteMode ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedModuleIds.has(module.id)}
                                                        onChange={() => {}}
                                                        className="cd-mod-check"
                                                    />
                                                ) : (
                                                    <span className="cd-mod-index">{String(moduleIndex + 1).padStart(2, '0')}</span>
                                                )}
                                                <h3 className="cd-mod-title">{module.title}</h3>
                                                {!isReorderMode && !isBulkDeleteMode && (
                                                    <span className="cd-mod-arrow"><ArrowRight size={16} /></span>
                                                )}
                                                {!isReorderMode && !isBulkDeleteMode && (
                                                    <div className="cd-mod-actions">
                                                        <button
                                                            type="button"
                                                            title="Edit module"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setModuleModal({ isOpen: true, mode: 'edit', id: module.id, index: moduleIndex, title: module.title });
                                                            }}
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Delete module"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteModal({ isOpen: true, ...makeDeleteConfig('module', module) });
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="cd-mod-progress-row">
                                                <div className="cd-mod-progress"><span style={{ width: `${progressPct}%` }} /></div>
                                                <span className="cd-mod-progress-label">{progressPct}% published</span>
                                            </div>
                                            {total === 0 ? (
                                                <>
                                                    <div className="cd-mod-meta">
                                                        <span className="cd-chip">Empty module</span>
                                                    </div>
                                                    <div className="cd-mod-foot">
                                                        <span className="cd-mod-add-hint">Click to add lessons &amp; quizzes</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="cd-mod-meta">
                                                        <span className="cd-chip"><BookOpen size={14} /> {module.lessons?.length || 0} {module.lessons?.length === 1 ? 'Lesson' : 'Lessons'}</span>
                                                        <span className="cd-chip"><HelpCircle size={14} /> {module.quizzes?.length || 0} {module.quizzes?.length === 1 ? 'Quiz' : 'Quizzes'}</span>
                                                        <span className="cd-chip">{statusText}</span>
                                                    </div>
                                                    <div className="cd-mod-foot">
                                                        <span className="cd-mod-items">{total} items</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
) : (
                    <motion.div key="timeline" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.24, ease: 'easeOut' }}>
                        <div className="cd-md-hero">
                            {mTotal > 0 && <span className="cd-md-num-bg" aria-hidden="true">{String(moduleIndex + 1).padStart(2, '0')}</span>}
                            <div className="cd-md-hero-top">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className="cd-md-kicker-row">
                                        <span className="cd-md-kicker">MODULE {String(moduleIndex + 1).padStart(2, '0')}</span>
                                        {isPublished ? (
                                            <span className="cd-live on" title="This class is live — published content is visible to students.">
                                                <Check size={11} />
                                                Class live
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="cd-tbtn cd-tbtn-accent"
                                                onClick={handleGoLive}
                                                disabled={isUpdatingStatus}
                                                title="Students can't see this class yet. Publish the class and its content now."
                                            >
                                                <Rocket size={14} />
                                                Make class live
                                            </button>
                                        )}
                                    </div>
                                    <h2 className="cd-md-title">{activeModuleData?.title}</h2>
                                    {mTotal > 0 && (
                                        <>
                                            <p className="cd-md-meta">
                                                <b>{activeModuleData?.lessons?.length || 0} {(activeModuleData?.lessons?.length || 0) === 1 ? 'lesson' : 'lessons'}</b>
                                                <span className="cd-md-meta-dot">&middot;</span>
                                                <b>{activeModuleData?.quizzes?.length || 0} {(activeModuleData?.quizzes?.length || 0) === 1 ? 'quiz' : 'quizzes'}</b>
                                                <span className="cd-md-meta-dot">&middot;</span>
                                                {/* One line that names whichever gate is blocking students */}
                                                {!isPublished ? (
                                                    <span className="cd-md-vis warn">students can&apos;t see anything yet &mdash; the class isn&apos;t live</span>
                                                ) : mPublished === mTotal ? (
                                                    <span className="cd-md-vis ok">students can see all {mTotal} items</span>
                                                ) : (
                                                    <span className="cd-md-vis warn">students can see {mPublished} of {mTotal} &mdash; {mTotal - mPublished} still {mTotal - mPublished === 1 ? 'draft' : 'drafts'}</span>
                                                )}
                                            </p>
                                            <div className="cd-md-progress-row">
                                                <div className="cd-md-progress"><span style={{ width: `${mPct}%` }} /></div>
                                                <span className="cd-md-progress-label">{mPct}%</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="cd-md-hero-actions">
                                    {mTotal > 0 && (
                                        <button
                                            type="button"
                                            className={`cd-tbtn ${confirmUnpublishAll ? 'cd-tbtn-danger-solid' : ''}`}
                                            onClick={handleToggleAllItems}
                                            disabled={isUpdatingStatus}
                                            title={mAllPublished ? 'Unpublish every lesson and quiz in this module' : 'Publish every lesson and quiz in this module'}
                                        >
                                            {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                                            {confirmUnpublishAll ? 'Confirm unpublish' : (mAllPublished ? 'Unpublish all' : 'Publish all')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="cd-tbtn"
                                        onClick={() => setModuleModal({ isOpen: true, mode: 'edit', id: activeModuleId, index: moduleIndex, title: activeModuleData?.title || '' })}
                                    >
                                        <Edit3 size={16} />
                                        Rename
                                    </button>
                                    <button
                                        type="button"
                                        className="cd-tbtn cd-tbtn-danger"
                                        onClick={() => setDeleteModal({ isOpen: true, ...makeDeleteConfig('module', activeModuleData) })}
                                    >
                                        <Trash2 size={16} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Add lesson / quiz sit ABOVE the list — reachable without
                            scrolling no matter how long the module grows */}
                        {mTotal > 0 && (
                            <div className="cd-md-add">{addItemsBlock}</div>
                        )}

                        <div className="cd-md-seq-head">
                            <span className="cd-md-seq-label">Content sequence</span>
                            <span className="cd-md-seq-hint">Drag the dots to reorder &mdash; each row keeps its move, publish, and delete controls handy.</span>
                        </div>

                        {mTotal === 0 ? (
                            <div className="cd-empty-build" style={{ padding: '42px 28px' }}>
                                <span className="cd-empty-build-spark"><Layers size={24} /></span>
                                <h3 className="cd-empty-build-title">This module is empty</h3>
                                <p className="cd-empty-build-text">Add your first lesson or quiz below &mdash; students see them once the class is live and they&apos;re published.</p>
                                <div className="cd-md-add cd-md-add-inset">{addItemsBlock}</div>
                            </div>
                        ) : (
                            <>
                                <Reorder.Group axis="y" values={moduleItems} onReorder={handleReorderItems} className="cd-md-list">
                                    {moduleItems.map((item, i) => (
                                        <ModuleItemRow
                                            key={`${item.itemType}-${item.id}`}
                                            item={item}
                                            index={i}
                                            lastIndex={mTotal - 1}
                                            toggling={togglingItemId}
                                            onOpen={(it) => navigate(`/dashboard/teacher/class/${course.class_id}/${it.itemType}/${it.id}`)}
                                            onToggle={toggleItemStatus}
                                            onMove={handleMoveItem}
                                            onDelete={(it) => setDeleteModal({ isOpen: true, ...makeDeleteConfig(it.itemType, it) })}
                                        />
                                    ))}
                                </Reorder.Group>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODALS */}
            <ModuleModal
                open={moduleModal.isOpen}
                mode={moduleModal.mode}
                initialTitle={moduleModal.title}
                moduleNumber={moduleModal.mode === 'edit' ? (moduleModal.index ?? 0) + 1 : (course?.modules?.length || 0) + 1}
                onClose={() => setModuleModal({ isOpen: false, mode: 'create', id: null, title: '' })}
                onSubmit={handleModuleSubmit}
            />

            <DeleteModal isOpen={deleteConfig.isOpen} title={deleteConfig.type} name={deleteConfig.name} items={deleteConfig.items} loading={isDeleting} onClose={() => setDeleteModal({ ...deleteConfig, isOpen: false })} onConfirm={handlePermanentDelete} />
            <AiArchitectModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                onExecute={handleExecuteAI}
                curriculumFile={course?.curriculum_file_url ? course.curriculum_file_url.split('/').pop() : null}
            />
            <CurriculumReviewModal isOpen={isReviewOpen} data={aiResult} expectedParams={structureParams} existingModules={course?.modules?.length || 0} onCancel={() => setIsReviewOpen(false)} onConfirm={handleConfirmAI} onRegenerate={() => { setIsReviewOpen(false); setIsAiModalOpen(true); }} />

            {/* Indexing Stats Modal */}
            <IndexingStatsModal
                courseId={id}
                isOpen={showIndexingStats}
                onClose={() => setShowIndexingStats(false)}
                initialStats={indexingStats}
                onReindexComplete={() => {
                    // Refresh course data after re-indexing
                    fetchCourse();
                    // Reset cached indexing stats to force fresh load on next open
                    setIndexingStats(null);
                }}
            />

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
                    // Closing mid-run actually stops the stream — the honest
                    // version of the old "waste your AI tokens" warning
                    if (isGeneratingContent && contentAbortRef.current) {
                        contentAbortRef.current.abort();
                    }
                    setIsContentModalOpen(false);
                    contentAbortRef.current = null;
                    // A deliberate close while nothing is running clears the
                    // resume state — refresh no longer reopens the studio
                    if (!isGeneratingContent) {
                        localStorage.removeItem(`ai-run:${id}`);
                    }
                    fetchCourse();
                }}
                generatedContent={generatedContent}
                isGenerating={isGeneratingContent}
                logs={generationLogs}
                onContentChange={setGeneratedContent}
                onContinue={handleContinueGeneration}
                onPause={handlePauseGeneration}
                paused={contentPaused}
                startedAt={contentStartedAt}
                courseLanguage={course?.language || ''}
            />

            {/* Curriculum Management Modal */}
            <AnimatePresence>
                {showCurriculumModal && (
                    <div className="cur-overlay">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCurriculumModal(false)}
                            className="cur-backdrop"
                        />
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 10 }}
                            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                            className="cur-modal"
                        >
                            {uploadSuccess && (
                                <div className={`cur-strip ${uploadSuccess.error ? 'err' : 'ok'}`}>
                                    {uploadSuccess.error ? <FileWarning size={16} /> : <CheckCircle size={16} />}
                                    <p>
                                        {uploadSuccess.error ? (
                                            uploadSuccess.error
                                        ) : (
                                            <><b>{uploadSuccess.fileName}</b> uploaded — {uploadSuccess.message}</>
                                        )}
                                    </p>
                                </div>
                            )}
                            <div className="cur-head">
                                <div>
                                    <span className="ed-card-label">Course source</span>
                                    <h2 className="cur-title">Curriculum</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCurriculumModal(false)}
                                    className="cur-close"
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {course.curriculum_file_url ? (
                                <div className="cur-file">
                                    <span className="cur-file-icon"><FileText size={20} /></span>
                                    <div className="cur-file-info">
                                        <p className="cur-file-name">{course.curriculum_file_url.split('/').pop()}</p>
                                        <p className="cur-file-meta">
                                            <span className="cur-ready"><Check size={11} /> Ready</span>
                                            The AI reads this when you Generate with AI
                                        </p>
                                    </div>
                                    <div className="cur-file-actions">
                                        <a
                                            className="cur-file-open"
                                            href={course.curriculum_file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <ExternalLink size={14} /> Open
                                        </a>
                                        {confirmingCurRemoval ? (
                                            <button
                                                type="button"
                                                className="cur-file-remove confirm"
                                                onClick={removeCurriculum}
                                                title="Click again to permanently remove the file"
                                            >
                                                <FileWarning size={14} /> Confirm remove
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="cur-file-remove"
                                                onClick={() => setConfirmingCurRemoval(true)}
                                                onMouseLeave={() => setConfirmingCurRemoval(false)}
                                                title="Remove the curriculum file from this course"
                                            >
                                                <Trash2 size={14} /> Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="cur-lede">
                                    Upload your syllabus, DLL, or course guide — the AI reads it to generate
                                    modules, lessons, and quizzes that match your plan.
                                </p>
                            )}

                            <label
                                className={`cur-drop ${uploadingCurriculum ? 'busy' : ''} ${curDrag ? 'drag' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setCurDrag(true); }}
                                onDragLeave={() => setCurDrag(false)}
                                onDrop={(e) => { e.preventDefault(); setCurDrag(false); if (!uploadingCurriculum) uploadCurriculumFile(e.dataTransfer.files[0]); }}
                            >
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt"
                                    onChange={handleCurriculumUpload}
                                    disabled={uploadingCurriculum}
                                />
                                {uploadingCurriculum ? (
                                    <>
                                        <Loader2 size={22} className="animate-spin" />
                                        <span className="cur-drop-title">Uploading and reading your file…</span>
                                    </>
                                ) : (
                                    <>
                                        <FileUp size={22} />
                                        <span className="cur-drop-title">
                                            {course.curriculum_file_url ? 'Drop a new file or click to replace' : 'Choose a file or drop it here'}
                                        </span>
                                        <span className="cur-drop-sub">PDF · DOC · DOCX · TXT — UP TO 10MB</span>
                                    </>
                                )}
                            </label>

                            <div className="cur-type">
                                <span className="ed-card-label">Course type</span>
                                <div className="cur-type-seg">
                                    <button type="button" className={course.is_coding ? 'on' : ''} onClick={() => updateCourseType(true)}>
                                        <Code2 size={15} />
                                        Programming
                                    </button>
                                    <button type="button" className={!course.is_coding ? 'on' : ''} onClick={() => updateCourseType(false)}>
                                        <BookOpen size={15} />
                                        Non-programming
                                    </button>
                                </div>
                                {course.is_coding && (
                                    <>
                                        <span className="ed-card-label" style={{ marginTop: 10 }}>Programming language</span>
                                        <Dropdown
                                            fullWidth
                                            value={courseLanguage}
                                            onChange={updateCourseLanguage}
                                            placeholder={savingLanguage ? 'Saving…' : 'Choose the language…'}
                                            options={[
                                                { value: 'python', label: 'Python' },
                                                { value: 'java', label: 'Java' },
                                                { value: 'javascript', label: 'JavaScript' },
                                                { value: 'cpp', label: 'C++' },
                                                { value: 'html', label: 'HTML / CSS / JS (web)' },
                                            ]}
                                        />
                                        <p className="cur-type-hint">
                                            Every generated example, challenge, and coding question will use this language.
                                        </p>
                                    </>
                                )}
                                {!course.is_coding && (
                                    <p className="cur-type-hint">
                                        Detected automatically from your upload — switch it here if it guessed wrong.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isEngineering && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="gen-overlay"
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                if (structureAbortRef.current) structureAbortRef.current.abort();
                                setIsEngineering(false);
                                setStructureError(null);
                            }}
                            className="gen-backdrop"
                        />
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 10 }}
                            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                            className="gen-card wide"
                        >
                            <div className="gen-head">
                                <div>
                                    <span className="ed-card-label">Step 1 of 3</span>
                                    <h2 className="gen-title">Building your curriculum…</h2>
                                </div>
                                <button
                                    type="button"
                                    className="gen-close"
                                    title="Stop and close"
                                    onClick={() => {
                                        if (structureAbortRef.current) structureAbortRef.current.abort();
                                        setIsEngineering(false);
                                        setStructureError(null);
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {structureError && (
                                <div className="cur-strip err" style={{ alignItems: 'center' }}>
                                    <p style={{ flex: 1, margin: 0 }}>{structureError}</p>
                                    <button
                                        type="button"
                                        className="gen-btn gen-btn-primary"
                                        style={{ padding: '8px 14px', flex: 'none' }}
                                        onClick={() => {
                                            const last = lastStructureRequestRef.current;
                                            if (last) handleExecuteAI(last.prompt, null, last.params);
                                        }}
                                    >
                                        <Zap size={13} /> Try again
                                    </button>
                                </div>
                            )}

                            {/* Live module preview */}
                            {aiResult?.new_modules && aiResult.new_modules.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                                    {aiResult.new_modules.map((module, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.15 }}
                                            style={{ padding: '13px 16px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-border)' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <Sparkles size={13} style={{ color: 'var(--db-accent-bright)' }} />
                                                <span style={{ fontWeight: 700, color: 'var(--db-text)', fontFamily: 'var(--db-font-display)' }}>{module.title}</span>
                                            </div>
                                            <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {module.items?.map((item, itemIdx) => (
                                                    <span key={itemIdx} className="gen-note">
                                                        {item.type === 'lesson' ? 'Lesson — ' : 'Quiz — '}{item.title}
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {/* Compact activity feed */}
                            <div
                                style={{
                                    padding: '12px 16px', borderRadius: 12, maxHeight: 150, overflowY: 'auto',
                                    background: 'var(--db-card-2)', border: '1px solid var(--db-border)',
                                    display: 'flex', flexDirection: 'column', gap: 6,
                                }}
                            >
                                {aiLogs.slice(-6).map((log, i) => (
                                    <span key={i} className="gen-note">{log}</span>
                                ))}
                                {!structureError && (
                                    <span className="gen-note" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                                        <Loader2 size={12} className="animate-spin" style={{ color: 'var(--db-accent-bright)' }} />
                                        Working…
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}