export default function AnalyticsHeader({ classData, courseData, courses, selectedCourse, setSelectedCourse, onChangeClass, allClasses, selectedClass, setSelectedClass }) {
    return (
        <div style={{ marginBottom: '40px', paddingBottom: '24px', borderBottom: '2px solid rgba(16, 185, 129, 0.3)' }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Class
                </p>
                <button
                    onClick={onChangeClass}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid #10b981',
                        borderRadius: '6px',
                        color: '#10b981',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 200ms ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                >
                    Change Class
                </button>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', margin: 0 }}>
                {classData?.name}
            </h1>

            {/* Course Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <select
                    value={selectedCourse || ''}
                    onChange={(e) => setSelectedCourse(parseInt(e.target.value))}
                    style={{
                        padding: '10px 16px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '15px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 200ms ease-in-out',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2360a5fa' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '40px'
                    }}
                    onFocus={(e) => {
                        e.target.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                        e.target.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                        e.target.style.backgroundColor = 'rgba(30, 41, 59, 0.3)';
                        e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                        e.target.style.boxShadow = 'none';
                    }}
>
                    {courses.map(c => (
                        <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                            {c.title}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
