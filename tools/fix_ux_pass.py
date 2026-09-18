# -*- coding: utf-8 -*-
"""One-shot: UI-only fixes from the teacher-eye re-review."""
p = r'C:\Users\EDRICK\Desktop\instructai\frontend\src\pages\teacher\CourseBuilder.jsx'
s = open(p, encoding='utf-8').read()

# 1. visibility text (presentation of existing publish state only)
old = """    const activeModuleData = activeModuleId ? course.modules.find(m => m.id === activeModuleId) : null;"""
new = """    const activeModuleData = activeModuleId ? course.modules.find(m => m.id === activeModuleId) : null;

    // What students actually see right now — plain-language presentation of
    // the existing publish states (no new logic, just honesty in the UI).
    const totalItems = course?.modules?.reduce((n, m) => n + (m.lessons?.length || 0) + (m.quizzes?.length || 0), 0) ?? 0;
    const publishedItems = course?.modules?.reduce((n, m) => n + (m.lessons || []).filter(l => l.is_published).length + (m.quizzes || []).filter(q => q.is_published).length, 0) ?? 0;
    const visibilityText = !isPublished
        ? 'Hidden from students until you Go Live.'
        : totalItems === 0 || publishedItems === 0
            ? 'Live — but nothing is published yet. Students see an empty class.'
            : `Students can see ${publishedItems} of ${totalItems} items.`;"""
assert s.count(old) == 1, 'visibility calc'
s = s.replace(old, new, 1)

# 2. visibility line under the embedded toolbar
old = """                        <button type="button" className="cd-tbtn-primary" onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })}>
                            <Plus size={16} />
                            New Module
                        </button>
                    </div>
                )}"""
new = """                        <button type="button" className="cd-tbtn-primary" onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })}>
                            <Plus size={16} />
                            New Module
                        </button>
                    </div>
                )}
                {!activeModuleId && embedded && (
                    <p className="cd-visibility">{visibilityText}</p>
                )}"""
assert s.count(old) == 1, 'visibility line'
s = s.replace(old, new, 1)

# 3. one action, one name — toolbar matches the panel wording
old = """                            <Sparkles size={16} />
                            AI Generate
                        </button>"""
new = """                            <Sparkles size={16} />
                            Generate with AI
                        </button>"""
assert s.count(old) == 1, 'ai label'
s = s.replace(old, new, 1)

# 4. tutor button rename + honest tooltip
old = """                        <button type="button" className="cd-tbtn" onClick={handleIndexCourse} disabled={isUpdatingStatus} title="Let the student AI tutor answer questions using this class's content">
                            <BookOpen size={16} />
                            Teach the Tutor
                        </button>"""
new = """                        <button type="button" className="cd-tbtn" onClick={handleIndexCourse} disabled={isUpdatingStatus} title="Choose what the student AI tutor can answer from">
                            <BookOpen size={16} />
                            AI Tutor Setup
                        </button>"""
assert s.count(old) == 1, 'tutor label'
s = s.replace(old, new, 1)

# 5. curriculum label matches the panel wording
old = """                            <FileText size={16} />
                            Curriculum
                        </button>"""
new = """                            <FileText size={16} />
                            {course.curriculum_file_url ? 'Curriculum' : 'Upload Curriculum'}
                        </button>"""
assert s.count(old) == 1, 'curriculum label'
s = s.replace(old, new, 1)

# 6. empty panel: priority flip (upload first when no curriculum)
old = """                                <div className="cd-empty-build-actions">
                                    <button type="button" className="cd-tbtn cd-tbtn-ai cd-tbtn-lg" onClick={() => setIsAiModalOpen(true)}>
                                        <Sparkles size={16} />
                                        Generate with AI
                                    </button>
                                    {!course.curriculum_file_url && (
                                        <button type="button" className="cd-tbtn" onClick={() => setShowCurriculumModal(true)}>
                                            <FileText size={16} />
                                            Upload Curriculum
                                        </button>
                                    )}
                                    <button type="button" className="cd-tbtn" onClick={() => setModuleModal({ isOpen: true, mode: 'create', id: null, title: '' })}>
                                        <Plus size={16} />
                                        New Module
                                    </button>
                                </div>"""
new = """                                <div className="cd-empty-build-actions">
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
                                </div>"""
assert s.count(old) == 1, 'panel actions'
s = s.replace(old, new, 1)

# 7. empty module card: ONE emptiness signal + a next action instead of four
old = """                                            <div className="cd-mod-meta">
                                                <span className="cd-chip"><BookOpen size={14} /> {module.lessons?.length || 0} {module.lessons?.length === 1 ? 'Lesson' : 'Lessons'}</span>
                                                <span className="cd-chip"><HelpCircle size={14} /> {module.quizzes?.length || 0} {module.quizzes?.length === 1 ? 'Quiz' : 'Quizzes'}</span>
                                                <span className={`cd-chip ${statusClass}`}>{statusText}</span>
                                            </div>
                                            <div className="cd-mod-foot">
                                                <span className="cd-mod-items">{total} items</span>
                                            </div>"""
new = """                                            {total === 0 ? (
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
                                                        <span className={`cd-chip ${statusClass}`}>{statusText}</span>
                                                    </div>
                                                    <div className="cd-mod-foot">
                                                        <span className="cd-mod-items">{total} items</span>
                                                    </div>
                                                </>
                                            )}"""
assert s.count(old) == 1, 'empty card'
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ux pass done')
