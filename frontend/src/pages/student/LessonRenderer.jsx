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
import { toast } from 'sonner';

export default function LessonRenderer({ lessonId, onProgressUpdate, isCompleted }) {
    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [solvedChallenges, setSolvedChallenges] = useState([]);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setSolvedChallenges([]);

        api.get(`/student/lessons/${lessonId}`).then(res => {
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
            {/* HEADER */}
            <header style={{ paddingBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22d3ee' }} />
                    <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: '#22d3ee' }}>Learning Module</span>
                    {isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginLeft: '12px' }}>
                            <CheckCircle2 size={14}/> Completed
                        </div>
                    )}
                </div>
                <div style={{ padding: '32px 36px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)', border: '1px solid rgba(34, 211, 238, 0.15)', borderRadius: '20px', backdropFilter: 'blur(10px)' }}>
                    <h1 style={{ fontSize: '52px', fontWeight: 900, color: 'white', margin: '0', lineHeight: '1.15', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #ffffff 0%, #22d3ee 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{lesson.title}</h1>
                </div>
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
            return <h2 style={{ fontSize: '36px', fontWeight: 900, color: 'white', margin: '0 0 24px 0', letterSpacing: '-0.02em', paddingBottom: '12px', borderBottom: '2px solid rgba(34, 211, 238, 0.2)' }}>{data.text}</h2>;

        case 'text':
            return (
                <div
                    style={{ fontSize: '18px', color: '#cbd5e1', lineHeight: '1.9', margin: '0' }}
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: data.text }}
                />
            );

        case 'image':
            return (
                <figure style={{ margin: '32px 0', textAlign: 'center' }}>
                    <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(34, 211, 238, 0.1)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)', transition: 'transform 0.3s' }}>
                        <img src={data.url} style={{ width: '100%', display: 'block' }} alt={data.caption} />
                    </div>
                    {data.caption && (
                        <figcaption style={{ marginTop: '16px', fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
                        <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0' }}>Video Demonstration</span>
                    </div>
                    {ytId ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid rgba(34, 211, 238, 0.1)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
                            <iframe
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                src={`https://www.youtube.com/embed/${ytId}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <div style={{ padding: '40px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(249, 115, 22, 0.05) 100%)', borderRadius: '24px', border: '1px dashed rgba(239, 68, 68, 0.2)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                            <VideoIcon size={40} style={{ color: 'rgba(239, 68, 68, 0.4)' }} />
                            <div>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>{data.title || "Video Suggestion"}</p>
                                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>{data.description || "Teacher will add video link"}</p>
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
                    style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', borderRadius: '20px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', textDecoration: 'none', transition: 'all 0.3s', gap: '20px', cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                    }}
                >
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d8b4fe', flexShrink: 0 }}>
                        <ExternalLink size={28} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: 900, color: 'white', margin: '0 0 4px 0' }}>{data.title || 'View Resource'}</h4>
                        <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Courier New, monospace', letterSpacing: '0.05em', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{data.url}</p>
                    </div>
                </a>
            );

        default:
            return null;
    }
}

function LessonSkeleton() {
    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '32px', animation: 'pulse 2s infinite' }}>
            <div style={{ height: '40px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '8px' }} />
            <div style={{ height: '120px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '8px' }} />
            <div style={{ height: '400px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '8px' }} />
        </div>
    );
}
