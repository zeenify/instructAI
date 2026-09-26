import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
    Loader2,
    Code as CodeIcon,
    CheckCircle2,
    ExternalLink,
    Play,
    Video as VideoIcon
} from 'lucide-react';
import CodeIDE from './CodeIDE';
import AITutor from '../../components/student/AITutor';
import { toast } from 'sonner';

export default function LessonRenderer({ lessonId, onProgressUpdate, isCompleted }) {
    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [solvedChallenges, setSolvedChallenges] = useState([]);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [classId, setClassId] = useState(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setSolvedChallenges([]);

        // bypassCache: is_solved flags change as the student solves challenges,
        // so a 5-minute-old cached copy would show stale progress.
        api.get(`/student/lessons/${lessonId}`, { bypassCache: true }).then(res => {
            if (!isMounted) return;

            const lessonData = res.data.lesson;
            const saved = res.data.previous_submissions;

            const hydratedContent = (lessonData.content || []).map(block => {
                if (block.type === 'code') {
                    const submission = saved.find(s => s.block_id === block.id);
                    if (submission) {
                        return { ...block, data: { ...block.data, code: submission.code, is_solved: true } };
                    }
                }
                return block;
            });

            setLesson({ ...lessonData, content: hydratedContent });
            setAiEnabled(lessonData.ai_enabled || false);
            setClassId(res.data.class_id);

            const alreadySolvedIds = saved.map(s => s.block_id);
            setSolvedChallenges(alreadySolvedIds);

            setLoading(false);

            const requiredIds = hydratedContent.filter(b => b.type === 'code' && b.data.mode === 'challenge');

            onProgressUpdate(requiredIds.length === 0 || isCompleted || alreadySolvedIds.length >= requiredIds.length);
        });
        return () => { isMounted = false; };
    }, [lessonId, isCompleted]);

    const handleBlockSolved = (blockId) => {
        if (solvedChallenges.includes(blockId)) return;

        const newSolved = [...solvedChallenges, blockId];
        setSolvedChallenges(newSolved);

        const totalRequired = lesson.content.filter(b => b.type === 'code' && b.data.mode === 'challenge').length;

        if (newSolved.length >= totalRequired) {
            onProgressUpdate(true);
            toast.success("All lesson challenges solved!");
        }
    };

    if (loading) return <LessonSkeleton />;

    return (
        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '48px', animationName: 'fadeIn', animationDuration: '0.8s', maxWidth: '100%' }}>
            {/* HEADER — large serif title on canvas, no box */}
            <header style={{ paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>Lesson</span>
                    {isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '12.5px', fontWeight: 600 }}>
                            <CheckCircle2 size={14}/> Completed
                        </div>
                    )}
                </div>
                <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '36px', fontWeight: 600, color: 'var(--text-primary)', margin: '0', lineHeight: '1.2', letterSpacing: '-0.01em' }}>{lesson.title}</h1>
            </header>

            {/* CONTENT BLOCKS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                {lesson.content?.map((block) => (
                    <div key={block.id}>
                        {block.type === 'code' ? (
                            <CodeIDE
                                block={block}
                                lessonId={lessonId}
                                onSolve={() => handleBlockSolved(block.id)}
                            />
                        ) : (
                            renderStandardBlock(block)
                        )}
                    </div>
                ))}
            </div>

            {lesson && classId && (
                <AITutor
                    classId={classId}
                    lessonId={lessonId}
                    aiEnabled={aiEnabled}
                    contextItem={lesson}
                    lessonContent={JSON.stringify(lesson.content)}
                />
            )}
        </div>
    );
}

function renderStandardBlock(block) {
    const { type, data } = block;

    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url?.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    switch (type) {
        case 'h1':
            return <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 22px 0', letterSpacing: '-0.01em', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>{data.text}</h2>;

        case 'text':
            return (
                <div
                    style={{ fontSize: '17px', color: 'var(--text-primary)', lineHeight: '1.85', margin: '0' }}
                    className="lesson-prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: data.text }}
                />
            );

        case 'image':
            return (
                <figure style={{ margin: '32px 0', textAlign: 'center' }}>
                    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <img src={data.url} style={{ width: '100%', display: 'block' }} alt={data.caption} />
                    </div>
                    {data.caption && (
                        <figcaption style={{ marginTop: '14px', fontSize: '13.5px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                            {data.caption}
                        </figcaption>
                    )}
                </figure>
            );

        case 'video':
            const ytId = getYoutubeId(data.url);
            return (
                <div style={{ margin: '32px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                        <Play size={16} fill="currentColor" />
                        <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 0, margin: '0' }}>Video demonstration</span>
                    </div>
                    {ytId ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                            <iframe
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                src={`https://www.youtube.com/embed/${ytId}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <div style={{ padding: '40px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                            <VideoIcon size={40} style={{ color: 'var(--text-tertiary)' }} />
                            <div>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{data.title || "Video Suggestion"}</p>
                                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0' }}>{data.description || "Teacher will add video link"}</p>
                            </div>
                        </div>
                    )}
                </div>
            );

        case 'link':
            return (
                <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', borderRadius: '16px', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', textDecoration: 'none', transition: 'all 0.2s', gap: '20px', cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-border)';
                    }}
                >
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fffdf7', flexShrink: 0 }}>
                        <ExternalLink size={26} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{data.title || 'View Resource'}</h4>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{data.url}</p>
                    </div>
                </a>
            );

        default:
            return null;
    }
}

function LessonSkeleton() {
    return (
        <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '32px', animation: 'pulse 2s infinite' }}>
            <div style={{ height: '40px', background: 'var(--accent-light)', borderRadius: '8px' }} />
            <div style={{ height: '120px', background: 'var(--accent-light)', borderRadius: '8px' }} />
            <div style={{ height: '400px', background: 'var(--accent-light)', borderRadius: '8px' }} />
        </div>
    );
}

LessonRenderer.AITutor = AITutor;
