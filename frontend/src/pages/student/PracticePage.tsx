import { useParams, useSearchParams } from 'react-router'
import { MaterialPractice } from '../../components/MaterialPractice'
import { useStudentId } from '../../session'

export function PracticePage() {
  const { materialId } = useParams()
  const studentId = useStudentId()
  // Mở từ Kho học liệu thì đường dẫn và nút quay lại trỏ về kho; mặc định trỏ về lộ trình
  const [params] = useSearchParams()
  const parent =
    params.get('from') === 'library'
      ? { label: 'Kho học liệu', to: '/student/library', back: 'Quay lại kho học liệu' }
      : { label: 'Lộ trình ôn tập', to: '/student/roadmap', back: 'Quay lại lộ trình' }
  return (
    <MaterialPractice
      materialId={materialId}
      storageKey={`kltn.practice.${studentId}.${materialId}`}
      crumbs={[{ label: 'Trang chủ', to: '/student' }, { label: parent.label, to: parent.to }, { label: 'Luyện chuyên đề' }]}
      back={{ to: parent.to, label: parent.back }}
    />
  )
}
