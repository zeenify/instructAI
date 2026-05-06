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
            
            // Initial Unlock check
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
        <div className="max-w-4xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
            {/* Global styles for Rich Text (Bullets, etc) */}
            <style>{`
                .prose ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin: 1rem 0 !important; }
                .prose li { margin-bottom: 0.5rem !important; color: #94a3b8; }
                .prose strong { color: #f8fafc; font-weight: 800; }
                .prose a { color: #a855f7; text-decoration: underline; }
            `}</style>

            <header>
                <div className="flex items-center gap-4 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500">Learning Module</span>
                    {isCompleted && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase">
                            <CheckCircle2 size={10}/> Completed
                        </div>
                    )}
                </div>
                <h1 className="text-6xl font-black text-white tracking-tighter mb-8 leading-[0.9]">{lesson.title}</h1>
                <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-transparent rounded-full" />
            </header>

            <div className="space-y-20">
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
            return <h2 className="text-4xl font-black text-white mt-24 mb-8 tracking-tight">{data.text}</h2>;

        case 'text':
            return (
                <div 
                    className="prose prose-invert max-w-none text-xl text-slate-400 leading-relaxed font-medium"
                    dangerouslySetInnerHTML={{ __html: data.text }}
                />
            );

        case 'image':
            return (
                <figure className="my-16 group">
                    <div className="rounded-[40px] overflow-hidden border border-white/5 shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
                        <img src={data.url} className="w-full" alt={data.caption} />
                    </div>
                    {data.caption && (
                        <figcaption className="text-center text-slate-500 mt-6 text-xs font-black uppercase tracking-[0.2em]">
                            {data.caption}
                        </figcaption>
                    )}
                </figure>
            );

        case 'video':
            const ytId = getYoutubeId(data.url);
            return (
                <div className="my-16 space-y-6">
                    <div className="flex items-center gap-3 text-red-500/80">
                        <Play size={14} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Video Demonstration</span>
                    </div>
                    {ytId ? (
                        <div className="aspect-video w-full rounded-[40px] overflow-hidden border border-white/10 shadow-2xl bg-black">
                            <iframe
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${ytId}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <div className="p-8 bg-gradient-to-br from-red-500/5 to-orange-500/5 rounded-[40px] border border-dashed border-red-500/20 text-center space-y-3">
                            <VideoIcon size={32} className="mx-auto text-red-400/50" />
                            <div>
                                <p className="text-sm font-bold text-white mb-2">{data.title || "Video Suggestion"}</p>
                                <p className="text-xs text-slate-400">{data.description || "Teacher will add video link"}</p>
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
                    className="flex items-center gap-6 p-8 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group no-underline decoration-transparent"
                >
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                        <ExternalLink size={24} />
                    </div>
                    <div className="flex-grow">
                        <h4 className="text-lg font-black text-white mb-1">{data.title || 'View Resource'}</h4>
                        <p className="text-xs text-slate-500 font-mono tracking-tighter truncate max-w-md">{data.url}</p>
                    </div>
                </a>
            );

        default:
            return null;
    }
}

function LessonSkeleton() {
    return (
        <div className="animate-pulse space-y-12 py-10 max-w-4xl mx-auto">
            <div className="h-4 w-40 bg-white/5 rounded" />
            <div className="h-20 w-3/4 bg-white/5 rounded-3xl" />
            <div className="h-1 w-24 bg-white/5 rounded-full" />
            <div className="space-y-6 pt-10">
                <div className="h-4 w-full bg-white/5 rounded" />
                <div className="h-4 w-full bg-white/5 rounded" />
                <div className="h-4 w-2/3 bg-white/5 rounded" />
            </div>
            <div className="h-96 w-full bg-white/5 rounded-[40px]" />
        </div>
    );
}