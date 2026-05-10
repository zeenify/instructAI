import ProgressBar from './ProgressBar';

export default function ModuleProgressCard({ module }) {
  const completedLessons = module.lessons?.filter(l => l.generated).length || 0;
  const totalLessons = module.lessons?.length || 0;
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return (
    <div className="mb-4 p-5 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold text-white truncate">{module.title}</span>
        <span className="text-sm text-slate-400 ml-2 flex-shrink-0 font-mono">
          {completedLessons}/{totalLessons}
        </span>
      </div>

      <ProgressBar value={progress} showPercentage={false} />

      {/* Lesson dots */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {module.lessons?.map(lesson => (
          <div
            key={lesson.id}
            className={`w-3 h-3 rounded-full transition-colors ${
              lesson.generated
                ? 'bg-green-400'
                : lesson.generating
                ? 'bg-cyan-400 animate-pulse'
                : 'bg-slate-700'
            }`}
            title={lesson.title}
          />
        ))}
      </div>
    </div>
  );
}
