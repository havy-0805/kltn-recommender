"""Kho dữ liệu: CSDL SQLite data/kltn.sqlite (lược đồ sql/schema.sql).

Mọi lượt nộp, kết quả từng câu, thông báo và kết quả chẩn đoán được ghi thẳng vào CSDL trong một giao dịch.
Thuật toán phân tích chạy trên bản sao các bảng trong bộ nhớ (pandas), nạp từ CSDL khi khởi động
và được nối thêm ngay sau mỗi lần ghi.
"""

from __future__ import annotations

from collections.abc import Hashable, Mapping
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import pandas as pd

from database import (
    DIAGNOSIS_TABLES,
    connect,
    db_path,
    diagnosis_rows,
    init_database,
    insert_rows,
    load_dataset_db,
    read_table,
    run,
    write_diagnosis,
)
from engine import DEFAULT_RULES, GROUP_COLS, Dataset, read_material_sections, recommend_for_attempt, suggested_level
from schemas import (
    AnswerReview,
    Attempt,
    AttemptSummary,
    ClassSummary,
    CountItem,
    Diagnosis,
    Exam,
    ExamSummary,
    Library,
    LibraryItem,
    MaterialContent,
    Notification,
    Option,
    Overview,
    Passage,
    PassRate,
    Question,
    QuestionMedia,
    Student,
    SubmitRequest,
)

TIME_FORMAT = '%Y-%m-%d %H:%M:%S'
DEFAULT_TOP_K = 3


def class_label(grade: object, group: object) -> str:
    """Tên lớp từ khối và nhóm của bảng student: (9, 'Nhom2') -> '9 - Nhóm 2' (giống view v_student trong SQL)."""
    return f'{grade} - Nhóm {str(group).removeprefix("Nhom")}'


def _now() -> str:
    return datetime.now().strftime(TIME_FORMAT)


def _next_id(existing: pd.Series, prefix: str) -> str:
    numbers = existing.str.removeprefix(prefix).astype(int)
    return f'{prefix}{numbers.max() + 1:03d}' if len(numbers) else f'{prefix}001'


class Store:
    def __init__(self, data_dir: Path) -> None:
        path = db_path(data_dir)
        if not path.exists():
            # Lần chạy đầu: tạo CSDL từ CSV (và chuyển lượt nộp của bản cũ trong runtime/state.json nếu có)
            init_database(data_dir)
        self.con = connect(path)
        self.ds: Dataset = load_dataset_db(self.con)
        self.ds.material_sections = read_material_sections(data_dir)
        # Họ tên hiển thị (mẫu, vì dữ liệu gốc ẩn danh); lớp suy ra từ grade và group của bảng student
        self.profiles = read_table(self.con, 'student_profile').set_index('student_id')
        self.class_of = {
            str(r['student_id']): class_label(r['grade'], r['group']) for r in self.ds.student.to_dict('records')
        }
        # Đoạn văn của câu đọc hiểu; dòng chưa dán nội dung (text trống) thì bỏ qua
        passages = read_table(self.con, 'passage').fillna({'text': ''})
        self.passages = passages[passages['text'].str.strip() != '']
        self.materials_dir = data_dir / 'materials'
        # Hình biển báo / nội dung thông báo của câu hỏi; ảnh nằm trong data/media, phục vụ qua /api/media
        self.media_dir = data_dir / 'media'
        self.media: dict[str, QuestionMedia] = {}
        for r in read_table(self.con, 'question_media').fillna('').to_dict('records'):
            self.media[str(r['question_id'])] = QuestionMedia(
                kind=r['kind'],
                src=f'/api/media/{r["file"]}' if r['file'] else None,
                text=r['text'] or None,
                alt=r['alt'],
            )
        # Phần gạch chân của câu phát âm, ghi bằng ngoặc vuông, vd. "typh[oo]n"
        self.underline: dict[str, dict[str, tuple[int, int]]] = {}
        for r in read_table(self.con, 'question_underline').to_dict('records'):
            self.underline[str(r['question_id'])] = {
                opt: (str(r[f'opt_{opt.lower()}']).index('['), str(r[f'opt_{opt.lower()}']).index(']') - 1)
                for opt in 'ABCD'
            }
        self.viewed = {str(r[0]) for r in self.con.execute('SELECT attempt_id FROM attempt WHERE analysis_viewed = 1')}
        self.refresh_diagnosis()

    def close(self) -> None:
        self.con.close()

    def _append_to_dataset(self, attempts: list[dict[str, Any]], results: list[dict[str, Any]]) -> None:
        self.ds.attempt = pd.concat([self.ds.attempt, pd.DataFrame(attempts)], ignore_index=True)
        self.ds.result = pd.concat([self.ds.result, pd.DataFrame(results)], ignore_index=True)

    # Danh mục

    def student(self, student_id: str) -> Student:
        if student_id not in self.profiles.index:
            raise KeyError(f'Không tìm thấy học sinh: {student_id}')
        row = self.profiles.loc[student_id]
        return Student(student_id=student_id, full_name=str(row['full_name']), class_name=self.class_of[student_id])

    def students(self, class_name: str | None = None) -> list[Student]:
        ids = [sid for sid in self.profiles.index if class_name is None or self.class_of[sid] == class_name]
        return [self.student(sid) for sid in ids]

    def classes(self) -> list[str]:
        return sorted(set(self.class_of.values()))

    def exam(self, exam_id: str) -> Exam:
        rows = self.ds.exam[self.ds.exam['exam_id'] == exam_id]
        if rows.empty:
            raise KeyError(f'Không tìm thấy đề: {exam_id}')
        row = rows.iloc[0]
        return Exam(
            exam_id=str(row['exam_id']),
            exam_title=str(row['exam_title']),
            academic_year=str(row['academic_year']),
            grade=int(row['grade']),
            duration_minutes=int(row['duration_minutes']),
            total_questions=int(row['total_questions']),
        )

    def exams(self) -> list[Exam]:
        return [self.exam(eid) for eid in self.ds.exam['exam_id']]

    def _passage(self, exam_id: str, question_no: int) -> Passage | None:
        if self.passages.empty:
            return None
        p = self.passages
        hit = p[(p['exam_id'] == exam_id) & (p['from_no'] <= question_no) & (p['to_no'] >= question_no)]
        if hit.empty:
            return None
        row = hit.iloc[0]
        return Passage(
            passage_id=str(row['passage_id']),
            title=str(row['title']),
            from_no=int(row['from_no']),
            to_no=int(row['to_no']),
            text=str(row['text']),
        )

    def questions(self, exam_id: str) -> list[Question]:
        self.exam(exam_id)
        rows = self.ds.question[self.ds.question['exam_id'] == exam_id].sort_values('question_no')
        return [
            Question(
                question_id=q['question_id'],
                question_no=int(q['question_no']),
                question_text=q['question_text'],
                options={'A': str(q['opt_a']), 'B': str(q['opt_b']), 'C': str(q['opt_c']), 'D': str(q['opt_d'])},
                passage=self._passage(exam_id, int(q['question_no'])),
                media=self.media.get(q['question_id']),
                underline=cast('dict[Option, tuple[int, int]] | None', self.underline.get(q['question_id'])),
            )
            for q in rows.to_dict('records')
        ]

    def answers(self, attempt_id: str) -> list[AnswerReview]:
        """Xem lại bài đã nộp: mỗi câu kèm lựa chọn của học sinh, đáp án đúng và lời giải."""
        attempt = self.attempt(attempt_id)
        res = self.ds.result[self.ds.result['attempt_id'] == attempt_id].set_index('question_id')
        rows = self.ds.question[self.ds.question['exam_id'] == attempt.exam.exam_id].set_index('question_id')
        names = self.ds.skill.set_index('skill_id')['skill_name']
        reviews = []
        for q in self.questions(attempt.exam.exam_id):
            row = rows.loc[q.question_id]
            raw = res['selected_opt'].get(q.question_id)
            selected = raw if raw in ('A', 'B', 'C', 'D') else None
            correct = cast(Option, str(row['correct_opt']))
            skill_id = str(row['skill_id'])
            reviews.append(
                AnswerReview(
                    question=q,
                    selected_opt=selected,
                    correct_opt=correct,
                    is_correct=selected == correct,
                    explanation='' if pd.isna(row['explanation']) else str(row['explanation']),
                    skill_name=str(names.get(skill_id, skill_id)),
                )
            )
        return reviews

    # Lượt làm bài

    def _attempt_from_row(self, row: Mapping[Hashable, Any]) -> Attempt:
        attempt_id = str(row['attempt_id'])
        res = self.ds.result[self.ds.result['attempt_id'] == attempt_id]
        return Attempt(
            attempt_id=attempt_id,
            student=self.student(str(row['student_id'])),
            exam=self.exam(str(row['exam_id'])),
            total_score=float(row['total_score']),
            correct_count=int(res['is_correct'].sum()),
            started_at=str(row['started_at']),
            submitted_at=str(row['submitted_at']),
            diagnosed=attempt_id in self.viewed,
        )

    def attempt(self, attempt_id: str) -> Attempt:
        rows = self.ds.attempt[self.ds.attempt['attempt_id'] == attempt_id]
        if rows.empty:
            raise KeyError(f'Không tìm thấy attempt_id: {attempt_id}')
        return self._attempt_from_row(rows.iloc[0].to_dict())

    def attempts(self, student_id: str | None = None, class_name: str | None = None) -> list[Attempt]:
        rows = self.ds.attempt
        if student_id is not None:
            rows = rows[rows['student_id'] == student_id]
        if class_name is not None:
            rows = rows[rows['student_id'].isin([s.student_id for s in self.students(class_name)])]
        rows = rows.sort_values('submitted_at', ascending=False)
        return [self._attempt_from_row(r) for r in rows.to_dict('records')]

    def submit(self, req: SubmitRequest, student_id: str) -> tuple[Attempt, Notification]:
        student = self.student(student_id)
        questions = self.ds.question[self.ds.question['exam_id'] == req.exam_id]
        if questions.empty:
            raise KeyError(f'Không tìm thấy đề: {req.exam_id}')
        unknown = set(req.answers) - set(questions['question_id'])
        if unknown:
            raise ValueError(f'Câu hỏi không thuộc đề {req.exam_id}: {sorted(unknown)}')

        attempt_id = _next_id(self.ds.attempt['attempt_id'], 'ATT_')
        first_res = int(_next_id(self.ds.result['result_id'], 'RES_').removeprefix('RES_'))
        results = []
        for i, q in enumerate(questions.sort_values('question_no').to_dict('records')):
            selected = req.answers.get(q['question_id'])
            results.append(
                {
                    'result_id': f'RES_{first_res + i:03d}',
                    'attempt_id': attempt_id,
                    'question_id': q['question_id'],
                    'selected_opt': selected,
                    'is_correct': int(selected == q['correct_opt']),
                }
            )
        correct = sum(r['is_correct'] for r in results)
        submitted_at = _now()
        attempt_row = {
            'attempt_id': attempt_id,
            'student_id': student.student_id,
            'exam_id': req.exam_id,
            'started_at': req.started_at or submitted_at,
            'submitted_at': submitted_at,
            'total_score': round(correct * 10 / len(results), 2),
        }

        self._append_to_dataset([attempt_row], results)
        # Chẩn đoán chạy ngay khi nộp để giáo viên nhận được kết quả đầy đủ trong thông báo
        try:
            diagnosis = self.diagnosis(attempt_id)
        except Exception:
            self._drop_from_dataset(attempt_id)
            raise
        number = int(self.con.execute('SELECT COUNT(*) FROM notification').fetchone()[0]) + 1
        notification = {
            'notification_id': f'NOTI_{number:03d}',
            'kind': 'attempt_submitted',
            'created_at': submitted_at,
            'is_read': 0,
            'attempt_id': attempt_id,
            'weak_skill_count': diagnosis.total_weak_detected,
            'recommendation_count': len(diagnosis.recommendations),
        }
        # Một giao dịch: lượt làm, kết quả từng câu, kết quả chẩn đoán và thông báo cùng được ghi hoặc cùng không
        try:
            with self.con:
                insert_rows(self.con, 'attempt', [{**attempt_row, 'source': 'web', 'analysis_viewed': 0}])
                insert_rows(self.con, 'result', results)
                write_diagnosis(self.con, diagnosis_rows(diagnosis, DEFAULT_TOP_K), attempt_id)
                insert_rows(self.con, 'notification', [notification])
        except Exception:
            self._drop_from_dataset(attempt_id)
            raise
        return self.attempt(attempt_id), self._notification(notification)

    # Chẩn đoán

    def diagnosis(self, attempt_id: str, top_k: int = DEFAULT_TOP_K) -> Diagnosis:
        """Web chỉ dùng bộ luật hiện hành; bộ luật cũ (RULES_V3) chỉ giữ lại cho kiểm thử."""
        return Diagnosis(**recommend_for_attempt(self.ds, attempt_id, top_k=top_k, rules=DEFAULT_RULES))

    def _drop_from_dataset(self, attempt_id: str) -> None:
        self.ds.attempt = self.ds.attempt[self.ds.attempt['attempt_id'] != attempt_id]
        self.ds.result = self.ds.result[self.ds.result['attempt_id'] != attempt_id]

    # Kết quả chẩn đoán lưu thành bảng (thuật toán hiện hành, 3 học liệu như học sinh thấy)

    def refresh_diagnosis(self) -> None:
        """Tính lại kết quả chẩn đoán của mọi lượt và ghi đè 3 bảng, để luôn khớp thuật toán và dữ liệu hiện tại."""
        rows: dict[str, list[dict[str, Any]]] = {name: [] for name in DIAGNOSIS_TABLES}
        for attempt_id in self.ds.attempt['attempt_id']:
            for name, part in diagnosis_rows(self.diagnosis(str(attempt_id)), DEFAULT_TOP_K).items():
                rows[name].extend(part)
        with self.con:
            for name in DIAGNOSIS_TABLES:
                self.con.execute(f'DELETE FROM "{name}"')
                insert_rows(self.con, name, rows[name])

    # Tổng quan cho giáo viên: mọi số liệu lấy bằng câu lệnh SQL trong sql/tong_quan.sql

    def overview(self, class_name: str | None = None) -> Overview:
        con = self.con
        totals = run(con, 'totals', class_name)[0]
        return Overview(
            class_name=class_name,
            **totals,
            score_bands=[CountItem(**r) for r in run(con, 'score_bands', class_name)],
            classes=[ClassSummary(**r) for r in run(con, 'classes', class_name)],
            exams=[ExamSummary(**r) for r in run(con, 'exams', class_name)],
            group_stats=[PassRate(**r) for r in run(con, 'group_stats', class_name)],
            common_weak_skills=[CountItem(**r) for r in run(con, 'common_weak_skills', class_name)],
            top_materials=[CountItem(**r) for r in run(con, 'top_materials', class_name)],
            missing_materials=[CountItem(**r) for r in run(con, 'missing_materials', class_name)],
            attention=[
                AttemptSummary(
                    attempt=self.attempt(r['attempt_id']),
                    weak_skill_count=r['weak_skill_count'],
                    broad_weakness=bool(r['broad_weakness']),
                )
                for r in run(con, 'attention', class_name)
            ],
        )

    def results(self, class_name: str | None = None, exam_id: str | None = None) -> list[AttemptSummary]:
        """Bảng kết quả học sinh: bài gần nhất của mỗi học sinh, hoặc mọi bài của một đề (SQL `results`)."""
        return [
            AttemptSummary(
                attempt=self.attempt(r['attempt_id']),
                weak_skill_count=r['weak_skill_count'],
                broad_weakness=bool(r['broad_weakness']),
            )
            for r in run(self.con, 'results', class_name, exam_id=exam_id)
        ]

    def mark_diagnosed(self, attempt_id: str) -> None:
        self.attempt(attempt_id)
        if attempt_id not in self.viewed:
            with self.con:
                self.con.execute('UPDATE attempt SET analysis_viewed = 1 WHERE attempt_id = ?', (attempt_id,))
            self.viewed.add(attempt_id)

    # Học liệu

    def material(self, material_id: str) -> MaterialContent:
        path = self.materials_dir / f'{material_id}.json'
        if not path.is_file() or path.parent != self.materials_dir:
            raise KeyError(f'Không tìm thấy học liệu: {material_id}')
        return MaterialContent.model_validate_json(path.read_text(encoding='utf-8'))

    def latest_viewed_attempt(self, student_id: str) -> str | None:
        """Lượt làm gần nhất đã xem kết quả phân tích (giống trang Lộ trình ôn tập)."""
        return next((a.attempt_id for a in self.attempts(student_id) if a.diagnosed), None)

    def library(self, attempt_id: str | None) -> Library:
        """Kho học liệu. Có lượt làm bài thì gợi ý mức theo điểm và đánh dấu học liệu đề xuất, phần đang yếu."""
        recommended: set[str] = set()
        weak: set[str] = set()
        score: float | None = None
        if attempt_id is not None:
            dx = self.diagnosis(attempt_id)
            score = dx.total_score
            recommended = {r.material_id for r in dx.recommendations}
            weak = {t for w in dx.weak_skills for t in w.member_topics}
        cols = ['skill_id', 'skill_name', 'category', *(c for c in GROUP_COLS if c in self.ds.skill.columns)]
        rows = self.ds.material.merge(self.ds.skill[cols].drop_duplicates('skill_id'), on='skill_id', how='left')
        rows = rows.sort_values(['category', 'skill_name', 'target_level', 'material_id'])
        items = [
            LibraryItem(
                material_id=str(r['material_id']),
                title=str(r['material_title']),
                skill_id=str(r['skill_id']),
                skill_name=str(r['skill_name']),
                category=str(r['category']),
                group_name=str(r['group_name']) if pd.notna(r.get('group_name')) else None,
                level=int(r['target_level']),  # type: ignore[arg-type]
                recommended=str(r['material_id']) in recommended,
                weak=str(r['skill_id']) in weak,
            )
            for r in rows.to_dict('records')
        ]
        return Library(
            attempt_id=attempt_id,
            total_score=score,
            suggested_level=suggested_level(score) if score is not None else None,
            items=items,
        )

    # Thông báo

    def _notification(self, raw: Mapping[str, Any]) -> Notification:
        return Notification(
            id=raw['notification_id'],
            kind=raw['kind'],
            created_at=raw['created_at'],
            read=bool(raw['is_read']),
            attempt=self.attempt(raw['attempt_id']),
            weak_skill_count=raw['weak_skill_count'],
            recommendation_count=raw['recommendation_count'],
        )

    def notifications(self) -> list[Notification]:
        rows = self.con.execute('SELECT * FROM notification ORDER BY rowid DESC').fetchall()
        return [self._notification(dict(r)) for r in rows]

    def mark_read(self, notification_id: str | None = None) -> None:
        with self.con:
            if notification_id is None:
                self.con.execute('UPDATE notification SET is_read = 1')
                return
            cur = self.con.execute('UPDATE notification SET is_read = 1 WHERE notification_id = ?', (notification_id,))
        if cur.rowcount == 0:
            raise KeyError(f'Không tìm thấy thông báo: {notification_id}')
