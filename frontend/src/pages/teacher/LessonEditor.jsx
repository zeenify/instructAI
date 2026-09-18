import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
    ChevronLeft, Trash2, Type, Heading1, Code, Image as ImageIcon,
    Loader2, GripVertical, Upload, Check, X,
    Bold, Italic, Underline, List, Link as LinkIcon,
    Video, ExternalLink, Play, Eraser, ChevronUp, ChevronDown, Bot, Globe,
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
import { CODE_LANGUAGES, cmExtension, resolveLanguage, languageOf, normalizeFiles, composeWebProject, webFileKind, WEB_FILE_TEMPLATES } from '../../utils/codeLanguages';
import HtmlChecksEditor from '../../components/teacher/HtmlChecksEditor';
import { html as htmlExt } from '@codemirror/lang-html';
import { css as cssExt } from '@codemirror/lang-css';
import { javascript as jsExt } from '@codemirror/lang-javascript';

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

/** Rough student reading cost, same heuristic as the module view. */
function lessonMinutes(blocks) {
    if (!Array.isArray(blocks)) return 0;
    let words = 0;
    let videos = 0;
    for (const b of blocks) {
        const t = b?.type === 'text' || b?.type === 'h1' ? String(b?.data?.text || '') : '';
        words += t.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
        if (b?.type === 'video') videos += 1;
    }
    return Math.max(1, Math.round(words / 180) + videos * 3);
}

const BLOCK_TYPES = [
    { type: 'h1', icon: Heading1, label: 'Heading', sub: 'Big section title' },
    { type: 'text', icon: Type, label: 'Text', sub: 'Paragraphs & lists' },
    { type: 'code', icon: Code, label: 'Code', sub: 'Students code here' },
    { type: 'image', icon: ImageIcon, label: 'Image', sub: 'Upload a picture' },
    { type: 'video', icon: Video, label: 'YouTube', sub: 'Embed a video' },
    { type: 'link', icon: LinkIcon, label: 'Link', sub: 'External resource' },
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

    const saveNow = useCallback(async ({ announce = false, publishOverride } = {}) => {
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
            if (announce) toast.error('Could not save the lesson. Try again.');
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
        <span className={`le-status ${saveState}`}>
            {saveState === 'saved' && <Check size={13} />}
            {saveState === 'saving' && <Loader2 size={13} className="animate-spin" />}
            {saveState === 'saved' && savedLabel()}
            {saveState === 'dirty' && 'Unsaved changes'}
            {saveState === 'error' && 'Save failed — press Save to retry'}
        </span>
    );

    if (queryLoading || !loaded) {
        return (
            <div className="le-shell">
                <div className="le-header">
                    <div className="le-header-left">
                        <span className="le-skeleton" style={{ width: 118, height: 38 }} />
                        <div style={{ flex: 1 }}>
                            <span className="le-skeleton" style={{ width: 64, height: 11, display: 'block', marginBottom: 8 }} />
                            <span className="le-skeleton" style={{ width: '70%', height: 24, display: 'block' }} />
                        </div>
                    </div>
                    <span className="le-skeleton" style={{ width: 200, height: 38 }} />
                </div>
                <div className="le-insert-row" style={{ margin: '20px 0' }}>
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

    const minutes = lessonMinutes(blocks);
    // Count the way a teacher would: headings are sections
    const sectionCount = blocks.filter(b => b.type === 'h1').length
        || blocks.filter(b => b.type === 'text').length
        || blocks.length;

    return (
        <div className="le-shell">
            {/* STICKY HEADER — navigation, identity, save state, actions */}
            <div className="le-header">
                <div className="le-header-left">
                    <button type="button" className="cd-back" onClick={goBack} title="Back to the module">
                        <ChevronLeft size={16} />
                        Back to module
                    </button>
                    <div className="le-title-block">
                        <div className="le-kicker-row">
                            <span className="le-kicker">Lesson</span>
                            {isPublished ? (
                                <span className="cd-live on" title="Students can see this lesson">
                                    <Check size={11} />
                                    Published
                                </span>
                            ) : (
                                <span className="le-badge draft" title="Only you can see this lesson — press Publish when ready">
                                    Draft
                                </span>
                            )}
                        </div>
                        <input
                            value={title || ''}
                            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                            className="le-title-input"
                            placeholder="Lesson title…"
                        />
                        <span className="le-meta">
                            {sectionCount} {sectionCount === 1 ? 'section' : 'sections'} &middot; about {minutes} minutes to read
                            <span className="le-meta-sep">&middot;</span>
                            {saveStatus}
                        </span>
                    </div>
                </div>
                <div className="le-header-actions">
                    {!preview && (
                        <>
                            <button
                                type="button"
                                className={`le-ai-chip ${aiEnabled ? 'on' : ''}`}
                                title="When on, the students' AI Tutor can answer questions using this lesson"
                                onClick={() => { setAiEnabled(!aiEnabled); markDirty(); }}
                            >
                                <Bot size={15} />
                                AI tutor: {aiEnabled ? 'On' : 'Off'}
                            </button>
                            {saveState !== 'saved' && (
                                <button type="button" className="db-btn-ghost" onClick={() => saveNow({ announce: true })} disabled={saveState === 'saving'}>
                                    Save
                                </button>
                            )}
                        </>
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
                            className={`db-btn-ghost ${confirmDraft ? 'le-btn-warn' : ''}`}
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
                <div className="le-insert">
                    <span className="le-insert-label">Add a section to this lesson</span>
                    <div className="le-insert-grid">
                        {BLOCK_TYPES.map(({ type, icon: Icon, label, sub }) => (
                            <button key={type} type="button" className="le-insert-card" onClick={() => addBlock(type)}>
                                <span className="le-insert-icon"><Icon size={19} /></span>
                                <span className="le-insert-text">
                                    <span className="le-insert-name">{label}</span>
                                    <span className="le-insert-sub">{sub}</span>
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
                <div className="le-empty">
                    <Heading1 size={26} />
                    <h3>Start your lesson</h3>
                    <p>Pick a section type above — a heading, some text, code, images and more. Everything saves automatically.</p>
                </div>
            ) : (
                <Reorder.Group axis="y" values={blocks} onReorder={handleReorder} className="le-list">
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
            className={`le-block ${dragging ? 'dragging' : ''}`}
            onDragStart={() => { movedRef.current = true; setDragging(true); }}
            onDragEnd={() => {
                setDragging(false);
                setTimeout(() => { movedRef.current = false; }, 150);
            }}
        >
            {/* Hover strip: insert a new block right here, between blocks */}
            <div className="le-strip">
                <button
                    type="button"
                    className={`le-strip-btn ${insertOpen ? 'open' : ''}`}
                    title="Insert a section here"
                    aria-label="Insert a section here"
                    onClick={onInsertHere}
                >
                    <Plus size={14} />
                </button>
            </div>
            {insertOpen && (
                <div className="le-insert-pop">
                    {BLOCK_TYPES.map(({ type, icon: Icon, label }) => (
                        <button key={type} type="button" className="le-insert-chip" onClick={() => onInsert(type)}>
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            )}
            <div className="le-block-tools" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="le-tool le-tool-grip"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                    onPointerDown={(e) => controls.start(e)}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={15} />
                </button>
                <button
                    type="button"
                    className="le-tool"
                    title="Move up"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                >
                    <ChevronUp size={15} />
                </button>
                <button
                    type="button"
                    className="le-tool"
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
                        className="le-tool le-tool-confirm"
                        title="Confirm delete"
                        onClick={() => remove(block.id)}
                    >
                        <Check size={15} />
                    </motion.button>
                ) : (
                    <button
                        type="button"
                        className="le-tool le-tool-del"
                        title="Delete block"
                        onClick={() => setConfirming(true)}
                    >
                        <Trash2 size={15} />
                    </button>
                )}
                {isConfirming && (
                    <button type="button" className="le-tool le-tool-cancel" title="Keep block" onClick={() => setConfirming(false)}>
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
            placeholder="New section heading…"
            value={block.data.text || ''}
            onChange={(e) => {
                update(block.id, { text: e.target.value });
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
            }}
        />
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
                    <div className="le-card-label">
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
                            <p>Paste a YouTube link below</p>
                        </div>
                    )}
                    <input
                        className="le-input"
                        placeholder="YouTube URL…"
                        value={block.data.url || ''}
                        onChange={(e) => update(block.id, { url: e.target.value })}
                    />
                </div>
            );
        }
        case 'link':
            return (
                <div className="le-card le-link-card">
                    <span className="le-link-icon"><ExternalLink size={22} /></span>
                    <div className="le-link-fields">
                        <input
                            placeholder="Resource title…"
                            value={block.data.title || ''}
                            onChange={(e) => update(block.id, { title: e.target.value })}
                        />
                        <input
                            placeholder="https://…"
                            value={block.data.url || ''}
                            onChange={(e) => update(block.id, { url: e.target.value })}
                        />
                    </div>
                </div>
            );
        case 'image':
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
                            <img src={block.data.url} alt="" />
                            <input
                                className="le-input le-caption"
                                placeholder="Add a caption (optional)…"
                                value={block.data.caption || ''}
                                onChange={(e) => update(block.id, { caption: e.target.value })}
                            />
                            <button type="button" className="le-image-remove" title="Remove image" onClick={() => update(block.id, { url: '' })}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ) : (
                        <label className="le-image-pick">
                            <Upload size={26} />
                            <p>Select an image</p>
                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                setUploading();
                                const fd = new FormData(); fd.append('image', file);
                                try {
                                    const res = await api.post('/teacher/lessons/upload-image', fd);
                                    update(block.id, { url: res.data.url });
                                    toast.success('Image uploaded');
                                } catch (err) { toast.error('Upload failed'); }
                                finally { clearUploading(); }
                            }} />
                        </label>
                    )}
                </div>
            );
        case 'code': {
            const langId = resolveLanguage(block.data.language, block.data.code);
            const lang = languageOf(langId);
            return (
                <div className="le-card le-code">
                    <div className="le-code-head">
                        <div className="le-code-options">
                            <div className="le-seg">
                                {['playground', 'challenge'].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => update(block.id, { mode: m })}
                                        className={block.data.mode === m ? 'active' : ''}
                                    >
                                        {m}
                                    </button>
                                ))}
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
                        <button type="button" className="le-template-btn" onClick={() => update(block.id, { code: lang.template })}>
                            + {lang.label} template
                        </button>
                    </div>

                    <MultiFileEditor
                        block={block}
                        langId={langId}
                        update={update}
                    />

                    {block.data.mode === 'challenge' && (
                        <div className="le-challenge">
                            <label>{lang.preview ? 'Text that must appear on the page' : 'Required output'}</label>
                            <input
                                className="le-input le-challenge-input"
                                value={block.data.expected || ''}
                                onChange={(e) => update(block.id, { expected: e.target.value })}
                            />
                            {lang.preview && (
                                <p className="le-challenge-hint">
                                    Quick check — the rendered page must contain this text (case-insensitive). Add structured page checks below for element, attribute and style requirements.
                                </p>
                            )}
                            {lang.preview && (
                                <div style={{ marginTop: 10 }}>
                                    <HtmlChecksEditor
                                        title="Page Checks"
                                        accent="#f87171"
                                        checks={block.data.html_checks || []}
                                        onChange={(next) => update(block.id, { html_checks: next })}
                                        referenceHtml={composeWebProject(normalizeFiles(block.data.files, block.data.code))}
                                    />
                                </div>
                            )}
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
                    {block.data.mode === 'challenge' && block.data.expected && (
                        <p className="le-preview-expected">Your goal: {block.data.expected}</p>
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
                        {f.name}
                        {files.length > 1 && webFileKind(f.name) !== 'html' && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                title="Remove file"
                            >
                                ×
                            </span>
                        )}
                    </button>
                ))}
                {!files.some((f) => webFileKind(f.name) === 'css') && (
                    <button type="button" onClick={() => addFile('css')} className="le-file-add">+ style.css</button>
                )}
                {!files.some((f) => webFileKind(f.name) === 'js') && (
                    <button type="button" onClick={() => addFile('js')} className="le-file-add">+ script.js</button>
                )}
            </div>
            <p className="le-files-hint">
                CSS and JS files are injected into every page automatically — students see them as file tabs.
            </p>
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
