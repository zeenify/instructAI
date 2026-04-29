import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ClassProvider } from './context/ClassContext'; 
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
import CourseBuilder from './pages/teacher/CourseBuilder';
import LessonEditor from './pages/teacher/LessonEditor';
import QuizBuilder from './pages/teacher/QuizBuilder';

// Student Pages
import StudentOverview from './pages/student/StudentOverview';
import ClassView from './pages/student/ClassView';
import CourseViewer from './pages/student/CourseViewer';

// Layouts
import TeacherLayout from './components/layouts/TeacherLayout';
import StudentLayout from './components/layouts/StudentLayout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
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
            <Route path="students" element={<div>Students Page</div>} />
            <Route path="analytics" element={<div>Analytics Page</div>} />
            <Route path="classes/new" element={<CreateClass />} />
            <Route path="class/:id" element={<ClassDetails />} />
            {/* Added classId to these routes to keep Sidebar highlighted */}
            <Route path="class/:classId/course/:id" element={<CourseBuilder />} />
            <Route path="class/:classId/lesson/:id" element={<LessonEditor />} />
            <Route path="class/:classId/quiz/:id" element={<QuizBuilder />} />
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
                      <CourseViewer />
                  </ProtectedRoute>
              } 
          >
            {/* These sub-routes allow the URL to change to /lesson/5 or /quiz/1 */}
            <Route path=":itemType/:itemId" element={<CourseViewer />} />
          </Route>


          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  ); 
}

export default App;