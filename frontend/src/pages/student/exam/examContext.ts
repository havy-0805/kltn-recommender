import { useOutletContext } from 'react-router'
import type { Exam, Question } from '../../../api/client'
import type { useExamDraft } from './useExamDraft'

export type ExamContext = ReturnType<typeof useExamDraft> & {
  exam: Exam
  questions: Question[]
  secondsLeft: number
  submit: () => void
  submitting: boolean
  submitError: unknown
}

export const useExamContext = () => useOutletContext<ExamContext>()
