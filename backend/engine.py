"""Thuật toán khuyến nghị học liệu rule-based.

Hai bộ luật cùng chạy trên một mã nguồn để so sánh trước/sau:
- RULES_V3: bản tách từ notebook KLTN v3 (giữ nguyên để đối chiếu).
- RULES_V4: bản sửa theo góp ý của giảng viên và kết quả thẩm định (mặc định).
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import pandas as pd

CSV_PREFIX = 'Dữ liệu mẫu - '
# Đề do nhóm nghiên cứu soạn thêm (không lẫn với dữ liệu gốc thu từ cơ sở): nối vào sau bảng gốc cùng tên
SUPPLEMENT_PREFIX = 'Đề bổ sung - '
# Dạng lỗi trong từng chuyên đề: danh mục, dạng lỗi mà học liệu có dạy (nhãn câu hỏi là cột question.error_type)
ERROR_TYPE_FILE = 'error_type.csv'
MATERIAL_ERROR_TYPE_FILE = 'material_error_type.csv'

# Ánh xạ từ kỹ năng vi mô trong câu hỏi -> Chuyên đề tài liệu tương ứng
TAXONOMY_MAP = {
    # 1. NGỮ ÂM
    'SK_PHON_OO': 'SK_PHON_PRON',
    'SK_PHON_SES': 'SK_PHON_PRON',
    'SK_PHON_VOWEL': 'SK_PHON_PRON',
    'SK_PHON_DIPHTHONG': 'SK_PHON_PRON',
    'SK_STRESS_02': 'SK_PHON_STRESS',
    'SK_STRESS_03': 'SK_PHON_STRESS',
    'SK_PHON_STRESS': 'SK_PHON_STRESS',
    # 2. NGỮ PHÁP (GRAMMAR)
    'SK_TENSE_PAST_CONT': 'SK_TENSE_ASPECT',
    'SK_CONJ_ADV': 'SK_CONJUNCTIONS',
    'SK_WISH_PRES': 'SK_WISH',
    'SK_REL_CLAUSE': 'SK_REL_CLAUSE',
    'SK_QUANTIFIER': 'SK_QUANTIFIER',
    'SK_ADJ_PARTICIPLE': 'SK_ADJ_STRUCTURE',
    'SK_PREPOSITION': 'SK_PREPOSITION',
    'SK_CLOZE_PREP': 'SK_PREPOSITION',
    'SK_PREP_TIME_PLACE': 'SK_PREPOSITION',
    'SK_PARTICIPLE_CLAUSE': 'SK_PARTICIPLE',
    'SK_PARTICIPLE': 'SK_PARTICIPLE',
    'SK_PARALLEL_ADJ': 'SK_COMPARATIVE',
    'SK_COMPARATIVE': 'SK_COMPARATIVE',
    'SK_GERUND_TROUBLE': 'SK_VERB_FORMS',
    'SK_GERUND_01': 'SK_VERB_FORMS',
    'SK_ADV_FREQ': 'SK_ADV_FREQ',
    'SK_TRANS_UNLESS': 'SK_CONDITIONAL',
    'SK_COND_UNLESS': 'SK_CONDITIONAL',
    'SK_TRANS_REASON': 'SK_COMPLEX_SENT',
    'SK_SENT_WHILE': 'SK_COMPLEX_SENT',
    'SK_SENT_STRUCTURE': 'SK_SENT_TRANS',
    'SK_SENT_TRANS': 'SK_SENT_TRANS',
    # 3. TỪ VỰNG & COLLOCATION
    'SK_COLLOC_HABIT': 'SK_COLLOCATION',
    'SK_COLLOC_FIT': 'SK_COLLOCATION',
    'SK_COLLOCATION': 'SK_COLLOCATION',
    'SK_VOCAB_HOBBY': 'SK_VOCAB_HOBBY',
    'SK_VOCAB_DISASTER': 'SK_VOCAB_DISASTER',
    'SK_VOCAB_HEALTH': 'SK_VOCAB_HEALTH',
    'SK_VOCAB_CITY': 'SK_VOCAB_CITY',
    'SK_WORD_FORM': 'SK_WORD_FORM',
    'SK_PHRASAL_V': 'SK_PHRASAL_VERBS',
    # 4. GIAO TIẾP
    'SK_COMM_SUGGEST': 'SK_COMM_FUNC',
    'SK_COMM_01': 'SK_COMM_FUNC',
    # 5. ĐỌC HIỂU & KỸ NĂNG VIẾT
    'SK_TEXT_ORG': 'SK_TEXT_ORG',
    'SK_TEXT_COHES': 'SK_TEXT_COHES',
    'SK_SIGN_READ': 'SK_SIGN_NOTICE',
    'SK_NOTICE_READ': 'SK_SIGN_NOTICE',
    'SK_SIGN_NOTICE': 'SK_SIGN_NOTICE',
    'SK_READ_SYN': 'SK_SYNONYM_ANTONYM',
    'SK_READ_ANT': 'SK_SYNONYM_ANTONYM',
    'SK_READ_DETAIL': 'SK_READ_DETAIL',
    'SK_READ_DETAIL_NEW': 'SK_READ_DETAIL',
    'SK_READ_NOTTRUE': 'SK_READ_NOTTRUE',
    'SK_READ_MAIN': 'SK_READ_MAIN',
    'SK_READ_TITLE': 'SK_READ_TITLE',
    'SK_CLOZE_TEXT': 'SK_READ_CLOZE',
    'SK_CLOZE': 'SK_READ_CLOZE',
    'SK_READ_GAPPED': 'SK_READ_GAPPED',
    'SK_ERROR_ID': 'SK_ERROR_CORRECTION',
    'SK_ERROR_CORRECTION': 'SK_ERROR_CORRECTION'
}

# BR-PRIO-03: Trọng số theo danh mục
CATEGORY_WEIGHTS = {
    'Ngữ âm': 1.2, 'Ngữ pháp': 1.2, 'Từ vựng - Ngữ pháp': 1.1,
    'Từ vựng': 1.0, 'Giao tiếp': 0.8, 'Kỹ năng đọc - viết': 0.8,
    'Đọc hiểu': 0.8, 'Kỹ năng tổng hợp': 0.8
}

# BR-REC-05: Tiêu đề bao quát ("Cẩm nang", "Chuyên đề"...) được ưu tiên trước
GENERIC_TITLE_PATTERN = 'cẩm nang|trọn bộ|chuyên đề|bí kíp'


@dataclass(frozen=True)
class RuleSet:
    """Tham số của bộ luật. Mỗi trường ứng với một quyết định thiết kế ghi trong báo cáo."""

    version: str
    # BR-DIAG-00: số câu tối thiểu của một chuyên đề trong đề để được kết luận (1 câu chưa đủ để kiểm chứng)
    min_questions: int
    # BR-DIAG-00: chuyên đề không đủ câu được gộp lên nhóm kiến thức (cột skill.group_id)
    group_rollup: bool
    # BR-EDGE-08/10: điểm tối thiểu để vào chế độ bồi dưỡng khi không có kỹ năng yếu
    mastery_score: float
    # BR-EDGE-08: chọn học liệu nâng cao theo các chuyên đề còn sai thay vì lấy theo mã học liệu
    personalized_mastery: bool
    # BR-REC-05: khi nhiều chuyên đề cùng nhóm, ưu tiên học liệu của chuyên đề học sinh sai nhiều nhất
    match_error_topic: bool
    # BR-EDGE-12: tính lại điểm tổng từ kết quả từng câu trước khi áp luật
    verify_score: bool
    # BR-REC-05b: ưu tiên học liệu dạy đúng dạng lỗi học sinh mắc, kể cả khi lệch 1 Level so với mục tiêu
    match_error_type: bool
    # BR-EDGE-10: điểm dưới mastery_score mà không có điểm yếu thì vẫn đề xuất học liệu củng cố
    # cho chuyên đề còn sai (bản cũ: không đề xuất gì)
    consolidate: bool = False
    # BR-DIAG-02: số câu cơ bản sai tối thiểu để kết luận Hổng kiến thức nền (1 câu có thể chỉ là sơ suất).
    # Học sinh >= 8.0 sai câu cơ bản vẫn nhận Level 2 rà soát bẫy (BR-REC-04), không phụ thuộc ngưỡng này.
    min_basic_wrong: int = 1
    # BR-DIAG-01, BR-EDGE-09: số câu sai tối thiểu của đơn vị để kết luận điểm yếu (đơn vị 2 câu sai 1 câu là 50%
    # nhưng chỉ dựa trên một câu, có thể là sơ suất; theo góp ý thẩm định lại của giáo viên B)
    min_wrong: int = 1
    # BR-REC-07: khi số điểm yếu ít hơn K, bù chỗ trống bằng đơn vị sai ≥ 50% nhưng chưa đủ số câu sai để kết luận
    # (gắn nhãn "Nên ôn thêm", không tính là điểm yếu)
    fill_tentative: bool = False
    # BR-DIAG-01 (cộng dồn bằng chứng): đơn vị mới sai 1 câu (tỷ lệ sai ≥ 50%) nhưng ở bài làm gần nhất trước đó
    # học sinh cũng sai chuyên đề này thì đủ bằng chứng để kết luận điểm yếu
    confirm_previous: bool = False


RULES_V3 = RuleSet('v3', min_questions=1, group_rollup=False, mastery_score=9.0, personalized_mastery=False,
                   match_error_topic=False, verify_score=False, match_error_type=False)
RULES_V4 = RuleSet('v4', min_questions=2, group_rollup=True, mastery_score=8.0, personalized_mastery=True,
                   match_error_topic=True, verify_score=True, match_error_type=True, consolidate=True,
                   min_basic_wrong=2, min_wrong=2, fill_tentative=True, confirm_previous=True)
DEFAULT_RULES = RULES_V4


def suggested_level(total_score: float) -> Literal[1, 2, 3]:
    """Mức học liệu vừa sức theo điểm tổng, cùng mốc với BR-REC-04 khi không có hổng kiến thức nền.

    Dùng cho Kho học liệu: < 5.0 → Level 1, 5.0–7.75 → Level 2, ≥ 8.0 → Level 3.
    """
    if total_score < 5.0:
        return 1
    return 2 if total_score < 8.0 else 3
RULESETS = {r.version: r for r in (RULES_V3, RULES_V4)}


@dataclass
class Dataset:
    student: pd.DataFrame
    exam: pd.DataFrame
    # Cột tùy chọn group_id, group_name: nhóm kiến thức. Thiếu thì mỗi chuyên đề là một nhóm riêng.
    skill: pd.DataFrame
    # Cột tùy chọn error_type: dạng lỗi câu hỏi kiểm tra (để trống nếu chưa gắn nhãn)
    question: pd.DataFrame
    material: pd.DataFrame
    attempt: pd.DataFrame
    result: pd.DataFrame
    # Dạng lỗi (error_type, skill_id, error_name); dạng lỗi học liệu có dạy (material_id, error_type).
    # Thiếu một trong hai, hoặc question thiếu cột error_type, thì bỏ qua BR-REC-05b.
    error_type: pd.DataFrame | None = None
    material_error_type: pd.DataFrame | None = None
    # Tên các mục lý thuyết của từng học liệu (data/materials/<id>.json), để lý do nêu học liệu dạy phần nào
    material_sections: dict[str, list[str]] | None = None


def read_material_sections(data_dir: Path) -> dict[str, list[str]]:
    """material_id -> tên các mục lý thuyết (theory[].heading) của học liệu."""
    out: dict[str, list[str]] = {}
    for path in sorted((data_dir / 'materials').glob('*.json')):
        try:
            content = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        heads = [str(s.get('heading', '')).strip() for s in content.get('theory', []) if isinstance(s, dict)]
        out[str(content.get('material_id', path.stem))] = [h for h in heads if h]
    return out


def load_dataset(data_dir: Path) -> Dataset:
    def read(name: str) -> pd.DataFrame:
        frame = pd.read_csv(data_dir / f'{CSV_PREFIX}{name}.csv')
        extra = data_dir / f'{SUPPLEMENT_PREFIX}{name}.csv'
        return pd.concat([frame, pd.read_csv(extra)], ignore_index=True) if extra.exists() else frame

    question = read('question')
    # Số thứ tự câu trong đề (1..40), dùng để hiển thị "sai câu 14, 21"
    question['question_no'] = question.groupby('exam_id').cumcount() + 1

    def optional(file: str) -> pd.DataFrame | None:
        path = data_dir / file
        return pd.read_csv(path) if path.exists() else None

    return Dataset(
        student=read('student'),
        exam=read('exam'),
        skill=read('skill'),
        question=question,
        material=read('material'),
        attempt=read('attempt'),
        result=read('result'),
        error_type=optional(ERROR_TYPE_FILE),
        material_error_type=optional(MATERIAL_ERROR_TYPE_FILE),
        material_sections=read_material_sections(data_dir),
    )


GROUP_COLS = ['group_id', 'group_name']


def has_groups(ds: Dataset) -> bool:
    return set(GROUP_COLS) <= set(ds.skill.columns)


def question_error_types(ds: Dataset) -> dict[str, str]:
    """question_id -> dạng lỗi, chỉ các câu đã gắn nhãn."""
    if 'error_type' not in ds.question:
        return {}
    tagged = ds.question.dropna(subset=['error_type'])
    return dict(zip(tagged['question_id'], tagged['error_type'], strict=True))


def to_topic(skill_id: str) -> str:
    """Kỹ năng vi mô của câu hỏi -> chuyên đề học liệu."""
    return TAXONOMY_MAP.get(skill_id, skill_id)


def _with_tie_score(mats: pd.DataFrame) -> pd.DataFrame:
    title = mats['material_title'].astype(str).str.lower()
    return mats.assign(tie_score=(~title.str.contains(GENERIC_TITLE_PATTERN)).astype(int))


def _stats_text(incorrect: int, total: int) -> str:
    return f'{incorrect}/{total} ({incorrect / total:.0%})'


def _pass_rates(sub_res: pd.DataFrame, key: str, name: str) -> list[dict[str, Any]]:
    """Tỷ lệ đạt theo nhóm (danh mục hoặc nhóm kiến thức), sắp từ thấp đến cao."""
    agg = sub_res.groupby([key, name], as_index=False).agg(
        total_q=('question_id', 'count'), correct_q=('is_correct', 'sum'))
    agg['pass_rate'] = (agg['correct_q'] / agg['total_q']).round(4)
    agg = agg.sort_values(by=['pass_rate', key])
    return [{'id': str(r[key]), 'name': str(r[name]), 'correct_q': int(r['correct_q']),
             'total_q': int(r['total_q']), 'pass_rate': float(r['pass_rate'])}
            for r in agg.to_dict('records')]


def _diagnosable_units(skill_stats: pd.DataFrame, rules: RuleSet) -> tuple[pd.DataFrame, pd.DataFrame]:
    """BR-DIAG-00: đơn vị được chẩn đoán gồm chuyên đề đủ câu và nhóm gộp từ các chuyên đề ít câu.

    Trả về (units, insufficient). insufficient là chuyên đề không đủ câu kể cả sau khi gộp nhóm.
    """
    topics = skill_stats.assign(scope='topic', member_topics=skill_stats['skill_id'].map(lambda s: [s]))
    enough = topics['total_q'] >= rules.min_questions
    units, small = topics[enough], topics[~enough]
    if small.empty or not rules.group_rollup:
        return units, small

    pooled = small.groupby(['group_id', 'group_name'], as_index=False).agg(
        total_q=('total_q', 'sum'), incorrect_q=('incorrect_q', 'sum'),
        total_l1_q=('total_l1_q', 'sum'), incorrect_l1_q=('incorrect_l1_q', 'sum'),
        member_topics=('skill_id', list),
        # Nhóm lấy danh mục có trọng số cao nhất trong các chuyên đề thành viên
        category=('category', lambda c: max(c, key=lambda x: (CATEGORY_WEIGHTS.get(x, 1.0), x))))
    pooled = pooled[pooled['total_q'] >= rules.min_questions]
    pooled = pooled.rename(columns={'group_id': 'skill_id', 'group_name': 'skill_name'}).assign(scope='group')
    grouped_topics = {t for members in pooled['member_topics'] for t in members}
    insufficient = small[~small['skill_id'].isin(grouped_topics)]
    return pd.concat([units, pooled], ignore_index=True), insufficient


def _previous_errors(ds: Dataset, student_id: str, submitted_at: str) -> dict[str, tuple[list[int], int]]:
    """Lỗi cũ theo chuyên đề, xét mọi bài làm trước submitted_at của học sinh (mới nhất trước).

    Với mỗi chuyên đề, bỏ qua các bài không có câu thuộc chuyên đề đó; dừng ở bài gần nhất có chuyên đề:
    nếu bài đó sai thì trả (câu sai ở bài đó, số bài liên tiếp có chuyên đề này mà đều sai), đúng hết thì bỏ qua
    (học sinh đã làm đúng phần này ở lần gần nhất). {} nếu đây là bài đầu.
    """
    att = ds.attempt
    prev = att[(att['student_id'].astype(str) == student_id) & (att['submitted_at'].astype(str) < submitted_at)]
    if prev.empty:
        return {}
    order = prev.sort_values(['submitted_at', 'attempt_id'], ascending=False)['attempt_id'].tolist()
    res = ds.result[ds.result['attempt_id'].isin(order)].merge(
        ds.question[['question_id', 'question_no', 'skill_id']], on='question_id', how='inner')
    res = res.assign(topic=res['skill_id'].map(lambda s: to_topic(str(s))))
    out: dict[str, tuple[list[int], int]] = {}
    for topic, rows in res.groupby('topic'):
        nos: list[int] = []
        streak = 0
        for att_id in order:
            here = rows[rows['attempt_id'] == att_id]
            if here.empty:
                continue                       # bài này không có câu thuộc chuyên đề: xét tiếp bài cũ hơn
            wrong = here[here['is_correct'].eq(0)]
            if wrong.empty:
                break                          # lần gần nhất có chuyên đề này đã làm đúng hết
            if not streak:
                nos = sorted(int(n) for n in wrong['question_no'])
            streak += 1
        if streak:
            out[str(topic)] = (nos, streak)
    return out


def _score_text(score: float) -> str:
    """7 -> '7.0', 7.75 -> '7.75' (thang 10)."""
    text = f'{score:.2f}'.rstrip('0')
    return text + '0' if text.endswith('.') else text


def _diagnosis_reason(incorrect: int, total: int, wrong_nos: list[int], incorrect_l1: int, total_l1: int) -> str:
    text = f'Sai {_stats_text(incorrect, total)}'
    if wrong_nos:
        text += (' ở câu ' if len(wrong_nos) == 1 else ' ở các câu ') + ', '.join(map(str, wrong_nos))
    if total_l1:
        text += f'; sai {incorrect_l1}/{total_l1} câu cơ bản'
    else:
        text += '; không có câu cơ bản (đều là câu vận dụng)'
    return text


def _level_reason(total_score: float, is_critical: bool, target_lvl: int, basic_slip: bool = False) -> str:
    """basic_slip: sai ≥ 50% câu cơ bản nhưng chưa đủ số câu để kết luận Hổng kiến thức nền."""
    score = _score_text(total_score)
    if total_score < 5.0:
        band = f'điểm {score} < 5.0 nên ôn nền tảng'
    elif total_score < 8.0:
        band = f'điểm {score} trong khoảng 5.0–7.75'
        if is_critical:
            band += ', nhưng sai câu cơ bản nên hạ về nền tảng'
        elif basic_slip:
            band += ', chỉ sai 1 câu cơ bản nên chưa coi là hổng kiến thức nền'
    else:
        band = f'điểm {score} ≥ 8.0 nên không nhận Level 1' + (
            ', sai câu cơ bản nên rà soát bẫy' if is_critical or basic_slip else ', sai câu khó nên luyện vận dụng cao')
    return f'{band} → Level {target_lvl}'


def recommend_for_attempt(ds: Dataset, attempt_id: str, top_k: int = 3,
                          rules: RuleSet = DEFAULT_RULES) -> dict[str, Any]:
    # 1. Trích xuất thông tin lượt làm bài
    att_rows = ds.attempt[ds.attempt['attempt_id'] == attempt_id]
    if att_rows.empty:
        raise KeyError(f'Không tìm thấy attempt_id: {attempt_id}')
    att_row = att_rows.iloc[0]
    exam_id = str(att_row['exam_id'])
    recorded_score = float(att_row['total_score'])
    total_score = recorded_score

    result: dict[str, Any] = {
        'attempt_id': attempt_id,
        'student_id': str(att_row['student_id']),
        'exam_id': exam_id,
        'total_score': total_score,
        'status': 'NO_DATA',
        'total_weak_detected': 0,
        'broad_weakness_activated': False,
        'weak_skills': [],
        'recommendations': [],
        'rules_version': rules.version,
        'recorded_score': recorded_score,
        'score_verified': True,
        'category_stats': [],
        'group_stats': [],
        'insufficient_skills': [],
    }

    # 2. Ghép kết quả làm bài với câu hỏi tương ứng theo đúng exam_id
    q_exam = ds.question.loc[ds.question['exam_id'] == exam_id,
                             ['question_id', 'question_no', 'skill_id', 'difficulty']]
    sub_res = ds.result[ds.result['attempt_id'] == attempt_id].merge(q_exam, on='question_id', how='inner')

    # BR-EDGE-11: Thiếu dữ liệu bài làm
    if sub_res.empty:
        return result

    # BR-EDGE-12: Điểm tổng phải khớp với kết quả từng câu (điểm = số câu đúng × 10 / số câu của đề)
    if rules.verify_score:
        computed = round(float(sub_res['is_correct'].sum()) * 10 / len(q_exam), 2)
        if abs(computed - recorded_score) > 0.01:
            total_score = computed
            result['total_score'] = computed
            result['score_verified'] = False

    # Ánh xạ từ kỹ năng câu hỏi sang Chuyên đề tinh gọn, rồi sang nhóm kiến thức
    sub_res['skill_id'] = sub_res['skill_id'].map(to_topic)
    skill_cols = ['skill_id', 'skill_name', 'category', *(GROUP_COLS if has_groups(ds) else [])]
    sub_res = sub_res.merge(ds.skill[skill_cols].drop_duplicates('skill_id'), on='skill_id', how='left')
    sub_res['skill_name'] = sub_res['skill_name'].fillna(sub_res['skill_id'])
    sub_res['category'] = sub_res['category'].fillna('Khác')
    if not has_groups(ds):
        sub_res = sub_res.assign(group_id=None, group_name=None)
    sub_res['group_id'] = sub_res['group_id'].fillna(sub_res['skill_id'])
    sub_res['group_name'] = sub_res['group_name'].fillna(sub_res['skill_name'])

    sub_res['is_err'] = sub_res['is_correct'].eq(0)
    sub_res['is_l1'] = sub_res['difficulty'].eq(1)
    sub_res['is_err_l1'] = sub_res['is_err'] & sub_res['is_l1']

    # Tỷ lệ đạt theo danh mục và theo nhóm kiến thức (hiển thị cho học sinh, giáo viên)
    result['category_stats'] = _pass_rates(sub_res, 'category', 'category')
    result['group_stats'] = _pass_rates(sub_res, 'group_id', 'group_name')

    # 3. Thống kê theo từng chuyên đề
    skill_stats = sub_res.groupby(['skill_id', 'skill_name', 'category', 'group_id', 'group_name'],
                                  as_index=False).agg(
        total_q=('question_id', 'count'),
        incorrect_q=('is_err', 'sum'),
        total_l1_q=('is_l1', 'sum'),
        incorrect_l1_q=('is_err_l1', 'sum')
    )
    wrong_nos = (sub_res[sub_res['is_err']].sort_values('question_no')
                 .groupby('skill_id')['question_no'].apply(list))
    errors_by_topic = skill_stats.set_index('skill_id')['incorrect_q']
    names = skill_stats.set_index('skill_id')['skill_name']
    wrong_types, material_types, type_names = _error_type_lookup(ds, sub_res)

    # BR-DIAG-00: Chỉ chẩn đoán chuyên đề (hoặc nhóm) có đủ số câu
    units, insufficient = _diagnosable_units(skill_stats, rules)
    result['insufficient_skills'] = [{
        'skill_id': str(sk['skill_id']),
        'skill_name': str(sk['skill_name']),
        'category': str(sk['category']),
        'error_stats': _stats_text(int(sk['incorrect_q']), int(sk['total_q'])),
        'wrong_question_nos': [int(n) for n in wrong_nos.get(sk['skill_id'], [])],
    } for sk in insufficient.sort_values('skill_id').to_dict('records')]

    units = units.copy()
    units['error_rate'] = units['incorrect_q'] / units['total_q']
    units['error_rate_l1'] = (units['incorrect_l1_q'] / units['total_l1_q']).fillna(0.0)

    # BR-DIAG-01: Chẩn đoán Weak Skill (tỷ lệ sai ≥ 50% và sai đủ số câu tối thiểu)
    enough_wrong = units['incorrect_q'] >= rules.min_wrong
    # Cộng dồn bằng chứng: mới sai 1 câu nhưng bài làm gần nhất trước đó cũng sai chuyên đề này
    prev_wrong: dict[str, tuple[list[int], int]] = {}
    if rules.confirm_previous and 'submitted_at' in ds.attempt.columns:
        prev_wrong = _previous_errors(ds, str(att_row['student_id']), str(att_row['submitted_at']))
    # So theo từng chuyên đề, không theo cả nhóm gộp: bài này và bài trước phải sai cùng một chuyên đề
    wrong_now = set(wrong_nos.index)
    units['prev_wrong_nos'] = units['member_topics'].map(
        lambda m: sorted(n for t in m if t in wrong_now for n in prev_wrong.get(t, ([], 0))[0]))
    units['prev_wrong_times'] = units['member_topics'].map(
        lambda m: max([prev_wrong.get(t, ([], 0))[1] for t in m if t in wrong_now], default=0))
    enough_wrong = enough_wrong | (units['incorrect_q'].ge(1) & units['prev_wrong_nos'].map(bool))
    weak_skills = units[(units['error_rate'] >= 0.5) & enough_wrong].copy()

    # BR-EDGE-09: Xử lý học sinh mất gốc diện rộng
    if total_score < 5.0 and len(weak_skills) < 2:
        weak_skills = units[(units['error_rate'] >= 0.3) & enough_wrong].copy()
        result['broad_weakness_activated'] = True

    if weak_skills.empty:
        # BR-EDGE-10: Không có điểm yếu rõ rệt, điểm dưới mốc thành thạo: luyện củng cố chuyên đề còn sai
        if total_score < rules.mastery_score:
            result['status'] = 'NO_WEAK_SKILL'
            if rules.consolidate:
                result['recommendations'] = _consolidation_materials(
                    ds, skill_stats, min(top_k, 2), names, wrong_nos, rules.min_questions, rules.min_wrong)
            return result

        # BR-EDGE-08: Trường hợp học sinh xuất sắc
        result['status'] = 'MASTERY'
        result['recommendations'] = _mastery_materials(ds, skill_stats, min(top_k, 2), rules, names, wrong_nos)
        return result

    # BR-REC-07: đơn vị sai ≥ 50% nhưng chưa đủ số câu sai (thường là sai 1/2 câu): ứng viên "Nên ôn thêm"
    tentative = units.iloc[0:0]
    if rules.fill_tentative and rules.min_wrong > 1:
        tentative = units[(units['error_rate'] >= 0.5) & (units['incorrect_q'] >= 1) & ~enough_wrong].copy()

    def _rank(frame: pd.DataFrame) -> pd.DataFrame:
        # BR-DIAG-02: Phân cấp mức độ nghiêm trọng
        # Sai ≥ 50% câu cơ bản; chỉ kết luận Hổng kiến thức nền khi số câu cơ bản sai đủ ngưỡng
        frame['basic_wrong'] = frame['error_rate_l1'] >= 0.5
        frame['is_critical'] = frame['basic_wrong'] & (frame['incorrect_l1_q'] >= rules.min_basic_wrong)
        # BR-PRIO-03: Tính điểm ưu tiên
        base = (frame['incorrect_q'] * 2.0) + (frame['incorrect_l1_q'] * 1.5) \
            + frame['error_rate'] + (frame['is_critical'] * 1.0)
        cat_w = frame['category'].map(CATEGORY_WEIGHTS).fillna(1.0)
        frame['priority_score'] = (base * cat_w).round(2)
        return frame.sort_values(by=['priority_score', 'skill_id'], ascending=[False, True])

    weak_skills = _rank(weak_skills)
    tentative = _rank(tentative)

    # BR-REC-06: Khuyến nghị học liệu (chỉ Top-K kỹ năng, mỗi kỹ năng 1 học liệu, không lấy bù)
    weak_details = []      # Toàn bộ kỹ năng yếu theo thứ tự ưu tiên (phục vụ báo cáo thẩm định)
    recommendations = []   # Chỉ các kỹ năng Top-K có học liệu
    min_level = 2 if total_score >= 8.0 else 1  # BR-REC-04: học sinh >= 8.0 không nhận Level 1

    def _unit(sk: Mapping[Any, Any], in_top_k: bool,
              is_tentative: bool) -> tuple[dict[str, Any], dict[str, Any] | None]:
        """Chẩn đoán một đơn vị và (nếu thuộc Top-K) chọn 1 học liệu cho nó."""
        # BR-REC-04: Xác định target_level & Tạo nhãn linh hoạt
        if total_score < 5.0:
            target_lvl = 1
            display_gap = "Hổng kiến thức nền" if sk['is_critical'] else "Mức độ vận dụng yếu"
        elif total_score < 8.0:
            target_lvl = 1 if sk['is_critical'] else 2
            display_gap = "Hổng kiến thức nền" if target_lvl == 1 else "Mức độ vận dụng yếu"
        else:
            target_lvl = 2 if sk['basic_wrong'] else 3
            # Học sinh giỏi nếu sai câu dễ thì cảnh báo sai sót cục bộ, sai câu khó thì cải thiện vận dụng cao
            display_gap = "Sai sót kiến thức nền (Cục bộ)" if target_lvl == 2 else "Cải thiện mức vận dụng cao"

        # BR-REC-07: phần "nên ôn thêm" chỉ sai 1 câu; nếu đó là câu cơ bản thì ôn lại từ mức Cơ bản
        # (học sinh từ 8 điểm vẫn không nhận Level 1 theo BR-REC-04). Theo góp ý thẩm định bổ sung của giáo viên B.
        tentative_basic = is_tentative and int(sk['incorrect_l1_q']) >= 1 and total_score < 8.0
        if tentative_basic:
            target_lvl = 1

        members: list[str] = list(sk['member_topics'])
        unit_wrong = sorted(int(n) for t in members for n in wrong_nos.get(t, []))
        diag_reason = _diagnosis_reason(int(sk['incorrect_q']), int(sk['total_q']), unit_wrong,
                                        int(sk['incorrect_l1_q']), int(sk['total_l1_q']))
        if sk['scope'] == 'group':
            diag_reason += ('; gộp nhóm vì mỗi chuyên đề chỉ có 1 câu: '
                            + ', '.join(str(names.get(t, t)) for t in members))
        prev_nos = [int(n) for n in sk['prev_wrong_nos']] if int(sk['incorrect_q']) < rules.min_wrong else []
        prev_times = int(sk['prev_wrong_times']) if prev_nos else 0
        if prev_nos:
            nos_text = ('câu ' if len(prev_nos) == 1 else 'các câu ') + ', '.join(map(str, prev_nos))
            diag_reason += (f'; bài làm trước cũng sai phần này ({nos_text}) nên đủ để kết luận' if prev_times == 1 else
                            f'; đã sai phần này ở {prev_times} bài làm liên tiếp trước đó (gần nhất: {nos_text}) '
                            'nên đủ để kết luận')
        detail: dict[str, Any] = {
            'skill_id': str(sk['skill_id']),
            'skill_name': str(sk['skill_name']),
            'category': str(sk['category']),
            'gap_type': display_gap,
            'error_stats': _stats_text(int(sk['incorrect_q']), int(sk['total_q'])),
            'easy_stats': f"{sk['incorrect_l1_q']}/{sk['total_l1_q']}",
            'priority_score': float(sk['priority_score']),
            'assigned_target_level': target_lvl,
            'wrong_question_nos': unit_wrong,
            'in_top_k': in_top_k,
            'has_material': False,
            'scope': str(sk['scope']),
            'member_topics': members,
            'reason': diag_reason,
            'previous_wrong_nos': prev_nos,
            'previous_wrong_times': prev_times,
        }
        if is_tentative:
            display_gap = TENTATIVE_GAP
            detail['gap_type'] = display_gap
            wrong = int(sk['incorrect_q'])
            diag_reason = f'Mới sai {wrong} câu nên chưa đủ để kết luận yếu, nên ôn thêm. {diag_reason}'
            detail['reason'] = diag_reason
        if not in_top_k:
            return detail, None

        # BR-REC-05 + BR-EDGE-07: Đúng level trước, khuyết thì lấy level gần nhất (ưu tiên level thấp hơn)
        candidate = ds.material[(ds.material['skill_id'].isin(members)) &
                                (ds.material['target_level'] >= min_level)]
        if candidate.empty:
            return detail, None
        # Dạng lỗi học sinh mắc trong đơn vị này: {error_type: số câu sai}
        unit_types = {t: n for topic in members for t, n in wrong_types.get(topic, {}).items()}
        type_hits = pd.Series([sum(unit_types.get(t, 0) for t in material_types.get(m, set()))
                               for m in candidate['material_id']], index=candidate.index)
        candidate = _with_tie_score(candidate).assign(
            diff=(candidate['target_level'] - target_lvl).abs(),
            # Âm để sắp tăng dần: chuyên đề sai nhiều câu hơn đứng trước
            neg_match=-candidate['skill_id'].map(errors_by_topic).fillna(0),
            neg_type_hits=-type_hits)
        # BR-REC-05b: học liệu dạy đúng dạng lỗi và lệch tối đa 1 Level được xếp trước
        candidate['type_rank'] = ((type_hits > 0) & (candidate['diff'] <= 1)).map({True: 0, False: 1})
        order = ['diff', 'target_level', 'tie_score', 'material_id']
        if rules.match_error_type and unit_types:
            order = ['type_rank', 'diff', 'neg_type_hits', 'target_level', 'tie_score', 'material_id']
        if rules.match_error_topic:
            order = ['neg_match', *order]
        chosen = candidate.sort_values(by=order).iloc[0]

        actual_lvl = int(chosen['target_level'])
        covered = sorted(t for t in material_types.get(str(chosen['material_id']), set()) if t in unit_types)
        shifted = actual_lvl != target_lvl
        # Đổi Level thì bỏ ghi chú "chưa coi là hổng nền" để lý do đi một mạch: mục tiêu → Level được chọn và vì sao
        level_reason = _level_reason(total_score, bool(sk['is_critical']), target_lvl,
                                     basic_slip=bool(sk['basic_wrong']) and not bool(sk['is_critical']) and not shifted)
        if tentative_basic:
            level_reason = 'câu chưa đúng là câu cơ bản nên ôn lại từ mức Cơ bản → Level 1'
        if shifted:
            level_reason = level_reason.replace(f' → Level {target_lvl}', f' nên mục tiêu là Level {target_lvl}')
            has_target = bool((candidate['diff'] == 0).any())
            if has_target and covered:
                level_reason += f'; chọn Level {actual_lvl} vì học liệu Level {target_lvl} không dạy dạng lỗi này'
            else:
                level_reason += f'; kho chưa có Level {target_lvl} nên dùng Level {actual_lvl} gần nhất'
        if covered:
            level_reason += '. Học liệu có phần: ' + ', '.join(type_names.get(t, t) for t in covered)
        else:
            # Luôn nêu học liệu dạy phần nào (góp ý minh bạch của giáo viên B): dạng lỗi học liệu có dạy, hoặc chuyên đề
            taught = sorted(material_types.get(str(chosen['material_id']), set()))
            sections = (ds.material_sections or {}).get(str(chosen['material_id']), [])
            topic_name = str(names.get(chosen['skill_id'], chosen['skill_id']))
            if taught:
                level_reason += '. Học liệu có phần: ' + ', '.join(type_names.get(t, t) for t in taught)
            elif sections:
                level_reason += f'. Học liệu ôn chuyên đề {topic_name}, gồm: ' + '; '.join(sections[:4])
            else:
                level_reason += '. Học liệu ôn chuyên đề: ' + topic_name

        detail['has_material'] = True
        return detail, {
            **detail,
            'tentative': is_tentative,
            'material_id': str(chosen['material_id']),
            'material_title': str(chosen['material_title']),
            'material_actual_level': actual_lvl,
            'material_skill_id': str(chosen['skill_id']),
            'matched_error_types': [type_names.get(t, t) for t in covered],
            'reason': f'{diag_reason}. Cấp độ: {level_reason}.',
        }

    for rank, sk in enumerate(weak_skills.to_dict('records'), start=1):
        detail, rec = _unit(sk, rank <= top_k, False)
        weak_details.append(detail)
        if rec:
            recommendations.append(rec)
    # BR-REC-07: chỉ bù khi số điểm yếu ít hơn K (không bù cho điểm yếu thiếu học liệu, xem BR-REC-06)
    slots = max(0, top_k - len(weak_skills)) if rules.fill_tentative else 0
    for sk in tentative.head(slots).to_dict('records'):
        _, rec = _unit(sk, True, True)
        if rec:
            recommendations.append(rec)

    result['status'] = 'DIAGNOSED'
    result['total_weak_detected'] = len(weak_skills)
    result['weak_skills'] = weak_details
    result['recommendations'] = recommendations
    return result


def _error_type_lookup(ds: Dataset, sub_res: pd.DataFrame) -> tuple[
        dict[str, dict[str, int]], dict[str, set[str]], dict[str, str]]:
    """(dạng lỗi đã sai theo chuyên đề, dạng lỗi mỗi học liệu có dạy, tên dạng lỗi)."""
    if 'error_type' not in ds.question or ds.material_error_type is None:
        return {}, {}, {}
    q_type = question_error_types(ds)
    wrong = sub_res[sub_res['is_err']].assign(error_type=lambda d: d['question_id'].map(q_type)).dropna(
        subset=['error_type'])
    counts = wrong.groupby(['skill_id', 'error_type']).size().reset_index(name='n')
    wrong_types: dict[str, dict[str, int]] = {}
    for row in counts.to_dict('records'):
        wrong_types.setdefault(str(row['skill_id']), {})[str(row['error_type'])] = int(row['n'])
    material_types: dict[str, set[str]] = {}
    for mat, etype in zip(ds.material_error_type['material_id'], ds.material_error_type['error_type'], strict=True):
        material_types.setdefault(str(mat), set()).add(str(etype))
    type_names = ({} if ds.error_type is None else
                  {str(k): str(v) for k, v in zip(ds.error_type['error_type'], ds.error_type['error_name'],
                                                  strict=True)})
    return wrong_types, material_types, type_names


TENTATIVE_GAP = 'Nên ôn thêm'
CONSOLIDATION_LEVEL = 2
CONSOLIDATION_GAP = 'Luyện củng cố'


def _consolidation_materials(ds: Dataset, skill_stats: pd.DataFrame, limit: int, names: pd.Series,
                             wrong_nos: pd.Series, min_questions: int, min_wrong: int = 1) -> list[dict[str, Any]]:
    """BR-EDGE-10: tối đa 2 học liệu cho các chuyên đề còn sai nhiều câu nhất (dù chưa tới ngưỡng 50%).

    Mục tiêu Level 2 (vận dụng); chuyên đề thiếu Level 2 thì lấy Level gần nhất, ưu tiên Level thấp hơn (BR-EDGE-07).
    """
    # Chuyên đề đủ câu (BR-DIAG-00) trước, rồi sai nhiều câu hơn, tỷ lệ sai cao hơn
    still_wrong = skill_stats[skill_stats['incorrect_q'] > 0].assign(
        enough=lambda d: d['total_q'] >= min_questions, rate=lambda d: d['incorrect_q'] / d['total_q']).sort_values(
        by=['enough', 'incorrect_q', 'rate', 'skill_id'], ascending=[False, False, False, True])
    picks: list[dict[str, Any]] = []
    for sk in still_wrong.to_dict('records'):
        if len(picks) >= limit:
            break
        mats = ds.material[ds.material['skill_id'] == sk['skill_id']]
        if mats.empty:
            continue
        mats = _with_tie_score(mats).assign(diff=(mats['target_level'] - CONSOLIDATION_LEVEL).abs())
        mat = mats.sort_values(by=['diff', 'target_level', 'tie_score', 'material_id']).iloc[0]
        wrong, total = int(sk['incorrect_q']), int(sk['total_q'])
        level = int(mat['target_level'])
        weak_rule = 'sai từ 50% trở lên' if min_wrong <= 1 else f'sai từ {min_wrong} câu và từ 50% trở lên'
        reason = (f"Không có phần nào {weak_rule}; còn sai {_stats_text(wrong, total)} câu "
                  f"{names.get(sk['skill_id'], sk['skill_id'])} nên luyện củng cố → Level {CONSOLIDATION_LEVEL}")
        if level != CONSOLIDATION_LEVEL:
            reason += f'; kho chưa có Level {CONSOLIDATION_LEVEL} nên dùng Level {level} gần nhất'
        picks.append({
            'skill_id': str(sk['skill_id']),
            'skill_name': str(names.get(sk['skill_id'], sk['skill_id'])),
            'category': str(sk['category']),
            'gap_type': CONSOLIDATION_GAP,
            'error_stats': _stats_text(wrong, total),
            'easy_stats': f"{sk['incorrect_l1_q']}/{sk['total_l1_q']}",
            'priority_score': 0.0,
            'assigned_target_level': CONSOLIDATION_LEVEL,
            'wrong_question_nos': [int(n) for n in wrong_nos.get(sk['skill_id'], [])],
            'scope': 'topic',
            'member_topics': [str(sk['skill_id'])],
            'material_id': str(mat['material_id']),
            'material_title': str(mat['material_title']),
            'material_actual_level': level,
            'material_skill_id': str(mat['skill_id']),
            'matched_error_types': [],
            'reason': reason + '.',
        })
    return picks


def _mastery_materials(ds: Dataset, skill_stats: pd.DataFrame, limit: int, rules: RuleSet,
                       names: pd.Series, wrong_nos: pd.Series | None = None) -> list[dict[str, Any]]:
    """BR-EDGE-08: tối đa 2 học liệu Level 3.

    v4 ưu tiên chuyên đề học sinh còn sai (dù chưa tới ngưỡng), sau đó mới lấy theo thứ tự chung.
    """
    level3 = _with_tie_score(ds.material[ds.material['target_level'] == 3])
    # (học liệu, lý do, thống kê chuyên đề còn sai nếu có): học sinh và giáo viên thấy đúng số câu còn chưa đúng
    picks: list[tuple[dict[str, Any], str, Mapping[Any, Any] | None]] = []
    if rules.personalized_mastery:
        still_wrong = skill_stats[skill_stats['incorrect_q'] > 0].sort_values(
            by=['incorrect_q', 'skill_id'], ascending=[False, True])
        for sk in still_wrong.to_dict('records'):
            mats = level3[level3['skill_id'] == sk['skill_id']].sort_values(by=['tie_score', 'material_id'])
            if not mats.empty and len(picks) < limit:
                picks.append(({str(k): v for k, v in mats.iloc[0].items()},
                              f"Không có kỹ năng yếu; còn sai {sk['incorrect_q']}/{sk['total_q']} câu "
                              f"{sk['skill_name']} nên luyện thêm mức vận dụng cao.", sk))
    chosen_ids = {m['material_id'] for m, _, _ in picks}
    for mat in level3.sort_values(by=['tie_score', 'material_id']).to_dict('records'):
        if len(picks) >= limit:
            break
        if mat['material_id'] not in chosen_ids:
            picks.append(({str(k): v for k, v in mat.items()},
                          'Không có kỹ năng yếu; học liệu nâng cao để bồi dưỡng.', None))

    return [{
        'skill_id': str(mat['skill_id']),
        'skill_name': 'Kiến thức vận dụng cao' if not rules.personalized_mastery
        else str(names.get(mat['skill_id'], mat['skill_id'])),
        'category': 'Nâng cao',
        'gap_type': 'Học sinh đạt mức độ thành thạo',
        'error_stats': _stats_text(int(sk['incorrect_q']), int(sk['total_q'])) if sk is not None else '0/0 (0%)',
        'easy_stats': f"{sk['incorrect_l1_q']}/{sk['total_l1_q']}" if sk is not None else '0/0',
        'priority_score': 0.0,
        'assigned_target_level': 3,
        'wrong_question_nos': ([int(n) for n in wrong_nos.get(sk['skill_id'], [])]
                               if sk is not None and wrong_nos is not None else []),
        'scope': 'topic',
        'member_topics': [str(mat['skill_id'])],
        'material_id': str(mat['material_id']),
        'material_title': str(mat['material_title']),
        'material_actual_level': int(mat['target_level']),
        'material_skill_id': str(mat['skill_id']),
        'matched_error_types': [],
        'reason': reason,
    } for mat, reason, sk in picks]
