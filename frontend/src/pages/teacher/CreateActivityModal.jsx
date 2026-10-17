import { useRef, useState } from 'react';
import {
    X, Zap, ClipboardList, Upload, HelpCircle, BookOpen, UserCheck, Radio, ChevronLeft, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCreateActivity } from '../../queries/classwork';
import DateTimePicker from '../../components/teacher/DateTimePicker';
import './Classwork.css';

const PACING_OPTIONS = [
    {
        id: 'student',
        label: 'Student-paced',
        desc: 'Everyone answers at their own pace under the same time rules',
        icon: UserCheck,
    },
    {
        id: 'teacher',
        label: 'Teacher-paced',
        desc: 'You control the flow — reveal questions and pace the room together',
        icon: Radio,
    },
];

const SUBMISSION_OPTIONS = [
    { id: 'file', label: 'File submission', desc: 'Students upload files for manual grading', icon: Upload },
    { id: 'questions', label: 'Questions', desc: 'Multiple choice, coding, essays — auto or manual grading', icon: HelpCircle },
    { id: 'material', label: 'Material', desc: 'Post resources only — nothing to submit', icon: BookOpen },
];

const TYPE_CARDS = [
    {
        id: 'activity',
        label: 'Activity',
        desc: 'A task students complete and submit — files, answers, or just material to read.',
        eg: 'PT #2: Console Guestbook · Reading: How the Web Works',
        icon: ClipboardList,
        tint: 'var(--db-accent-bright)',
    },
    {
        id: 'quiz',
        label: 'Quiz',
        desc: 'A timed assessment with auto-grading — or run it live, teacher-paced.',
        eg: 'Quiz 3: Loops & Conditions',
        icon: Zap,
        tint: 'var(--db-amber)',
    },
];

const at2359 = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 0, 0);
    // Full ISO with Z — a sliced-off zone would be re-parsed as local time
    // by the picker and shift the stored instant by the UTC offset.
    return x.toISOString();
};

const DEADLINE_PRESETS = [
    { label: 'Tonight', value: () => at2359(new Date()) },
    { label: 'Tomorrow', value: () => at2359(new Date(Date.now() + 86400000)) },
    {
        label: 'End of week',
        value: () => {
            const now = new Date();
            const diff = (6 - now.getDay() + 7) % 7 || 7; // next Saturday
            return at2359(now.getTime() + diff * 86400000);
        },
    },
];

export default function CreateActivityModal({ isOpen, onClose, classId }) {
    const [selectedType, setSelectedType] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submissionType, setSubmissionType] = useState(null);
    const [pacingMode, setPacingMode] = useState('student');
    const [deadlineAt, setDeadlineAt] = useState('');
    // Teachers usually accept late work and mark it late — start gentle
    const [deadlineBehavior, setDeadlineBehavior] = useState('soft');
    const [loading, setLoading] = useState(false);
    const titleRef = useRef(null);

    const createActivity = useCreateActivity(classId);

    if (!isOpen) return null;

    const isQuiz = selectedType === 'quiz';
    // Deadlines: required for submitted activities, OPTIONAL for quizzes —
    // a student-paced quiz can be due Friday; teacher-paced quizzes run on
    // the room's own lifecycle, and the backend drops the deadline for them.
    const showsDeadline = isQuiz || (selectedType === 'activity' && submissionType !== 'material');
    const needsDeadline = selectedType === 'activity' && submissionType !== 'material';

    const reset = () => {
        setSelectedType(null);
        setTitle('');
        setDescription('');
        setSubmissionType(null);
        setPacingMode('student');
        setDeadlineAt('');
        setDeadlineBehavior('soft');
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const pickType = (id) => {
        setSelectedType(id);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            // Deterministic validation — the native `required` bubble is
            // invisible to some browsers/automations
            toast.error(isQuiz ? 'Give the quiz a title first' : 'Give the activity a title first');
            titleRef.current?.focus();
            return;
        }
        if (!selectedType) return;
        if (selectedType === 'activity' && !submissionType) return;
        if (needsDeadline && !deadlineAt) {
            toast.error('Set a deadline for this activity type');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                activity_type: selectedType,
                deadline_at: deadlineAt || null,
                deadline_behavior: deadlineBehavior,
            };
            if (selectedType === 'activity') {
                payload.submission_type = submissionType;
                payload.grading_method = submissionType === 'file' ? 'manual' : submissionType === 'questions' ? 'auto' : 'none';
            }
            if (selectedType === 'quiz') {
                payload.pacing_mode = pacingMode;
            }
            await createActivity.mutateAsync(payload);
            toast.success(isQuiz ? 'Quiz created — it starts as a draft' : 'Activity created — it starts as a draft');
            handleClose();
        } catch {
            toast.error('Failed to create');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="db-modal-backdrop" onClick={handleClose}>
            <div className="db-modal cw-modal" onClick={(e) => e.stopPropagation()}>
                <button className="db-modal-close" onClick={handleClose} type="button"><X size={17} /></button>

                {selectedType === null ? (
                    <>
                        <div className="db-modal-head">
                            <h3 className="db-modal-title">Create classwork</h3>
                            <p className="db-modal-sub">What are you making? Everything starts as a draft.</p>
                        </div>
                        <div className="cw-types">
                            {TYPE_CARDS.map((t) => {
                                const Icon = t.icon;
                                return (
                                    <button key={t.id} type="button" className="cw-type-card" onClick={() => pickType(t.id)}>
                                        <span className="cw-type-icon" style={{ color: t.tint }}><Icon size={22} /></span>
                                        <span>
                                            <p className="cw-type-name">{t.label}</p>
                                            <p className="cw-type-desc">{t.desc}</p>
                                            <span className="cw-type-eg">e.g. {t.eg}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="db-modal-head">
                            <button type="button" onClick={() => setSelectedType(null)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 10,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: 'var(--db-text-3)', font: 'inherit', fontSize: 13, fontWeight: 600,
                                }}>
                                <ChevronLeft size={15} /> Back
                            </button>
                            <h3 className="db-modal-title">{isQuiz ? 'Quiz details' : 'Activity details'}</h3>
                            <p className="db-modal-sub">Name it, set how students interact with it, publish when ready.</p>
                        </div>

                        <div className="db-modal-form">
                            <label className="db-field">
                                <span className="db-field-label">Title</span>
                                <input className="db-input" type="text" autoFocus ref={titleRef}
                                    placeholder={isQuiz ? 'e.g. Quiz 3: Loops & Conditions' : 'e.g. PT #2: Console Guestbook'}
                                    value={title} onChange={(e) => setTitle(e.target.value)} />
                            </label>

                            {/* Quiz → pacing | Activity → submission type */}
                            <div>
                                <span className="db-field-label">{isQuiz ? 'How will the quiz run?' : 'What do students do?'}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                    {(isQuiz ? PACING_OPTIONS : SUBMISSION_OPTIONS).map((opt) => {
                                        const Icon = opt.icon;
                                        const selected = isQuiz ? pacingMode === opt.id : submissionType === opt.id;
                                        const select = () => (isQuiz ? setPacingMode(opt.id) : setSubmissionType(opt.id));
                                        return (
                                            <button key={opt.id} type="button"
                                                className={`cw-choice ${selected ? 'selected' : ''}`}
                                                onClick={select}>
                                                <span className="cw-choice-icon"><Icon size={17} /></span>
                                                <span>
                                                    <p className="cw-choice-name">{opt.label}</p>
                                                    <p className="cw-choice-desc">{opt.desc}</p>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <label className="db-field">
                                <span className="db-field-label">Instructions <em>· optional</em></span>
                                <textarea className="db-input db-textarea" rows={3}
                                    placeholder={isQuiz ? 'Rules, coverage, notes for the class…' : 'Describe the task, add rubric or guidelines…'}
                                    value={description} onChange={(e) => setDescription(e.target.value)} />
                            </label>

                            {showsDeadline && (
                                <div className="db-field">
                                    <span className="db-field-label"><Clock size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} /> Deadline{isQuiz && <em> · optional</em>}</span>
                                    <DateTimePicker value={deadlineAt} onChange={setDeadlineAt} />
                                    <div className="cw-presets">
                                        {DEADLINE_PRESETS.map((p) => (
                                            <button key={p.label} type="button" className="cw-preset" onClick={() => setDeadlineAt(p.value())}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="cw-seg" style={{ marginTop: 10 }}>
                                        <button type="button"
                                            className={`cw-seg-btn ${deadlineBehavior === 'hard' ? 'on' : ''}`}
                                            onClick={() => setDeadlineBehavior('hard')}>
                                            Closes at deadline
                                        </button>
                                        <button type="button"
                                            className={`cw-seg-btn ${deadlineBehavior === 'soft' ? 'on' : ''}`}
                                            onClick={() => setDeadlineBehavior('soft')}>
                                            Late OK
                                        </button>
                                    </div>
                                    <p className="cw-seg-hint">
                                        {deadlineBehavior === 'hard'
                                            ? 'Submissions close the moment the deadline passes.'
                                            : 'Students can still submit after the deadline — marked as late.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="db-modal-actions">
                            <button type="button" className="db-btn-ghost" onClick={handleClose}>Cancel</button>
                            <button type="submit" className="db-btn-primary" disabled={loading || (selectedType === 'activity' && !submissionType)}>
                                Create {isQuiz ? 'quiz' : 'activity'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
