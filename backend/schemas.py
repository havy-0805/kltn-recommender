from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Option = Literal['A', 'B', 'C', 'D']
Role = Literal['student', 'teacher']
DiagnosisStatus = Literal['DIAGNOSED', 'MASTERY', 'NO_WEAK_SKILL', 'NO_DATA']
RulesVersion = Literal['v3', 'v4']
Scope = Literal['topic', 'group']


class Student(BaseModel):
    student_id: str
    full_name: str
    class_name: str


class LoginRequest(BaseModel):
    role: Role
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class Me(BaseModel):
    username: str
    role: Role
    display_name: str
    student: Student | None


class Exam(BaseModel):
    exam_id: str
    exam_title: str
    academic_year: str
    grade: int
    duration_minutes: int
    total_questions: int


class Passage(BaseModel):
    """Đoạn văn dùng chung cho một nhóm câu đọc hiểu (data/passage.csv)."""

    passage_id: str
    title: str
    from_no: int
    to_no: int
    text: str


class QuestionMedia(BaseModel):
    """Hình của câu biển báo (src: ảnh SVG) hoặc nội dung tờ thông báo (text), từ data/question_media.csv."""

    kind: Literal['sign', 'notice']
    src: str | None = None
    text: str | None = None
    alt: str


class Question(BaseModel):
    question_id: str
    question_no: int
    question_text: str
    options: dict[Option, str]
    passage: Passage | None = None
    media: QuestionMedia | None = None
    # Câu phát âm: phần gạch chân của từng phương án, [vị trí đầu, vị trí sau cuối] trong chuỗi phương án
    underline: dict[Option, tuple[int, int]] | None = None


class AnswerReview(BaseModel):
    """Một câu khi xem lại bài đã nộp: đáp án đã chọn (None nếu bỏ trống), đáp án đúng và lời giải."""

    question: Question
    selected_opt: Option | None
    correct_opt: Option
    is_correct: bool
    explanation: str
    skill_name: str


class Attempt(BaseModel):
    attempt_id: str
    student: Student
    exam: Exam
    total_score: float
    correct_count: int
    started_at: str
    submitted_at: str
    diagnosed: bool


class SubmitRequest(BaseModel):
    # Không có student_id: backend lấy từ phiên đăng nhập để học sinh không nộp bài thay người khác
    exam_id: str
    started_at: str | None = None
    answers: dict[str, Option | None] = Field(description='question_id -> đáp án đã chọn, null nếu bỏ trống')


class WeakSkill(BaseModel):
    skill_id: str
    skill_name: str
    category: str
    gap_type: str
    error_stats: str
    easy_stats: str
    priority_score: float
    assigned_target_level: int
    wrong_question_nos: list[int]
    in_top_k: bool
    has_material: bool
    scope: Scope = Field(description='topic: chẩn đoán theo chuyên đề; group: gộp các chuyên đề chỉ có 1 câu')
    member_topics: list[str]
    reason: str
    previous_wrong_nos: list[int] = Field(
        default_factory=list,
        description=('Câu sai cùng chuyên đề ở bài làm gần nhất trước đó có chuyên đề này, '
                     'khi đơn vị mới sai 1 câu ở bài này '
                     '(cộng dồn bằng chứng)'),
    )
    previous_wrong_times: int = Field(
        default=0, description='Số bài làm liên tiếp trước đó (có chuyên đề này) đều sai chuyên đề này')


class Recommendation(BaseModel):
    skill_id: str
    skill_name: str
    category: str
    gap_type: str
    error_stats: str
    easy_stats: str
    priority_score: float
    assigned_target_level: int
    wrong_question_nos: list[int]
    scope: Scope
    member_topics: list[str]
    material_id: str
    material_title: str
    material_actual_level: int
    material_skill_id: str
    matched_error_types: list[str] = Field(description='Dạng lỗi học sinh mắc mà học liệu có dạy (BR-REC-05b)')
    reason: str
    previous_wrong_nos: list[int] = Field(
        default_factory=list, description='Câu sai cùng chuyên đề ở bài làm trước (cộng dồn bằng chứng)')
    previous_wrong_times: int = Field(default=0, description='Số bài làm liên tiếp trước đó đều sai chuyên đề này')
    tentative: bool = Field(
        default=False,
        description=('Nên ôn thêm (BR-REC-07): đơn vị mới sai 1 câu, chưa đủ để kết luận là điểm yếu, '
                     'dùng để bù chỗ trống Top-K'),
    )


class InsufficientSkill(BaseModel):
    """Chuyên đề chỉ có 1 câu trong đề và không gộp được nhóm: chưa đủ căn cứ để kết luận."""

    skill_id: str
    skill_name: str
    category: str
    error_stats: str
    wrong_question_nos: list[int]


class PassRate(BaseModel):
    id: str
    name: str
    correct_q: int
    total_q: int
    pass_rate: float


class Diagnosis(BaseModel):
    attempt_id: str
    student_id: str
    exam_id: str
    total_score: float
    status: DiagnosisStatus
    total_weak_detected: int
    broad_weakness_activated: bool
    weak_skills: list[WeakSkill]
    recommendations: list[Recommendation]
    rules_version: RulesVersion
    recorded_score: float
    score_verified: bool = Field(description='false nếu điểm ghi nhận lệch với điểm tính lại từ từng câu')
    category_stats: list[PassRate]
    group_stats: list[PassRate] = Field(description='Tỷ lệ đạt theo nhóm kiến thức, sắp từ thấp đến cao')
    insufficient_skills: list[InsufficientSkill]


class CountItem(BaseModel):
    id: str
    name: str
    count: int


class ClassSummary(BaseModel):
    class_name: str
    students: int
    submitted_students: int
    average_score: float | None


class ExamSummary(BaseModel):
    exam_id: str
    exam_title: str
    attempts: int
    students: int
    average_score: float
    pass_rate: float


class AttemptSummary(BaseModel):
    """Một lượt làm bài kèm số điểm yếu chẩn đoán được (bảng kết quả học sinh, học sinh cần chú ý)."""

    attempt: Attempt
    weak_skill_count: int
    broad_weakness: bool


class Overview(BaseModel):
    """Số liệu tổng quan (sql/tong_quan.sql). Thống kê kỹ năng tính trên bài làm gần nhất của mỗi học sinh."""

    class_name: str | None
    students: int
    submitted_students: int
    attempts: int
    exams_taken: int
    average_score: float | None
    pass_rate: float | None = Field(description='Tỷ lệ lượt làm bài đạt từ 5 điểm')
    score_bands: list[CountItem] = Field(description='Số học sinh theo xếp loại bài gần nhất, từ Giỏi đến Yếu')
    classes: list[ClassSummary]
    exams: list[ExamSummary] = Field(description='Số lượt và điểm theo từng đề')
    group_stats: list[PassRate] = Field(description='Tỷ lệ đạt theo nhóm, cộng dồn số câu; sắp từ thấp đến cao')
    common_weak_skills: list[CountItem] = Field(description='Điểm yếu gặp ở nhiều học sinh nhất')
    top_materials: list[CountItem] = Field(description='Học liệu được đề xuất cho nhiều học sinh nhất')
    missing_materials: list[CountItem] = Field(
        description='Điểm yếu trong Top 3 bị bỏ qua vì kho không có học liệu phù hợp, theo số học sinh (BR-REC-06)'
    )
    attention: list[AttemptSummary] = Field(description='Bài làm gần nhất dưới 5 điểm hoặc mất gốc diện rộng')


class Notification(BaseModel):
    id: str
    kind: Literal['attempt_submitted']
    created_at: str
    read: bool
    attempt: Attempt
    weak_skill_count: int
    recommendation_count: int


class SubmitResponse(BaseModel):
    attempt: Attempt
    notification: Notification


# Nội dung học liệu (data/materials/<material_id>.json, xem SCHEMA.md)


class Example(BaseModel):
    en: str = Field(min_length=1)
    vi: str = Field(min_length=1)


class TheorySection(BaseModel):
    heading: str = Field(min_length=1)
    points: list[str] = Field(min_length=1)
    examples: list[Example] = Field(min_length=1)


class Exercise(BaseModel):
    no: int
    question: str = Field(min_length=1)
    options: dict[Option, str]
    answer: Option
    explanation: str = Field(min_length=10)

    @model_validator(mode='after')
    def four_distinct_options(self) -> Exercise:
        texts = [t.strip().lower() for t in self.options.values()]
        if len(self.options) != 4 or len(set(texts)) != 4 or not all(texts):
            raise ValueError(f'câu {self.no}: cần đủ 4 phương án A–D, khác nhau, không rỗng')
        return self


class ExerciseSet(BaseModel):
    title: str = Field(min_length=1)
    instructions: str = Field(min_length=1)
    passage: str | None
    questions: list[Exercise] = Field(min_length=1)


class Reference(BaseModel):
    title: str = Field(min_length=1)
    url: str = Field(pattern=r'^https?://')


class MaterialContent(BaseModel):
    material_id: str
    skill_id: str
    title: str
    target_level: Literal[1, 2, 3]
    summary: str = Field(min_length=10)
    theory: list[TheorySection] = Field(min_length=2, max_length=5)
    tips: list[str] = Field(min_length=2, max_length=5)
    exercise_sets: list[ExerciseSet] = Field(min_length=1, max_length=5)
    references: list[Reference] = Field(min_length=1)

    @model_validator(mode='after')
    def numbering(self) -> MaterialContent:
        nos = [q.no for s in self.exercise_sets for q in s.questions]
        if len(nos) < 10:
            raise ValueError(f'cần ít nhất 10 câu, hiện có {len(nos)}')
        if nos != list(range(1, len(nos) + 1)):
            raise ValueError(f'số câu phải liên tục 1..N, hiện là {nos}')
        return self


class LibraryItem(BaseModel):
    """Một học liệu trong kho, kèm nhãn liên hệ với kết quả chẩn đoán của học sinh."""

    material_id: str
    title: str
    skill_id: str
    skill_name: str
    category: str
    group_name: str | None
    level: Literal[1, 2, 3]
    recommended: bool = Field(description='Nằm trong danh sách học liệu đề xuất (Top-K) của lượt làm bài')
    weak: bool = Field(description='Thuộc chuyên đề học sinh đang yếu theo lượt làm bài')


class Library(BaseModel):
    """Kho học liệu: toàn bộ học liệu, mức gợi ý theo điểm bài gần nhất (BR-REC-04)."""

    attempt_id: str | None = Field(description='Lượt làm bài dùng để gợi ý mức; null nếu chưa có')
    total_score: float | None
    suggested_level: Literal[1, 2, 3] | None
    items: list[LibraryItem]
