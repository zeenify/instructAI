import { Toaster } from 'sonner';
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassProvider } from './context/ClassContext';
import { useTheme } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

// --- Page Imports ---
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import TeacherRegisterPage from './pages/auth/TeacherRegisterPage';
import StudentRegisterPage from './pages/auth/StudentRegisterPage';

// Teacher Pages
import TeacherOverview from './pages/teacher/TeacherOverview';
import CreateClass from './pages/teacher/CreateClass';
import ClassDetails from './pages/teacher/ClassDetails';
import TeacherProgress from './pages/teacher/TeacherProgress';
import LessonEditor from './pages/teacher/LessonEditor';
import QuizBuilder from './pages/teacher/QuizBuilder';
import ActivityEditor from './pages/teacher/ActivityEditor';
import ActivityGrading from './pages/teacher/ActivityGrading';
import LiveQuizMonitor from './pages/teacher/LiveQuizMonitor';
import GradingQueue from './pages/teacher/GradingQueue';
import ActivityResults from './pages/teacher/ActivityResults';

// Admin Pages
import AdminLayout from './components/layouts/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminUsers from './pages/admin/AdminUsers';
import AdminClasses from './pages/admin/AdminClasses';
import AdminWhitelists from './pages/admin/AdminWhitelists';
import AdminSystem from './pages/admin/AdminSystem';

// Student Pages
import StudentOverview from './pages/student/StudentOverview';
import ClassView from './pages/student/ClassView';
import QuizRoomView from './pages/student/QuizRoomView';
import CourseViewer from './pages/student/CourseViewer';
import ActivityViewer from './pages/student/ActivityViewer';

// Layouts
import TeacherLayout from './components/layouts/TeacherLayout';
import StudentLayout from './components/layouts/StudentLayout';

// /logout used to be a dead route (catch-all → blank "/") with the session
// still intact — make it actually end the session.
function LogoutRoute() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);
  return null;
}

// Safety net: a render crash used to white-screen the whole app with no
// message. Now the error is visible on the page instead of a silent void.
class RootErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{
          padding: 24, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12.5, color: '#b91c1c', background: '#fef2f2', minHeight: '100vh',
        }}>
          {'ROOT ERROR\n\n' + String(this.state.error?.stack || this.state.error)}
        </pre>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { theme } = useTheme();
  return (
    <AuthProvider>
      <RootErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          richColors
          closeButton
          theme={theme}
          toastOptions={{
            style: {
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: '14px',
              padding: '14px 18px',
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.08)',
            },
            actionButtonStyle: {
              background: '#0a84ff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13.5px',
              padding: '8px 15px',
              boxShadow: '0 3px 12px rgba(10, 132, 255, 0.35)',
            },
            cancelButtonStyle: {
              background: 'transparent',
              color: 'inherit',
              border: 'none',
              fontWeight: 600,
            },
          }}
        />
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/logout" element={<LogoutRoute />} />
          <Route path="/register/teacher" element={<TeacherRegisterPage />} />
          <Route path="/register/student" element={<StudentRegisterPage />} />
          
          {/* --- Teacher Dashboard (Immortal Sidebar) --- */}
          <Route 
            path="/dashboard/teacher" 
            element={
              <ProtectedRoute allowedRole="teacher">
                <ClassProvider>
                   <TeacherLayout /> 
                </ClassProvider>
              </ProtectedRoute>
            } 
          >
            <Route index element={<TeacherOverview />} />
            <Route path="progress" element={<TeacherProgress />} />
            <Route path="grading" element={<GradingQueue />} />
            <Route path="students" element={<div>Students Page</div>} />
            <Route path="classes/new" element={<CreateClass />} />
            <Route path="class/:id" element={<ClassDetails />} />
            {/* The standalone /class/:classId/course/:id route was removed —
                the builder lives embedded in the class page's Content tab. */}
            <Route path="class/:classId/lesson/:id" element={<LessonEditor />} />
            <Route path="class/:classId/quiz/:id" element={<QuizBuilder />} />
            <Route path="class/:classId/activity/:activityId" element={<ActivityEditor />} />
            <Route path="class/:classId/activity/:activityId/submissions" element={<ActivityGrading />} />
            <Route path="class/:classId/activity/:activityId/live" element={<LiveQuizMonitor />} />
            <Route path="class/:classId/activity/:activityId/results" element={<ActivityResults />} />
          </Route>

          {/* --- Admin Dashboard --- */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="whitelists" element={<AdminWhitelists />} />
            <Route path="system" element={<AdminSystem />} />
          </Route>

          {/* --- Student Dashboard (Immortal Sidebar) --- */}
          <Route 
            path="/dashboard/student" 
            element={
              <ProtectedRoute allowedRole="student">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
              <Route index element={<StudentOverview />} />
              <Route path="class/:id" element={<ClassView />} />
          </Route>

          {/* --- Student Course Viewer (Focus Mode - No Main Sidebar) --- */}
          <Route
              path="/dashboard/student/course/:id"
              element={
                  <ProtectedRoute allowedRole="student">
                      <div className="student-theme">
                          <CourseViewer />
                      </div>
                  </ProtectedRoute>
              }
          >
            {/* These sub-routes allow the URL to change to /lesson/5 or /quiz/1 */}
            <Route path=":itemType/:itemId" element={<CourseViewer />} />
          </Route>

          {/* --- Student Activity Viewer (Focus Mode - No Main Sidebar) --- */}
          <Route
              path="/dashboard/student/class/:classId/activity/:activityId"
              element={
                  <ProtectedRoute allowedRole="student">
                      <div className="student-theme">
                          <ActivityViewer />
                      </div>
                  </ProtectedRoute>
              }
          />

          {/* --- Student Live Quiz Room (Focus Mode - No Main Sidebar) --- */}
          <Route
              path="/dashboard/student/class/:classId/quiz/:activityId"
              element={
                  <ProtectedRoute allowedRole="student">
                      <div className="student-theme">
                          <QuizRoomView />
                      </div>
                  </ProtectedRoute>
              }
          />


          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </RootErrorBoundary>
    </AuthProvider>
  );
}

export default App;