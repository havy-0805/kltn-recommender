"""Kiểm tra chất lượng dữ liệu (tiêu chí "độ sạch dữ liệu" của đề cương, mục 10.2).

Chạy: uv run python -m scripts.validate_data  -> data/export/kiem-tra-du-lieu.md (+ .csv các dòng lệch đáp án)
Không sửa dữ liệu; chỉ báo cáo để người phụ trách đối chiếu với bài làm gốc.
Chạy lại mỗi khi thêm đề, câu hỏi hoặc học liệu: mục 4 cho biết chuyên đề nào cần bổ sung học liệu.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from engine import Dataset, load_dataset, to_topic

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / 'data' / 'export'


def fk_violations(ds: Dataset) -> list[tuple[str, int]]:
    """(mô tả ràng buộc, số dòng vi phạm)."""
    topics = set(ds.skill['skill_id'])
    checks = [
        ('Attempt.student_id ∈ Student', ~ds.attempt['student_id'].isin(ds.student['student_id'])),
        ('Attempt.exam_id ∈ Exam', ~ds.attempt['exam_id'].isin(ds.exam['exam_id'])),
        ('Question.exam_id ∈ Exam', ~ds.question['exam_id'].isin(ds.exam['exam_id'])),
        ('Question.skill_id (sau ánh xạ) ∈ Skill', ~ds.question['skill_id'].map(to_topic).isin(topics)),
        ('Material.skill_id ∈ Skill', ~ds.material['skill_id'].isin(topics)),
        ('Result.attempt_id ∈ Attempt', ~ds.result['attempt_id'].isin(ds.attempt['attempt_id'])),
        ('Result.question_id ∈ Question', ~ds.result['question_id'].isin(ds.question['question_id'])),
        ('Question.difficulty ∈ {1,2,3}', ~ds.question['difficulty'].isin([1, 2, 3])),
        ('Material.target_level ∈ {1,2,3}', ~ds.material['target_level'].isin([1, 2, 3])),
        ('Question.correct_opt ∈ {A,B,C,D}', ~ds.question['correct_opt'].isin(list('ABCD'))),
    ]
    dup = [
        ('question_id không trùng', ds.question['question_id'].duplicated()),
        ('result_id không trùng', ds.result['result_id'].duplicated()),
        ('(attempt_id, question_id) không trùng', ds.result.duplicated(['attempt_id', 'question_id'])),
    ]
    return [(name, int(mask.sum())) for name, mask in checks + dup]


def answer_mismatches(ds: Dataset) -> pd.DataFrame:
    """Dòng Result có is_correct khác với (selected_opt == correct_opt)."""
    r = ds.result.merge(ds.question[['question_id', 'exam_id', 'question_no', 'correct_opt']], on='question_id')
    expected = (r['selected_opt'] == r['correct_opt']).astype(int)
    return r[expected != r['is_correct']]


def score_mismatches(ds: Dataset) -> pd.DataFrame:
    n_q = ds.question.groupby('exam_id').size().rename('n_q')
    correct = ds.result.groupby('attempt_id')['is_correct'].sum().rename('correct')
    a = ds.attempt.join(correct, on='attempt_id').join(n_q, on='exam_id')
    a['computed'] = (a['correct'] * 10 / a['n_q']).round(2)
    return a[(a['computed'] - a['total_score']).abs() > 0.01]


LEVELS = (1, 2, 3)
# Mức độ nghiêm trọng của chỗ thiếu học liệu, theo hệ quả với thuật toán
NO_MATERIAL = 'Không có học liệu'  # BR-REC-06: điểm yếu Top 3 bị bỏ qua với mọi học sinh
ONLY_LEVEL_1 = 'Chỉ có Level 1'  # BR-REC-04: học sinh từ 8 điểm không nhận được học liệu
MISSING_LEVEL = 'Thiếu cấp độ'  # BR-EDGE-07: vẫn đề xuất, dùng cấp độ gần nhất
SEVERITY = (NO_MATERIAL, ONLY_LEVEL_1, MISSING_LEVEL)


def material_coverage(ds: Dataset) -> pd.DataFrame:
    """Chuyên đề thiếu học liệu ở cấp độ nào, kèm số câu hỏi của chuyên đề (câu càng nhiều càng cần bổ sung sớm)."""
    levels: dict[str, set[int]] = {}
    for skill_id, level in zip(ds.material['skill_id'], ds.material['target_level'], strict=True):
        levels.setdefault(str(skill_id), set()).add(int(level))
    n_q = ds.question['skill_id'].map(to_topic).value_counts()
    rows = []
    for sk in ds.skill.to_dict('records'):
        have = levels.get(sk['skill_id'], set())
        missing = [lv for lv in LEVELS if lv not in have]
        if not missing:
            continue
        severity = NO_MATERIAL if not have else ONLY_LEVEL_1 if have == {1} else MISSING_LEVEL
        rows.append(
            {
                'skill_id': sk['skill_id'],
                'skill_name': sk['skill_name'],
                'questions': int(n_q.get(sk['skill_id'], 0)),
                'levels': ', '.join(str(lv) for lv in sorted(have)) or '—',
                'missing': ', '.join(str(lv) for lv in missing),
                'severity': severity,
            }
        )
    frame = pd.DataFrame(rows, columns=['skill_id', 'skill_name', 'questions', 'levels', 'missing', 'severity'])
    order = frame['severity'].map({name: i for i, name in enumerate(SEVERITY)})
    return (
        frame.assign(_o=order)
        .sort_values(['_o', 'questions', 'skill_id'], ascending=[True, False, True])
        .drop(columns='_o')
    )


def _credited(options: pd.Series) -> str:
    """Các phương án khác đáp án nhưng vẫn được ghi is_correct = 1 (ô trống trong cột là dòng không được tính)."""
    return ', '.join(sorted(set(options.dropna().astype(str))))


def main() -> None:
    ds = load_dataset(ROOT / 'data')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fk = fk_violations(ds)
    mism = answer_mismatches(ds)
    mism.to_csv(OUT_DIR / 'lech-dap-an.csv', index=False, encoding='utf-8-sig')
    scores = score_mismatches(ds)
    # Phương án được chấm đúng dù khác đáp án; dòng is_correct = 0 để trống
    credited = mism['selected_opt'].fillna('(trống)').where(mism['is_correct'] == 1)
    per_q = (
        mism.assign(credited=credited)
        .groupby(['exam_id', 'question_no', 'question_id', 'correct_opt'])
        .agg(so_dong=('result_id', 'count'), chon_duoc_cham_dung=('credited', _credited))
        .reset_index()
        .sort_values('so_dong', ascending=False)
    )
    per_attempt = mism.groupby('attempt_id').size().sort_values(ascending=False)
    coverage = material_coverage(ds)
    by_severity = coverage['severity'].value_counts()

    lines = [
        '# Kiểm tra chất lượng dữ liệu',
        '',
        'Sinh tự động bởi `backend/validate_data.py`. Script chỉ báo cáo, không sửa dữ liệu.',
        '',
        f'Quy mô: {len(ds.student)} học sinh, {len(ds.exam)} đề, {len(ds.question)} câu hỏi, '
        f'{len(ds.material)} học liệu, {len(ds.attempt)} lượt làm, {len(ds.result)} kết quả chi tiết.',
        '',
        '## 1. Toàn vẹn khóa và miền giá trị',
        '',
        '| Ràng buộc | Số dòng vi phạm |',
        '|---|---|',
        *[f'| {name} | {n} |' for name, n in fk],
        '',
        '## 2. Điểm tổng so với kết quả từng câu',
        '',
        f'{len(scores)} lượt có điểm lệch với (số câu đúng × 10 / số câu).',
        '',
        '## 3. Kết quả từng câu so với đáp án',
        '',
        f'**{len(mism)}/{len(ds.result)} dòng ({len(mism) / len(ds.result):.1%})** có `is_correct` khác với việc so '
        '`selected_opt` với `correct_opt`. Engine chẩn đoán theo `is_correct`, '
        'còn web chấm bài mới theo `correct_opt`, nên cần xác định bên nào đúng bằng cách đối chiếu bài làm gốc.',
        '',
        'Theo lượt làm (nhiều dòng lệch ở một lượt thường do nhập nhầm hàng):',
        '',
        '| Lượt | Số dòng lệch |',
        '|---|---|',
        *[f'| {a} | {n} |' for a, n in per_attempt.head(10).items()],
        '',
        'Theo câu hỏi (nhiều dòng lệch ở một câu thường do đáp án dùng khi chấm khác đáp án trong `question.csv`):',
        '',
        '| Đề | Câu | Mã | Đáp án trong CSV | Số dòng lệch | Phương án được chấm đúng dù khác đáp án |',
        '|---|---|---|---|---|---|',
        *[
            f'| {r["exam_id"]} | {r["question_no"]} | {r["question_id"]} | {r["correct_opt"]} | {r["so_dong"]} | '
            f'{r["chon_duoc_cham_dung"] or "—"} |'
            for r in per_q.head(15).to_dict('records')
        ],
        '',
        'Danh sách đầy đủ: `lech-dap-an.csv`.',
        '',
        '## 4. Độ phủ của kho học liệu',
        '',
        'Mỗi chuyên đề nên có học liệu ở cả ba cấp độ. Chỗ thiếu ảnh hưởng tới đề xuất như sau:',
        '',
        f'- **{NO_MATERIAL}** ({by_severity.get(NO_MATERIAL, 0)} chuyên đề): điểm yếu này lọt Top 3 thì bị bỏ qua '
        'với mọi học sinh, không lấy điểm yếu hạng 4 thay vào (BR-REC-06). Cần bổ sung trước.',
        f'- **{ONLY_LEVEL_1}** ({by_severity.get(ONLY_LEVEL_1, 0)} chuyên đề): học sinh từ 8 điểm không nhận '
        'học liệu Level 1 (BR-REC-04) nên bị bỏ qua như trên.',
        f'- **{MISSING_LEVEL}** ({by_severity.get(MISSING_LEVEL, 0)} chuyên đề): vẫn có đề xuất, hệ thống dùng '
        'cấp độ gần nhất (BR-EDGE-07).',
        '',
        'Trang Tổng quan lớp của giáo viên liệt kê các điểm yếu Top 3 thực tế đã bị bỏ qua vì thiếu học liệu.',
        '',
        *(
            ['Mọi chuyên đề đều có học liệu ở cả ba cấp độ.']
            if coverage.empty
            else [
                '| Mức | Chuyên đề | Mã | Số câu hỏi | Cấp độ đã có | Cấp độ còn thiếu |',
                '|---|---|---|---|---|---|',
                *[
                    f'| {r["severity"]} | {r["skill_name"]} | {r["skill_id"]} | {r["questions"]} | {r["levels"]} | '
                    f'{r["missing"]} |'
                    for r in coverage.to_dict('records')
                ],
            ]
        ),
    ]
    (OUT_DIR / 'kiem-tra-du-lieu.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
