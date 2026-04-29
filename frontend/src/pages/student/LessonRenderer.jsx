import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Loader2, Code as CodeIcon, CheckCircle2 } from 'lucide-react';
import CodeIDE from './CodeIDE';
import { toast } from 'sonner'; // Add this for feedback

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

    // --- ADD THIS FUNCTION: It was missing ---
    const handleBlockSolved = (blockId) => {
        if (solvedChallenges.includes(blockId)) return;
        
        const newSolved = [...solvedChallenges, blockId];
        setSolvedChallenges(newSolved);

        // Check if ALL challenges in the current lesson are now solved
        const totalRequired = lesson.content.filter(b => b.type === 'code' && b.data.mode === 'challenge').length;
        
        if (newSolved.length >= totalRequired) {
            onProgressUpdate(true); // Tell CourseViewer to unlock the Next button
            toast.success("All lesson challenges solved!");
        }
    };

    if (loading) return <LessonSkeleton />;

    return (
        <div className="space-y-16 animate-in fade-in duration-1000">
            <header>
                <div className="flex items-center gap-4 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500">Learning Module</span>
                    {isCompleted && <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase"><CheckCircle2 size={10}/> Completed</div>}
                </div>
                <h1 className="text-6xl font-black text-white tracking-tighter mb-8">{lesson.title}</h1>
                <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-transparent rounded-full" />
            </header>

            <div className="space-y-12">
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

// ... renderStandardBlock and LessonSkeleton stay exactly as they were ...
function renderStandardBlock(block) {
    const { type, data } = block;
    if (type === 'h1') return <h2 className="text-4xl font-bold text-white mt-20 mb-8 tracking-tight">{data.text}</h2>;
    if (type === 'text') return <p className="text-xl text-slate-400 leading-relaxed font-medium">{data.text}</p>;
    if (type === 'image') return <figure className="my-14"><img src={data.url} className="w-full rounded-[40px] border border-white/5 shadow-2xl" /><figcaption className="text-center text-slate-500 mt-6 text-sm font-bold uppercase tracking-widest">{data.caption}</figcaption></figure>;
    return null;
}

function LessonSkeleton() {
    return <div className="animate-pulse space-y-12 py-10">
        <div className="h-4 w-40 bg-white/5 rounded" />
        <div className="h-16 w-3/4 bg-white/5 rounded-2xl" />
        <div className="h-1 w-24 bg-white/5 rounded-full" />
        <div className="space-y-6 pt-10">
            <div className="h-4 w-full bg-white/5 rounded" />
            <div className="h-4 w-full bg-white/5 rounded" />
            <div className="h-4 w-2/3 bg-white/5 rounded" />
        </div>
        <div className="h-80 w-full bg-white/5 rounded-[40px]" />
    </div>;
}