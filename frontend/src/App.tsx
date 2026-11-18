import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useMe } from './api/client'
import { AppLayout, type NavItem } from './components/AppLayout'
import { RequireRole } from './components/RequireRole'
import { LoadingState } from './components/ui'
import { ROLE_HOME } from './lib/routes'
import { StudentContext } from './session'
import { LoginPage } from './pages/auth/LoginPage'
import { RoleSelect } from './pages/auth/RoleSelect'
import { DiagnosisPage } from './pages/student/DiagnosisPage'
import { ExamSession } from './pages/student/exam/ExamSession'
import { ReviewExam } from './pages/student/exam/ReviewExam'
import { TakeExam } from './pages/student/exam/TakeExam'
import { ExamsPage } from './pages/student/ExamsPage'
import { HistoryDetailPage, HistoryPage } from './pages/student/HistoryPage'
import { LibraryPage } from './pages/student/LibraryPage'
import { PracticePage } from './pages/student/PracticePage'
import { RecommendationsPage, RoadmapPage } from './pages/student/RecommendationsPage'
import { StudentHome } from './pages/student/StudentHome'
import { SubmittedPage } from './pages/student/SubmittedPage'
import { OverviewPage } from './pages/teacher/OverviewPage'
import { ResultsPage } from './pages/teacher/ResultsPage'
import { NotificationsPage } from './pages/teacher/NotificationsPage'
import { TeacherArea } from './pages/teacher/TeacherArea'
import { TeacherDiagnosisPage } from './pages/teacher/TeacherDiagnosisPage'
import { ReportPage } from './pages/teacher/ReportPage'
import { AnswersPage } from './pages/AnswersPage'
import { TeacherMaterialPage, TeacherRecommendationsPage } from './pages/teacher/TeacherRecommendationsPage'

const STUDENT_NAV: NavItem[] = [
  { to: '/student', label: 'Trang chủ', end: true },
  { to: '/student/roadmap', label: 'Lộ trình ôn tập' },
  { to: '/student/library', label: 'Kho học liệu' },
  { to: '/student/exams', label: 'Bài kiểm tra' },
  { to: '/student/history', label: 'Lịch sử học tập' },
]

function StudentArea() {
  const { data: me } = useMe()
  // Giữ học sinh hợp lệ cuối cùng để trang con không vỡ trong khoảnh khắc phiên vừa hết hạn
  const [student, setStudent] = useState(me?.student ?? null)
  if (me?.student && me.student !== student) setStudent(me.student)
  if (!student) return null
  return (
    <StudentContext value={student}>
      <AppLayout nav={STUDENT_NAV} user={{ name: student.full_name, subtitle: `Lớp ${student.class_name}` }} />
    </StudentContext>
  )
}

/** Đã đăng nhập thì vào thẳng khu vực của mình, chưa thì chọn vai trò. */
function Home() {
  const me = useMe()
  if (me.isPending) return <LoadingState />
  if (me.data) return <Navigate to={ROLE_HOME[me.data.role]} replace />
  return <RoleSelect />
}

export function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="login/:role" element={<LoginPage />} />
      <Route
        path="student"
        element={
          <RequireRole role="student">
            <StudentArea />
          </RequireRole>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:examId" element={<ExamSession />}>
          <Route index element={<TakeExam />} />
          <Route path="review" element={<ReviewExam />} />
        </Route>
        <Route path="attempts/:attemptId/submitted" element={<SubmittedPage />} />
        <Route path="attempts/:attemptId/diagnosis" element={<DiagnosisPage />} />
        <Route path="attempts/:attemptId/recommendations" element={<RecommendationsPage />} />
        <Route path="attempts/:attemptId/answers" element={<AnswersPage role="student" />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="practice/:materialId" element={<PracticePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:attemptId" element={<HistoryDetailPage />} />
      </Route>
      <Route
        path="teacher"
        element={
          <RequireRole role="teacher">
            <TeacherArea />
          </RequireRole>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="students" element={<ResultsPage />} />
        <Route path="lookup" element={<Navigate to="/teacher/students" replace />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="attempts/:attemptId/diagnosis" element={<TeacherDiagnosisPage />} />
        <Route path="attempts/:attemptId/recommendations" element={<TeacherRecommendationsPage />} />
        <Route path="attempts/:attemptId/materials/:materialId" element={<TeacherMaterialPage />} />
        <Route path="attempts/:attemptId/report" element={<ReportPage />} />
        <Route path="attempts/:attemptId/answers" element={<AnswersPage role="teacher" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
