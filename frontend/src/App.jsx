import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassProvider } from './context/ClassContext'; // Import the new provider
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import TeacherRegisterPage from './pages/auth/TeacherRegisterPage';
import StudentRegisterPage from './pages/auth/StudentRegisterPage';
import TeacherOverview from './pages/teacher/TeacherOverview';
import CreateClass from './pages/teacher/CreateClass';
import ClassDetails from './pages/teacher/ClassDetails';
import CourseBuilder from './pages/teacher/CourseBuilder';
import LessonEditor from './pages/teacher/LessonEditor';




// Layouts
import TeacherLayout from './components/layouts/TeacherLayout';

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
          
          {/* --- Protected Teacher Dashboard Routes --- */}
          {/* We wrap all teacher routes in ONE ClassProvider to stop refetching */}
          <Route 
            path="/dashboard/teacher/*" 
            element={
              <ProtectedRoute allowedRole="teacher">
                <ClassProvider>
                  <Routes>
                    <Route path="/" element={<TeacherOverview />} />
                    <Route path="students" element={<TeacherLayout><div>Students Page</div></TeacherLayout>} />
                    <Route path="analytics" element={<TeacherLayout><div>Analytics Page</div></TeacherLayout>} />
                    <Route path="classes/new" element={<CreateClass />} />
                    <Route path="class/:id" element={<ClassDetails />} />
                    <Route path="course/:id" element={<CourseBuilder />} />
                    <Route path="lesson/:id" element={<LessonEditor />} />
                  </Routes>
                </ClassProvider>
              </ProtectedRoute>
            } 
          />

          {/* --- Protected Student Dashboard --- */}
          <Route 
            path="/dashboard/student" 
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboardPlaceholder />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  ); 
}

/**
 * Student Placeholder
 * (You can move this to its own file later)
 */
function StudentDashboardPlaceholder() {
  const { logout, user } = useAuth();
  return (
    <div className="landing-wrapper h-screen p-20 text-white student-theme">
      <h1 className="text-4xl mb-4 text-cyan-400 font-bold">Student Dashboard</h1>
      <p className="mb-8 text-slate-400">Welcome back, {user?.student_profile?.first_name || 'Learner'}</p>
      <button onClick={logout} className="btn-student">Logout</button>
    </div>
  );
}

export default App;