import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
    ChevronLeft, Trash2, Type, Heading1, Code, Image as ImageIcon,
    Loader2, GripVertical, Upload, Check, X,
    Bold, Italic, Underline, List, Link as LinkIcon,
    Video, ExternalLink, Play, Eraser, ChevronUp, ChevronDown, Bot, Globe, Target,
    Eye, Pencil, Plus
} from 'lucide-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { BubbleMenu as BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';

import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import { queryClient } from '../../lib/queryClient';
import { lessonKey, classDetailsKey, useLesson } from '../../queries/classDetails';
import { useTheme } from '../../context/ThemeContext';

import CodeMirror from '@uiw/react-codemirror';
import { CODE_LANGUAGES, cmExtension, resolveLanguage, languageOf, normalizeFiles, composeWebProject, webFileKind, WEB_FILE_TEMPLATES, normalizeChallengeCases } from '../../utils/codeLanguages';
import HtmlChecksEditor from '../../components/teacher/HtmlChecksEditor';
import { html as htmlExt } from '@codemirror/lang-html';
import { css as cssExt } from '@codemirror/lang-css';
import { javascript as jsExt } from '@codemirror/lang-javascript';
import './LessonEditor.css';

function cmExtensionForFile(name, languageId) {
    const kind = webFileKind(name);
    if (kind === 'css') return cssExt();
    if (kind === 'js') return jsExt();
    if (kind === 'html') return htmlExt();
    return cmExtension(languageId);
}

/**
 * TIPTAP CONFIGURATION
 * Defined outside to prevent the "Duplicate extension" warning.
 */
const TIPTAP_EXTENSIONS = [
    StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
    }),
    UnderlineExtension,
    LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'le-link' },
    }),
    Placeholder.configure({
        placeholder: 'Write your lesson here…',
        showOnlyCurrent: false,
    }),
    BubbleMenuPlugin,
];

const BLOCK_TYPES = [
    { type: 'h1', icon: Heading1, label: 'Heading', sub: 'A big bold title' },
    { type: 'text', icon: Type, label: 'Text', sub: 'Paragraphs & lists' },
    { type: 'code', icon: Code, label: 'Code', sub: 'Students code here' },
    { type: 'image', icon: ImageIcon, label: 'Image', sub: 'Upload a picture' },
    { type: 'video', icon: Video, label: 'YouTube', sub: 'Put a video here' },
    { type: 'link', icon: LinkIcon, label: 'Link', sub: 'Link to a website' },
];

export default function LessonEditor() {
    const { classId, id } = useParams();
    const navigate = useNavigate();
    const { theme } = useTheme();

    // Server state (TanStack) seeds the editor exactly once per lesson id — a
    // background refetch must never clobber what the teacher is typing.
    const { data: lessonData, isLoading: queryLoading } = useLesson(id);

    const [title, setTitle] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [isPublished, setIsPublished] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(true);

    // UX States
    const [uploadingBlockId, setUploadingBlockId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [preview, setPreview] = useState(false);
    const [confirmDraft, setConfirmDraft] = useState(false);
    const [insertAt, setInsertAt] = useState(null);
    const [hasEdited, setHasEdited] = useState(false);

    // Save lifecycle: 'saved' | 'dirty' | 'saving' | 'error'
    const [saveState, setSaveState] = useState('saved');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [loaded, setLoaded] = useState(false);

    const seededRef = useRef(false);
    const dirtyRef = useRef(false);
    const timerRef = useRef(null);
    // Latest editing state for the debounced saver (no stale closures)
    const latest = useRef({ title: '', blocks: [], aiEnabled: true, isPublished: false });
    latest.current = { title, blocks, aiEnabled, isPublished };

    // Seed from the server payload once
    useEffect(() => {
        if (lessonData && !seededRef.current) {
            seededRef.current = true;
            setTitle(lessonData.title || '');
            setBlocks(Array.isArray(lessonData.content) ? lessonData.content : []);
            setIsPublished(Boolean(lessonData.is_published));
            setAiEnabled(lessonData.ai_enabled ?? true);
            setLoaded(true);
        }
    }, [lessonData]);

    // New lesson id: forget everything and wait for the fresh payload
    useEffect(() => {
        seededRef.current = false;
        setLoaded(false);
        setSaveState('saved');
        dirtyRef.current = false;
        clearTimeout(timerRef.current);
    }, [id]);

    const saveNow = useCallback(async ({ announce = false, publishOverride, isRetry = false } = {}) => {
        const l = latest.current;
        clearTimeout(timerRef.current);
        timerRef.current = null;
        dirtyRef.current = false;
        setSaveState('saving');
        try {
            const res = await api.put(`/teacher/lessons/${id}`, {
                title: l.title,
                content: l.blocks,
                is_published: publishOverride ?? l.isPublished,
                ai_enabled: l.aiEnabled,
            });
            if (publishOverride !== undefined) setIsPublished(publishOverride);
            setSaveState('saved');
            setLastSavedAt(new Date());
            // Keep the lesson cache consistent without a refetch, and let the
            // class page / course content queries know content changed.
            queryClient.setQueryData(lessonKey(id), res.data);
            invalidateCache(`/teacher/lessons/${id}`);
            invalidateCache('/teacher/courses/');
            queryClient.invalidateQueries({ queryKey: classDetailsKey(classId) });
            if (announce) {
                toast.success(publishOverride === undefined
                    ? 'Lesson saved'
                    : (publishOverride ? 'Published — students can see this lesson' : 'Moved back to draft'));
            }
            // Edits made while this save was in flight: re-arm the autosave
            if (dirtyRef.current) {
                timerRef.current = setTimeout(() => saveNow(), 1600);
            }
        } catch (err) {
            dirtyRef.current = true;
            setSaveState('error');
            if (announce) toast.error('Could not save the lesson. It will retry in a moment.');
            // No manual Save button exists — the editor retries on its own.
            if (!isRetry) {
                timerRef.current = setTimeout(() => saveNow({ publishOverride, isRetry: true }), 5000);
            }
        }
    }, [id, classId]);

    const markDirty = useCallback(() => {
        dirtyRef.current = true;
        setHasEdited(true);
        setSaveState((s) => (s === 'saving' ? 'dirty' : 'dirty'));
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => saveNow(), 1600);
    }, [saveNow]);

    const togglePublish = async () => {
        const next = !latest.current.isPublished;
        // Unpublishing hides the lesson from every student — confirm first
        if (!next && !confirmDraft) {
            setConfirmDraft(true);
            setTimeout(() => setConfirmDraft(false), 3500);
            return;
        }
        setConfirmDraft(false);
        latest.current = { ...latest.current, isPublished: next };
        setIsPublished(next);
        await saveNow({ announce: true, publishOverride: next });
    };

    const goBack = async () => {
        if (dirtyRef.current) await saveNow();
        navigate(`/dashboard/teacher/class/${classId}?module=${lessonData?.module_id}&tab=content`);
    };

    // Tab close / reload safety net while there are unsaved edits
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (dirtyRef.current || saveState === 'saving' || saveState === 'error') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saveState]);

    // Leaving the editor by any route change flushes pending edits (best effort)
    useEffect(() => () => {
        clearTimeout(timerRef.current);
        if (dirtyRef.current) {
            const l = latest.current;
            api.put(`/teacher/lessons/${id}`, {
                title: l.title,
                content: l.blocks,
                is_published: l.isPublished,
                ai_enabled: l.aiEnabled,
            }).catch(() => {});
        }
    }, [id]);

    const addBlock = (type) => {
        const newBlock = {
            id: crypto.randomUUID(),
            type,
            data: type === 'code' ? { mode: 'playground', language: 'java', code: '', expected: '', boilerplate: '' } :
                type === 'image' ? { url: '', caption: '' } :
                type === 'video' ? { url: '', title: '' } :
                type === 'link' ? { url: '', title: '' } : { text: '' }
        };
        setBlocks((prev) => [...prev, newBlock]);
        markDirty();
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
    };

    const addBlockAt = (type, index) => {
        const newBlock = {
            id: crypto.randomUUID(),
            type,
            data: type === 'code' ? { mode: 'playground', language: 'java', code: '', expected: '', boilerplate: '' } :
                type === 'image' ? { url: '', caption: '' } :
                type === 'video' ? { url: '', title: '' } :
                type === 'link' ? { url: '', title: '' } : { text: '' }
        };
        setBlocks((prev) => {
            const next = [...prev];
            next.splice(index, 0, newBlock);
            return next;
        });
        setInsertAt(null);
        markDirty();
    };

    const updateBlock = (blockId, newData) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b));
        markDirty();
    };

    const removeBlock = (blockId) => {
        const idx = blocks.findIndex(b => b.id === blockId);
        const removed = blocks[idx];
        setBlocks(prev => prev.filter(b => b.id !== blockId));
        setConfirmDeleteId(null);
        markDirty();
        if (removed) {
            toast.success('Block removed', {
                action: {
                    label: 'Undo',
                    onClick: () => {
                        setBlocks(cur => {
                            const next = [...cur];
                            next.splice(Math.min(idx, next.length), 0, removed);
                            return next;
                        });
                        markDirty();
                    },
                },
            });
        }
    };

    const moveBlock = (index, dir) => {
        setBlocks(prev => {
            const next = [...prev];
            const to = index + dir;
            if (to < 0 || to >= next.length) return prev;
            [next[index], next[to]] = [next[to], next[index]];
            return next;
        });
        markDirty();
    };

    const handleReorder = (newOrder) => {
        setBlocks(newOrder);
        markDirty();
    };

    // Relative "saved" freshness — re-renders every 30s while saved
    const [, setTick] = useState(0);
    useEffect(() => {
        if (saveState !== 'saved') return undefined;
        const t = setInterval(() => setTick((n) => n + 1), 30000);
        return () => clearInterval(t);
    }, [saveState]);

    const savedLabel = () => {
        if (!lastSavedAt) return 'All changes saved';
        const secs = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
        if (secs < 30) return 'Saved just now';
        if (secs < 3600) return `Saved ${Math.max(1, Math.floor(secs / 60))} min ago`;
        return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    const saveStatus = (
        <span className={`ed-status ${saveState}`}>
            {saveState === 'saved' && <Check size={13} />}
            {saveState === 'saving' && <Loader2 size={13} className="animate-spin" />}
            {saveState === 'saved' && savedLabel()}
            {saveState === 'dirty' && 'Unsaved changes'}
            {saveState === 'error' && 'Save failed — press Save to retry'}
        </span>
    );

    if (queryLoading || !loaded) {
        return (
            <div className="ed-shell">
                <div className="ed-header">
                    <div className="ed-header-left">
                        <span className="le-skeleton" style={{ width: 118, height: 38 }} />
                        <div style={{ flex: 1 }}>
                            <span className="le-skeleton" style={{ width: 64, height: 11, display: 'block', marginBottom: 8 }} />
                            <span className="le-skeleton" style={{ width: '70%', height: 24, display: 'block' }} />
                        </div>
                    </div>
                    <span className="le-skeleton" style={{ width: 200, height: 38 }} />
                </div>
                <div className="ed-insert-row" style={{ margin: '20px 0' }}>
                    {[64, 54, 58, 62, 74, 52].map((w, i) => (
                        <span key={i} className="le-skeleton" style={{ width: w, height: 34 }} />
                    ))}
                </div>
                <span className="le-skeleton" style={{ width: '100%', height: 40, display: 'block', marginBottom: 20 }} />
                <span className="le-skeleton" style={{ width: '92%', height: 80, display: 'block', marginBottom: 20 }} />
                <span className="le-skeleton" style={{ width: '96%', height: 200, display: 'block' }} />
            </div>
        );
    }

    return (
        <div className="ed-shell">
            {/* STICKY HEADER — navigation, identity, save state, actions */}
            <div className="ed-header">
                <div className="ed-header-left">
                    <button type="button" className="ed-back-icon" onClick={goBack} title="Back to module" aria-label="Back to module">
                        <ChevronLeft size={19} />
                    </button>
                    <div className="ed-title-block">
                        <div className="ed-kicker-row">
                            <span className="ed-kicker">Lesson</span>
                            {isPublished ? (
                                <span className="cd-live on" title="Students can see this lesson">
                                    <Check size={11} />
                                    Published
                                </span>
                            ) : (
                                <span className="ed-badge draft" title="Only you can see this lesson — press Publish when ready">
                                    Draft
                                </span>
                            )}
                        </div>
                        <input
                            value={title || ''}
                            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                            className="ed-title-input"
                            placeholder="Lesson title…"
                        />
                        <span className="ed-meta">
                            {saveStatus}
                        </span>
                    </div>
                </div>
                <div className="ed-header-actions">
                    {!preview && (
                        <button
                            type="button"
                            className={`le-ai-chip ${aiEnabled ? 'on' : ''}`}
                            title="When on, the students' AI Tutor can answer questions using this lesson"
                            onClick={() => { setAiEnabled(!aiEnabled); markDirty(); }}
                        >
                            <Bot size={17} />
                            <span className="le-ai-chip-label">
                                AI Tutor
                                <span className="le-ai-chip-state">{aiEnabled ? 'On for students' : 'Off'}</span>
                            </span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="db-btn-ghost"
                        onClick={() => setPreview(!preview)}
                        title="See the lesson the way students read it"
                    >
                        {preview ? <Pencil size={15} /> : <Eye size={15} />}
                        {preview ? 'Back to editing' : 'Preview'}
                    </button>
                    {!preview && (isPublished ? (
                        <button
                            type="button"
                            className={`db-btn-ghost ${confirmDraft ? 'ed-btn-warn' : ''}`}
                            onClick={togglePublish}
                            disabled={saveState === 'saving'}
                            title="Hides this lesson from students"
                        >
                            {confirmDraft ? 'Students will lose access — confirm' : 'Return to draft'}
                        </button>
                    ) : (
                        <button type="button" className="db-btn-primary" onClick={togglePublish} disabled={saveState === 'saving'}>
                            {saveState === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
                            Publish
                        </button>
                    ))}
                </div>
            </div>

            {!preview && !hasEdited && (
                <p className="le-hint">Click any text to edit it — everything saves automatically as you type.</p>
            )}

            {/* SECTION INSERTER — one obvious palette: what it adds, in plain words */}
            {!preview && (
                <div className="ed-insert">
                    <span className="ed-insert-label">Add content to this lesson</span>
                    <div className="ed-insert-grid">
                        {BLOCK_TYPES.map(({ type, icon: Icon, label, sub }) => (
                            <button key={type} type="button" className="ed-insert-card" onClick={() => addBlock(type)}>
                                <span className="ed-insert-icon"><Icon size={19} /></span>
                                <span className="ed-insert-text">
                                    <span className="ed-insert-name">{label}</span>
                                    <span className="ed-insert-sub">{sub}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* CANVAS */}
            {preview ? (
                <div className="le-preview">
                    <h1 className="le-preview-title">{title}</h1>
                    {blocks.map((block) => (
                        <PreviewBlock key={block.id} block={block} />
                    ))}
                </div>
            ) : blocks.length === 0 ? (
                <div className="ed-empty">
                    <Heading1 size={26} />
                    <h3>Start your lesson</h3>
                    <p>Pick a part type above — a heading, some text, code, images and more. Everything saves automatically.</p>
                </div>
            ) : (
                <Reorder.Group axis="y" values={blocks} onReorder={handleReorder} className="ed-list">
                    {blocks.map((block, i) => (
                        <LessonBlock
                            key={block.id}
                            block={block}
                            index={i}
                            lastIndex={blocks.length - 1}
                            onMove={moveBlock}
                            update={updateBlock}
                            remove={removeBlock}
                            isConfirming={confirmDeleteId === block.id}
                            setConfirming={(v) => setConfirmDeleteId(v ? block.id : null)}
                            isUploading={uploadingBlockId === block.id}
                            setUploading={() => setUploadingBlockId(block.id)}
                            clearUploading={() => setUploadingBlockId(null)}
                            insertOpen={insertAt === i}
                            onInsertHere={() => setInsertAt(i === insertAt ? null : i)}
                            onInsert={(type) => addBlockAt(type, i)}
                        />
                    ))}
                </Reorder.Group>
            )}

        </div>
    );
}

/** One draggable block with its hover toolbar and an insert-here strip. */
function LessonBlock({ block, index, lastIndex, onMove, update, remove, isConfirming, setConfirming, isUploading, setUploading, clearUploading, insertOpen, onInsertHere, onInsert }) {
    const controls = useDragControls();
    const [dragging, setDragging] = useState(false);
    const movedRef = useRef(false);

    return (
        <Reorder.Item
            value={block}
            dragListener={false}
            dragControls={controls}
            className={`ed-block ${dragging ? 'dragging' : ''}`}
            onDragStart={() => { movedRef.current = true; setDragging(true); }}
            onDragEnd={() => {
                setDragging(false);
                setTimeout(() => { movedRef.current = false; }, 150);
            }}
        >
            {/* Hover strip: insert a new section right here, between blocks */}
            <div className="ed-strip">
                <button
                    type="button"
                    className={`ed-strip-btn ${insertOpen ? 'open' : ''}`}
                    title="Insert a part here"
                    aria-label="Insert a part here"
                    onClick={onInsertHere}
                >
                    <Plus size={13} />
                    Insert here
                </button>
            </div>
            {insertOpen && (
                <div className="ed-insert-pop">
                    {BLOCK_TYPES.map(({ type, icon: Icon, label }) => (
                        <button key={type} type="button" className="ed-insert-chip" onClick={() => onInsert(type)}>
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            )}
            <div className="ed-block-tools" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="ed-tool ed-tool-grip"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                    onPointerDown={(e) => controls.start(e)}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={15} />
                </button>
                <button
                    type="button"
                    className="ed-tool"
                    title="Move up"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                >
                    <ChevronUp size={15} />
                </button>
                <button
                    type="button"
                    className="ed-tool"
                    title="Move down"
                    aria-label="Move down"
                    disabled={index === lastIndex}
                    onClick={() => onMove(index, 1)}
                >
                    <ChevronDown size={15} />
                </button>
                {isConfirming ? (
                    <motion.button
                        type="button"
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="ed-tool ed-tool-confirm"
                        title="Confirm delete"
                        onClick={() => remove(block.id)}
                    >
                        <Check size={15} />
                    </motion.button>
                ) : (
                    <button
                        type="button"
                        className="ed-tool ed-tool-del"
                        title="Delete block"
                        onClick={() => setConfirming(true)}
                    >
                        <Trash2 size={15} />
                    </button>
                )}
                {isConfirming && (
                    <button type="button" className="ed-tool ed-tool-cancel" title="Keep block" onClick={() => setConfirming(false)}>
                        <X size={15} />
                    </button>
                )}
            </div>
            <BlockElement
                block={block}
                update={update}
                isUploading={isUploading}
                setUploading={setUploading}
                clearUploading={clearUploading}
            />
        </Reorder.Item>
    );
}

/** Auto-sizing section heading — resizes on mount AND on every change, so a
    one-line heading never leaves a phantom second row of blank space. */
function H1Block({ block, update }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [block.data.text]);

    return (
        <textarea
            ref={ref}
            className="le-h1"
            placeholder="Part title…"
            value={block.data.text || ''}
            onChange={(e) => {
                update(block.id, { text: e.target.value });
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
            }}
        />
    );
}

/** Image block: click or drag-and-drop to upload, replace or remove. */
function ImageBlock({ block, update, isUploading, setUploading, clearUploading }) {
    const [dragOver, setDragOver] = useState(false);
    const replaceRef = useRef(null);

    const uploadFile = async (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file (JPG, PNG, GIF…)');
            return;
        }
        setUploading();
        const fd = new FormData();
        fd.append('image', file);
        try {
            const res = await api.post('/teacher/lessons/upload-image', fd);
            update(block.id, { url: res.data.url });
            toast.success('Image uploaded');
        } catch (err) {
            toast.error('Upload failed');
        } finally {
            clearUploading();
        }
    };

    return (
        <div className="le-card le-image-card">
            <AnimatePresence>
                {isUploading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="le-upload-overlay">
                        <Loader2 className="animate-spin" size={28} />
                        <span>Uploading image…</span>
                    </motion.div>
                )}
            </AnimatePresence>
            {block.data.url ? (
                <div className="le-image-body">
                    <img src={block.data.url} alt={block.data.caption || ''} />
                    <div className="le-image-actions">
                        <button type="button" className="le-image-btn" onClick={() => replaceRef.current?.click()}>
                            <Upload size={13} />
                            Replace
                        </button>
                        <button type="button" className="le-image-btn le-image-btn-danger" onClick={() => update(block.id, { url: '' })}>
                            <Trash2 size={13} />
                            Remove
                        </button>
                    </div>
                    <input
                        className="le-input le-caption"
                        placeholder="Add a caption (optional)…"
                        value={block.data.caption || ''}
                        onChange={(e) => update(block.id, { caption: e.target.value })}
                    />
                    <input
                        ref={replaceRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => { uploadFile(e.target.files[0]); e.target.value = ''; }}
                    />
                </div>
            ) : (
                <label
                    className={`le-image-pick ${dragOver ? 'dragover' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        uploadFile(e.dataTransfer.files?.[0]);
                    }}
                >
                    <Upload size={26} />
                    <p className="le-image-pick-title">{dragOver ? 'Drop to upload' : 'Click or drag an image here'}</p>
                    <span className="le-image-pick-sub">JPG, PNG or GIF — stored with your lesson</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => { uploadFile(e.target.files[0]); e.target.value = ''; }} />
                </label>
            )}
        </div>
    );
}

function BlockElement({ block, update, isUploading, setUploading, clearUploading }) {
    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url?.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    switch (block.type) {
        case 'h1':
            return <H1Block block={block} update={update} />;
        case 'text':
            return (
                <RichTextEditor
                    content={block.data.text || ''}
                    onChange={(html) => update(block.id, { text: html })}
                />
            );
        case 'video': {
            const ytId = getYoutubeId(block.data.url);
            return (
                <div className="le-card">
                    <div className="ed-card-label">
                        <Video size={16} />
                        Video instruction
                    </div>
                    {ytId ? (
                        <div className="le-video-frame">
                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen title={block.data.title || 'YouTube video'} />
                        </div>
                    ) : (
                        <div className="le-video-empty">
                            <Play size={34} />
                            <p>Paste a YouTube link below — the video appears here</p>
                        </div>
                    )}
                    <input
                        className="le-input"
                        placeholder="Paste a youtube.com link…"
                        value={block.data.url || ''}
                        onChange={(e) => update(block.id, { url: e.target.value })}
                    />
                    {ytId && (
                        <a className="le-yt-check" href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noreferrer">
                            <ExternalLink size={13} />
                            Open on YouTube to check it
                        </a>
                    )}
                </div>
            );
        }
        case 'link':
            return (
                <div className="le-card le-link-card">
                    <span className="le-link-icon"><ExternalLink size={22} /></span>
                    <div className="le-link-fields">
                        <input
                            placeholder="Resource title… e.g. Python official tutorial"
                            value={block.data.title || ''}
                            onChange={(e) => update(block.id, { title: e.target.value })}
                        />
                        <input
                            placeholder="Paste the website link… https://…"
                            value={block.data.url || ''}
                            onChange={(e) => update(block.id, { url: e.target.value })}
                        />
                    </div>
                    {block.data.url && (
                        <a className="le-link-visit" href={block.data.url} target="_blank" rel="noreferrer" title="Open the link in a new tab">
                            <ExternalLink size={13} />
                            Visit
                        </a>
                    )}
                </div>
            );
        case 'image':
            return (
                <ImageBlock
                    block={block}
                    update={update}
                    isUploading={isUploading}
                    setUploading={setUploading}
                    clearUploading={clearUploading}
                />
            );
        case 'code': {
            const langId = resolveLanguage(block.data.language, block.data.code);
            const lang = languageOf(langId);
            const isChallenge = block.data.mode === 'challenge';
            const storedCases = normalizeChallengeCases(block.data.test_cases, block.data.expected);
            // A brand-new challenge starts with one blank case row
            const cases = storedCases.length > 0 ? storedCases : [{ id: 'new', input: '', expected_output: '' }];

            const setCases = (next) => {
                const withIds = next.map((c) => ({
                    ...c,
                    id: !c.id || c.id === 'new' ? crypto.randomUUID() : c.id,
                }));
                update(block.id, {
                    test_cases: withIds,
                    // keep the legacy quick-check field pointing at the first case
                    expected: withIds[0]?.expected_output ?? '',
                });
            };
            const updateCase = (i, patch) => setCases(cases.map((c, j) => (j === i ? { ...c, ...patch } : c)));
            const addCase = () => setCases([...cases, { input: '', expected_output: '' }]);
            const removeCase = (i) => {
                if (cases.length <= 1) return;
                setCases(cases.filter((_, j) => j !== i));
            };

            return (
                <div className="le-card le-code">
                    <div className="le-code-row">
                        <span className="ed-card-label">What students do here</span>
                        <div className="le-mode-grid">
                            <button
                                type="button"
                                className={`le-mode-card ${!isChallenge ? 'active' : ''}`}
                                onClick={() => update(block.id, { mode: 'playground' })}
                            >
                                <span className="le-mode-name"><Play size={14} /> Practice</span>
                                <span className="le-mode-sub">Students experiment freely and run their code</span>
                            </button>
                            <button
                                type="button"
                                className={`le-mode-card ${isChallenge ? 'active' : ''}`}
                                onClick={() => update(block.id, { mode: 'challenge' })}
                            >
                                <span className="le-mode-name"><Target size={14} /> Challenge</span>
                                <span className="le-mode-sub">Students must reach a goal you define</span>
                            </button>
                        </div>
                    </div>

                    <div className="le-code-row">
                        <div className="le-code-lang-head">
                            <span className="ed-card-label">Language</span>
                            <button
                                type="button"
                                className="le-template-btn"
                                title="Puts example code in the editor — it replaces what is written now"
                                onClick={() => update(block.id, { code: lang.template })}
                            >
                                + Add example code
                            </button>
                        </div>
                        <div className="le-seg le-seg-langs">
                            {Object.values(CODE_LANGUAGES).map(l => (
                                <button
                                    key={l.id}
                                    type="button"
                                    onClick={() => update(block.id, { language: l.id })}
                                    title={l.preview ? 'Runs in the browser preview' : 'Runs on the execution engine'}
                                    className={langId === l.id ? 'active' : ''}
                                >
                                    <span className="le-lang-dot" style={{ background: l.color, boxShadow: langId === l.id ? `0 0 6px ${l.color}` : 'none' }} />
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <MultiFileEditor
                        block={block}
                        langId={langId}
                        update={update}
                    />

                    {isChallenge && lang.preview && (
                        <div className="le-challenge">
                            <label>Challenge goal — what students must produce</label>
                            <input
                                className="le-input le-challenge-input"
                                placeholder="e.g. My Favorite Hobby"
                                value={block.data.expected || ''}
                                onChange={(e) => update(block.id, { expected: e.target.value })}
                            />
                            <p className="le-challenge-hint">
                                Quick check — the page must show this text. Capital or small letters both count. You can add more checks below.
                            </p>
                            <div style={{ marginTop: 10 }}>
                                <HtmlChecksEditor
                                    title="Page Checks"
                                    accent="#8b7bff"
                                    checks={block.data.html_checks || []}
                                    onChange={(next) => update(block.id, { html_checks: next })}
                                    referenceHtml={composeWebProject(normalizeFiles(block.data.files, block.data.code))}
                                />
                            </div>
                        </div>
                    )}

                    {isChallenge && !lang.preview && (
                        <div className="le-tc">
                            <div className="le-tc-head">
                                <span className="ed-card-label">Test cases</span>
                                <button type="button" className="le-tc-add" onClick={addCase}>
                                    <Plus size={13} />
                                    Add a case
                                </button>
                            </div>
                            <p className="le-tc-hint">
                                Every case runs the student's code with the input, and the console output must match exactly. The challenge is solved when all cases pass.
                            </p>
                            {cases.map((c, i) => (
                                <div className="le-tc-row" key={c.id}>
                                    <span className="le-tc-num">#{i + 1}</span>
                                    <div className="le-tc-field">
                                        <span className="le-tc-field-label">Input the program reads</span>
                                        <textarea
                                            className="le-tc-textarea"
                                            rows={2}
                                            value={c.input}
                                            placeholder="Leave empty if the program reads nothing"
                                            onChange={(e) => updateCase(i, { input: e.target.value })}
                                        />
                                    </div>
                                    <div className="le-tc-field">
                                        <span className="le-tc-field-label">Expected console output</span>
                                        <textarea
                                            className="le-tc-textarea"
                                            rows={2}
                                            value={c.expected_output}
                                            placeholder="Exact console output"
                                            onChange={(e) => updateCase(i, { expected_output: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="le-tc-remove"
                                        title={cases.length <= 1 ? 'A challenge needs at least one case' : 'Remove this case'}
                                        disabled={cases.length <= 1}
                                        onClick={() => removeCase(i)}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        default: return null;
    }
}

/** Static read-only rendering of one block — used by Preview mode. */
function PreviewBlock({ block }) {
    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url?.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    switch (block.type) {
        case 'h1':
            return <h2 className="le-preview-h1">{block.data.text}</h2>;
        case 'text':
            return <div className="le-prose le-preview-text" dangerouslySetInnerHTML={{ __html: block.data.text || '' }} />;
        case 'image':
            return block.data.url ? (
                <figure className="le-preview-figure">
                    <img src={block.data.url} alt={block.data.caption || ''} />
                    {block.data.caption && <figcaption>{block.data.caption}</figcaption>}
                </figure>
            ) : null;
        case 'video': {
            const ytId = getYoutubeId(block.data.url);
            return ytId ? (
                <div className="le-video-frame">
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen title={block.data.title || 'YouTube video'} />
                </div>
            ) : null;
        }
        case 'link':
            return block.data.url ? (
                <a className="le-preview-link" href={block.data.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    {block.data.title || block.data.url}
                </a>
            ) : null;
        case 'code': {
            const files = normalizeFiles(block.data.files, block.data.code || '');
            const cases = normalizeChallengeCases(block.data.test_cases, block.data.expected);
            return (
                <div className="le-preview-code">
                    <div className="le-preview-code-head">
                        {block.data.mode === 'challenge' ? 'Code challenge' : 'Code playground'} &middot; {block.data.language}
                    </div>
                    {files.map((f) => (
                        <div key={f.name}>
                            <span className="le-preview-file">{f.name}</span>
                            <pre>{f.content}</pre>
                        </div>
                    ))}
                    {block.data.mode === 'challenge' && (
                        <div className="le-preview-goals">
                            {cases.length > 0 ? (
                                cases.map((c, i) => (
                                    <p key={c.id || i} className="le-preview-expected">
                                        {`Case ${i + 1}${c.input ? ` (input: ${c.input})` : ''}: expected output "${c.expected_output}"`}
                                    </p>
                                ))
                            ) : (
                                <p className="le-preview-expected">Your goal: {block.data.expected}</p>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        default: return null;
    }
}

function RichTextEditor({ content, onChange }) {
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [isTextSelected, setIsTextSelected] = useState(false);

    const editor = useEditor({
        extensions: TIPTAP_EXTENSIONS,
        content: content,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        onSelectionUpdate: ({ editor }) => {
            setIsTextSelected(!editor.state.selection.empty);
        },
    });

    if (!editor) return null;

    const setLink = () => {
        if (linkUrl) {
            editor.chain().focus().setLink({ href: linkUrl }).run();
            setLinkUrl('');
            setShowLinkInput(false);
        } else {
            editor.chain().focus().unsetLink().run();
            setShowLinkInput(false);
        }
    };

    const menuBtn = (active) => `le-menu-btn ${active ? 'active' : ''}`;

    return (
        <div className="le-text">
            {isTextSelected && (
                <div className="le-menu">
                    <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={menuBtn(editor.isActive('bold'))}><Bold size={15} /></button>
                    <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={menuBtn(editor.isActive('italic'))}><Italic size={15} /></button>
                    <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={menuBtn(editor.isActive('underline'))}><Underline size={15} /></button>
                    <span className="le-menu-sep" />
                    <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={menuBtn(editor.isActive('bulletList'))}><List size={15} /></button>
                    <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={menuBtn(false)} title="Clear formatting"><Eraser size={15} /></button>
                    <span className="le-menu-sep" />
                    {!showLinkInput ? (
                        <button type="button" onClick={() => { setLinkUrl(editor.getAttributes('link').href || ''); setShowLinkInput(true); }} className={menuBtn(editor.isActive('link'))}><LinkIcon size={15} /></button>
                    ) : (
                        <div className="le-menu-link">
                            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL…" onKeyDown={(e) => e.key === 'Enter' && setLink()} />
                            <button type="button" onClick={setLink}><Check size={13} /></button>
                            <button type="button" onClick={() => setShowLinkInput(false)}><X size={13} /></button>
                        </div>
                    )}
                </div>
            )}
            <EditorContent editor={editor} className="le-prose" />
        </div>
    );
}

// Multi-file authoring for web blocks: index.html plus any number of
// .css/.js files. Files are stored on block.data.files; block.data.code
// stays synced to the html file for backward compatibility.
function MultiFileEditor({ block, langId, update }) {
    const { theme } = useTheme();
    const [activeIdx, setActiveIdx] = useState(0);
    const isHtml = langId === 'html';
    const files = normalizeFiles(block.data.files, block.data.code || '');
    const safeIdx = Math.min(activeIdx, files.length - 1);
    const active = files[safeIdx] || files[0];

    const setFiles = (next) => {
        const htmlFile = next.find((f) => webFileKind(f.name) === 'html') || next[0];
        update(block.id, { files: next, code: htmlFile.content });
    };

    const updateContent = (value) => {
        setFiles(files.map((f, i) => (i === safeIdx ? { ...f, content: value } : f)));
    };

    const addFile = (kind) => {
        const tpl = WEB_FILE_TEMPLATES[kind];
        let name = tpl.name;
        let n = 2;
        while (files.some((f) => f.name === name)) {
            name = tpl.name.replace(/(\.[a-z]+)$/i, `-${n}$1`);
            n++;
        }
        setFiles([...files, { name, content: tpl.content }]);
        setActiveIdx(files.length);
    };

    const removeFile = (idx) => {
        if (webFileKind(files[idx].name) === 'html') return; // the html entry page is required
        const next = files.filter((_, i) => i !== idx);
        setFiles(next);
        setActiveIdx(Math.max(0, Math.min(safeIdx, next.length - 1)));
    };

    if (!isHtml) {
        return (
            <div className="le-cm">
                <CodeMirror value={block.data.code || ''} height="320px" theme={theme === 'dark' ? 'dark' : 'light'} extensions={[cmExtension(langId)]} onChange={(val) => update(block.id, { code: val })} options={{ fontSize: 16 }} />
            </div>
        );
    }

    const kindColor = (name) => (webFileKind(name) === 'css' ? '#7dd3fc' : webFileKind(name) === 'js' ? '#fbbf24' : '#fb923c');
    const hasCss = files.some((f) => webFileKind(f.name) === 'css');
    const hasJs = files.some((f) => webFileKind(f.name) === 'js');

    return (
        <div>
            <div className="le-files">
                {files.map((f, i) => (
                    <button
                        key={f.name + i}
                        type="button"
                        onClick={() => setActiveIdx(i)}
                        className={`le-file-tab ${safeIdx === i ? 'active' : ''}`}
                        style={{ '--file-color': kindColor(f.name) }}
                    >
                        {webFileKind(f.name) === 'html' && <span className="le-file-main">main</span>}
                        {f.name}
                        {files.length > 1 && webFileKind(f.name) !== 'html' && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                title="Remove this file"
                            >
                                ×
                            </span>
                        )}
                    </button>
                ))}
                {/* Optional files show as ghost slots until added — the whole
                    HTML/CSS/JS model is visible at a glance */}
                {!hasCss && (
                    <button
                        type="button"
                        className="le-file-slot"
                        onClick={() => addFile('css')}
                        title="Adds an optional style.css file to this project"
                    >
                        <Plus size={12} />
                        style.css
                    </button>
                )}
                {!hasJs && (
                    <button
                        type="button"
                        className="le-file-slot"
                        onClick={() => addFile('js')}
                        title="Adds an optional script.js file to this project"
                    >
                        <Plus size={12} />
                        script.js
                    </button>
                )}
            </div>
            <div className="le-cm">
                <CodeMirror
                    value={active ? active.content : ''}
                    height="320px"
                    theme={theme === 'dark' ? 'dark' : 'light'}
                    extensions={[cmExtensionForFile(active ? active.name : 'index.html', langId)]}
                    onChange={updateContent}
                    options={{ fontSize: 16 }}
                />
            </div>
        </div>
    );
}
