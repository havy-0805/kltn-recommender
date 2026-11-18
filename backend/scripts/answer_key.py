"""Phiếu đáp án cho người điều khiển buổi demo/dùng thử.

Chạy: uv run python -m scripts.answer_key EXAM_G9_02 EXAM_G9_DIAG_01  -> data/export/dap-an-<exam_id>.md
"""

from __future__ import annotations

import sys
from pathlib import Path

from engine import has_groups, load_dataset, question_error_types, to_topic

ROOT = Path(__file__).resolve().parents[2]


def main(exam_ids: list[str]) -> None:
    ds = load_dataset(ROOT / 'data')
    names = dict(zip(ds.skill['skill_id'], ds.skill['skill_name'], strict=True))
    groups = dict(zip(ds.skill['skill_id'], ds.skill['group_name'], strict=True)) if has_groups(ds) else {}
    q_types = question_error_types(ds)
    type_names = {} if ds.error_type is None else dict(
        zip(ds.error_type['error_type'], ds.error_type['error_name'], strict=True))
    out_dir = ROOT / 'data' / 'export'
    out_dir.mkdir(parents=True, exist_ok=True)

    for exam_id in exam_ids:
        exam = ds.exam[ds.exam['exam_id'] == exam_id].iloc[0]
        q = ds.question[ds.question['exam_id'] == exam_id].assign(
            topic=lambda d: d['skill_id'].map(to_topic)).sort_values('question_no')
        per_topic = q['topic'].value_counts()
        lines = [
            f"# Phiếu đáp án: {exam_id} ({exam['exam_title']})",
            '',
            'Dùng cho người điều khiển buổi demo, **không đưa cho người làm thử**. '
            'Cột "Số câu cùng chuyên đề" cho biết chuyên đề có đủ 2 câu để hệ thống kết luận hay không. '
            'Sinh bằng `backend/answer_key.py`.',
            '',
            '| Câu | Đáp án | Chuyên đề | Số câu cùng chuyên đề | Nhóm kiến thức | Dạng lỗi | Độ khó |',
            '|---|---|---|---|---|---|---|',
        ]
        for r in q.to_dict('records'):
            etype = type_names.get(q_types.get(r['question_id'], ''), '')
            lines.append(f"| {r['question_no']} | {r['correct_opt']} | {names.get(r['topic'], r['topic'])} | "
                         f"{per_topic[r['topic']]} | {groups.get(r['topic'], '')} | {etype} | {r['difficulty']} |")
        (out_dir / f'dap-an-{exam_id}.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
        print('✓', exam_id)


if __name__ == '__main__':
    main(sys.argv[1:])
