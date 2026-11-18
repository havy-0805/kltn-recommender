import json
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from engine import RULES_V3, RULES_V4, Dataset, load_dataset, recommend_for_attempt, to_topic

DATA_DIR = Path(__file__).resolve().parents[2] / 'data'
GOLDEN = Path(__file__).parent / 'fixtures' / 'golden_notebook_v3.json'
# Bản dữ liệu gốc lúc chạy notebook v3 (trước khi sửa đáp án câu G902_Q08) để so khớp với kết quả notebook
NOTEBOOK_DATA_DIR = Path(__file__).parent / 'fixtures' / 'notebook-v3-data'


@pytest.fixture(scope='module')
def real_ds() -> Dataset:
    return load_dataset(DATA_DIR)


NEW_ITEM_FIELDS = {'wrong_question_nos', 'scope', 'member_topics', 'reason', 'material_skill_id',
                   'matched_error_types', 'tentative', 'previous_wrong_nos',
                   'previous_wrong_times'}
NEW_RESULT_FIELDS = {'rules_version', 'recorded_score', 'score_verified', 'category_stats', 'group_stats',
                     'insufficient_skills'}


def drop_new_fields(res: dict[str, Any]) -> dict[str, Any]:
    """Bỏ trường mới thêm để so với kết quả notebook gốc."""
    def strip(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [{k: v for k, v in it.items() if k not in NEW_ITEM_FIELDS} for it in items]
    base = {k: v for k, v in res.items() if k not in NEW_RESULT_FIELDS}
    return {**base, 'weak_skills': strip(res['weak_skills']), 'recommendations': strip(res['recommendations'])}


def run_v3(ds: Dataset, attempt_id: str, top_k: int = 3) -> dict[str, Any]:
    return recommend_for_attempt(ds, attempt_id, top_k=top_k, rules=RULES_V3)


def test_matches_notebook_for_every_attempt() -> None:
    notebook_ds = load_dataset(NOTEBOOK_DATA_DIR)
    golden = json.loads(GOLDEN.read_text(encoding='utf-8'))
    assert len(golden) == 2 * len(notebook_ds.attempt)
    for key, expected in golden.items():
        attempt_id, top_k = key.split('|')
        actual = drop_new_fields(run_v3(notebook_ds, attempt_id, top_k=int(top_k)))
        assert actual == expected, key


def test_result_is_json_serializable(real_ds: Dataset) -> None:
    for attempt_id in real_ds.attempt['attempt_id']:
        json.dumps(recommend_for_attempt(real_ds, attempt_id))


def test_wrong_question_numbers_match_results(real_ds: Dataset) -> None:
    res = recommend_for_attempt(real_ds, 'ATT_003')
    wrong = real_ds.result[(real_ds.result['attempt_id'] == 'ATT_003') & (real_ds.result['is_correct'] == 0)]
    expected = set(real_ds.question[real_ds.question['question_id'].isin(wrong['question_id'])]['question_no'])
    reported = {n for sk in res['weak_skills'] for n in sk['wrong_question_nos']}
    assert reported <= expected
    for sk in res['weak_skills']:
        assert len(sk['wrong_question_nos']) == int(sk['error_stats'].split('/')[0])


def test_unknown_attempt_raises(real_ds: Dataset) -> None:
    with pytest.raises(KeyError):
        recommend_for_attempt(real_ds, 'ATT_KHONG_CO')


# Bộ dữ liệu tổng hợp nhỏ cho các ca biên (luật v3)

def make_ds(score: float, answers: list[tuple[str, int, int]], materials: list[tuple[str, int]]) -> Dataset:
    """answers: (skill_id, difficulty, is_correct) cho từng câu của đề EX."""
    questions = pd.DataFrame([
        {'question_id': f'Q{i}', 'exam_id': 'EX', 'skill_id': sk, 'difficulty': diff}
        for i, (sk, diff, _) in enumerate(answers, start=1)
    ])
    questions['question_no'] = range(1, len(questions) + 1)
    return Dataset(
        student=pd.DataFrame({'student_id': ['S1']}),
        exam=pd.DataFrame({'exam_id': ['EX']}),
        skill=pd.DataFrame({
            'skill_id': ['SK_A', 'SK_B', 'SK_C'],
            'skill_name': ['Kỹ năng A', 'Kỹ năng B', 'Kỹ năng C'],
            'category': ['Ngữ pháp', 'Từ vựng', 'Đọc hiểu'],
        }),
        question=questions,
        material=pd.DataFrame(
            [(f'M_{sk}_{lvl}', sk, f'Tài liệu {sk} L{lvl}', lvl) for sk, lvl in materials],
            columns=['material_id', 'skill_id', 'material_title', 'target_level'],
        ),
        attempt=pd.DataFrame([{'attempt_id': 'A1', 'student_id': 'S1', 'exam_id': 'EX', 'total_score': score}]),
        result=pd.DataFrame([
            {'attempt_id': 'A1', 'question_id': f'Q{i}', 'is_correct': ok}
            for i, (_, _, ok) in enumerate(answers, start=1)
        ]),
    )


def test_no_data_when_attempt_has_no_results() -> None:
    ds = make_ds(6.0, [('SK_A', 1, 1)], [])
    ds.result = ds.result.iloc[0:0]
    assert run_v3(ds, 'A1')['status'] == 'NO_DATA'


def test_no_weak_skill_below_nine() -> None:
    ds = make_ds(8.5, [('SK_A', 1, 1), ('SK_A', 2, 1), ('SK_B', 1, 1)], [('SK_A', 3)])
    res = run_v3(ds, 'A1')
    assert res['status'] == 'NO_WEAK_SKILL'
    assert res['recommendations'] == []


def test_mastery_gives_at_most_two_level3_materials() -> None:
    ds = make_ds(9.5, [('SK_A', 1, 1), ('SK_B', 2, 1)], [('SK_A', 3), ('SK_B', 3), ('SK_C', 3), ('SK_A', 1)])
    res = run_v3(ds, 'A1')
    assert res['status'] == 'MASTERY'
    assert [r['material_actual_level'] for r in res['recommendations']] == [3, 3]


def test_broad_weakness_lowers_threshold_to_30_percent() -> None:
    # SK_A sai 1/3 (33%), SK_B sai 1/2 (50%) -> ngưỡng 50% chỉ ra 1 kỹ năng, điểm < 5 nên hạ ngưỡng
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 1)]
    res = run_v3(make_ds(4.0, answers, []), 'A1')
    assert res['broad_weakness_activated'] is True
    assert {s['skill_id'] for s in res['weak_skills']} == {'SK_A', 'SK_B'}


def test_critical_skill_gets_level1_for_mid_score() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_B', 3, 0), ('SK_B', 3, 1)]
    res = run_v3(make_ds(6.5, answers, [('SK_A', 1), ('SK_A', 2), ('SK_B', 1), ('SK_B', 2)]), 'A1')
    by_skill = {r['skill_id']: r for r in res['recommendations']}
    assert by_skill['SK_A']['gap_type'] == 'Hổng kiến thức nền'
    assert by_skill['SK_A']['material_actual_level'] == 1
    assert by_skill['SK_B']['gap_type'] == 'Mức độ vận dụng yếu'
    assert by_skill['SK_B']['material_actual_level'] == 2


def run_v4(ds: Dataset, attempt_id: str, top_k: int = 3) -> dict[str, Any]:
    return recommend_for_attempt(ds, attempt_id, top_k=top_k, rules=RULES_V4)


def test_one_basic_slip_is_not_foundation_gap_for_mid_score() -> None:
    # BR-DIAG-02 (v4): học sinh khá sai đúng 1 câu cơ bản -> chưa kết luận Hổng kiến thức nền, vẫn nhận Level 2
    answers = [('SK_A', 1, 0), ('SK_A', 2, 0), ('SK_A', 3, 1)] + [('SK_B', 2, 1)] * 4
    res = run_v4(make_ds(6.5, answers, [('SK_A', 1), ('SK_A', 2)]), 'A1')
    rec = res['recommendations'][0]
    assert rec['gap_type'] == 'Mức độ vận dụng yếu'
    assert rec['material_actual_level'] == 2
    assert 'chưa coi là hổng kiến thức nền' in rec['reason']


def test_two_basic_errors_are_foundation_gap_for_mid_score() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_A', 3, 1)] + [('SK_B', 2, 1)] * 4
    res = run_v4(make_ds(6.5, answers, [('SK_A', 1), ('SK_A', 2)]), 'A1')
    rec = res['recommendations'][0]
    assert rec['gap_type'] == 'Hổng kiến thức nền'
    assert rec['material_actual_level'] == 1


def test_high_score_basic_slip_still_reviews_traps() -> None:
    # Học sinh >= 8.0 sai 1 câu cơ bản vẫn nhận Level 2 rà soát bẫy, không chuyển sang vận dụng cao
    answers = [('SK_A', 1, 0), ('SK_A', 3, 0)] + [('SK_B', 2, 1)] * 8
    res = run_v4(make_ds(8.0, answers, [('SK_A', 2), ('SK_A', 3)]), 'A1')
    rec = res['recommendations'][0]
    assert rec['assigned_target_level'] == 2
    assert 'rà soát bẫy' in rec['reason']


def test_high_score_never_receives_level1() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0)] + [('SK_B', 2, 1)] * 8
    res = run_v3(make_ds(8.0, answers, [('SK_A', 1)]), 'A1')
    assert res['status'] == 'DIAGNOSED'
    assert res['recommendations'] == []
    assert res['weak_skills'][0]['has_material'] is False


def test_only_top_k_skills_get_materials() -> None:
    answers = [('SK_A', 1, 0), ('SK_B', 1, 0), ('SK_C', 1, 0)]
    materials = [('SK_A', 1), ('SK_B', 1), ('SK_C', 1)]
    res = run_v3(make_ds(3.0, answers, materials), 'A1', top_k=2)
    assert res['total_weak_detected'] == 3
    assert len(res['recommendations']) == 2
    assert [s['in_top_k'] for s in res['weak_skills']] == [True, True, False]


def test_taxonomy_maps_micro_skill_to_topic() -> None:
    ds = make_ds(4.0, [('SK_A', 1, 0)], [])
    ds.question.loc[0, 'skill_id'] = 'SK_STRESS_02'
    res = run_v3(ds, 'A1')
    assert res['weak_skills'][0]['skill_id'] == 'SK_PHON_STRESS'


# Luật v4: ngưỡng 2 câu, gộp nhóm kiến thức, tỷ lệ đạt theo nhóm, kiểm tra điểm

def with_groups(ds: Dataset, groups: dict[str, str]) -> Dataset:
    ds.skill['group_id'] = ds.skill['skill_id'].map(groups)
    ds.skill['group_name'] = 'Nhóm ' + ds.skill['group_id']
    return ds


def test_v4_single_question_topic_is_insufficient_not_weak() -> None:
    answers = [('SK_A', 1, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    res = recommend_for_attempt(make_ds(6.0, answers, [('SK_A', 1)]), 'A1')
    assert res['status'] == 'NO_WEAK_SKILL'
    assert [s['skill_id'] for s in res['insufficient_skills']] == ['SK_A']
    assert res['insufficient_skills'][0]['wrong_question_nos'] == [1]


def test_v4_two_question_topic_can_be_weak() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 2, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    res = recommend_for_attempt(make_ds(5.0, answers, [('SK_A', 1)]), 'A1')
    assert res['status'] == 'DIAGNOSED'
    assert res['weak_skills'][0]['skill_id'] == 'SK_A'
    assert res['insufficient_skills'] == []


def test_v4_single_question_topics_roll_up_into_group() -> None:
    # SK_A, SK_B, SK_C mỗi chuyên đề 1 câu, cùng nhóm G1 -> gộp thành 3 câu, sai 2/3 (đủ 2 câu sai) -> yếu
    answers = [('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_C', 2, 0)]
    ds = with_groups(make_ds(6.0, answers, [('SK_A', 2), ('SK_B', 2)]), {'SK_A': 'G1', 'SK_B': 'G1', 'SK_C': 'G1'})
    res = recommend_for_attempt(ds, 'A1')
    weak = res['weak_skills'][0]
    assert (weak['skill_id'], weak['scope'], weak['member_topics']) == ('G1', 'group', ['SK_A', 'SK_B', 'SK_C'])
    assert weak['wrong_question_nos'] == [2, 3]
    # Học liệu lấy từ chuyên đề học sinh làm sai (SK_B), không phải SK_A (làm đúng); SK_C không có học liệu
    assert res['recommendations'][0]['material_skill_id'] == 'SK_B'
    assert 'gộp nhóm' in res['recommendations'][0]['reason']


def test_v4_group_with_one_question_stays_insufficient() -> None:
    answers = [('SK_A', 2, 0), ('SK_C', 2, 1), ('SK_C', 2, 1)]
    ds = with_groups(make_ds(6.0, answers, [('SK_A', 2)]), {'SK_A': 'G1', 'SK_C': 'G2'})
    res = recommend_for_attempt(ds, 'A1')
    assert res['weak_skills'] == []
    assert [s['skill_id'] for s in res['insufficient_skills']] == ['SK_A']


def test_v4_weak_needs_two_wrong_answers() -> None:
    # BR-DIAG-01: sai 1/2 (50%) chỉ dựa trên một câu nên chưa kết luận yếu; sai 2/4 (50%, đủ 2 câu) là lỗ hổng
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    ds = make_ds(6.0, answers, [('SK_A', 2), ('SK_B', 2)])
    assert [s['skill_id'] for s in recommend_for_attempt(ds, 'A1')['weak_skills']] == ['SK_B']
    # Bộ luật phiên bản đầu không có điều kiện này: sai 1/2 vẫn là lỗ hổng
    assert [s['skill_id'] for s in recommend_for_attempt(ds, 'A1', rules=RULES_V3)['weak_skills']] == ['SK_B', 'SK_A']


def test_v4_broad_weakness_also_needs_two_wrong_answers() -> None:
    # Điểm 5/11 = 4,55 và chỉ 1 điểm yếu (SK_C) nên BR-EDGE-09 hạ ngưỡng xuống 30%, nhưng vẫn cần sai từ 2 câu:
    # SK_B sai 2/5 (40%) được thêm vào, SK_A sai 1/3 (33%) thì không
    answers = ([('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_A', 2, 1)]
               + [('SK_B', 2, 0), ('SK_B', 2, 0), ('SK_B', 2, 1), ('SK_B', 2, 1), ('SK_B', 2, 1)]
               + [('SK_C', 2, 0), ('SK_C', 2, 0), ('SK_C', 2, 0)])
    res = recommend_for_attempt(make_ds(4.55, answers, [('SK_A', 1), ('SK_B', 1), ('SK_C', 1)]), 'A1')
    assert res['broad_weakness_activated'] is True
    assert [s['skill_id'] for s in res['weak_skills']] == ['SK_C', 'SK_B']


def test_v4_mastery_starts_at_eight_and_targets_wrong_topic() -> None:
    answers = [('SK_A', 2, 1), ('SK_A', 2, 1), ('SK_B', 3, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    materials = [('SK_A', 3), ('SK_B', 3), ('SK_C', 3)]
    res = recommend_for_attempt(make_ds(8.0, answers, materials), 'A1')
    assert res['status'] == 'MASTERY'
    assert [r['material_skill_id'] for r in res['recommendations']] == ['SK_B', 'SK_A']
    assert all(r['material_actual_level'] == 3 for r in res['recommendations'])


def test_v4_below_eight_without_weak_skill_gets_consolidation() -> None:
    # Mỗi chuyên đề sai 1/3 (33%) < 50%, điểm 4/6 = 6.67: không có điểm yếu nhưng vẫn luyện củng cố (BR-EDGE-10)
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 1), ('SK_B', 2, 1),
               ('SK_C', 2, 1), ('SK_C', 2, 1)]
    materials = [('SK_A', 1), ('SK_A', 3), ('SK_B', 2), ('SK_C', 2)]
    res = recommend_for_attempt(make_ds(6.67, answers, materials), 'A1')
    assert res['status'] == 'NO_WEAK_SKILL' and res['weak_skills'] == []
    recs = res['recommendations']
    # Chỉ chuyên đề còn sai, tối đa 2; SK_A thiếu Level 2 nên lấy Level gần nhất, ưu tiên thấp hơn
    assert [(r['material_skill_id'], r['material_actual_level']) for r in recs] == [('SK_A', 1), ('SK_B', 2)]
    assert recs[0]['wrong_question_nos'] == [1] and recs[0]['gap_type'] == 'Luyện củng cố'
    assert 'kho chưa có Level 2' in recs[0]['reason']


def test_v4_consolidation_prefers_topics_with_enough_questions() -> None:
    # SK_C chỉ 1 câu (sai 1/1) xếp sau SK_A (sai 1/3) dù tỷ lệ sai cao hơn: 1 câu chưa đủ để kết luận
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_A', 2, 1), ('SK_B', 2, 1), ('SK_B', 2, 1), ('SK_C', 2, 0)]
    res = recommend_for_attempt(make_ds(6.67, answers, [('SK_A', 2), ('SK_C', 2)]), 'A1')
    assert [r['material_skill_id'] for r in res['recommendations']] == ['SK_A', 'SK_C']


def test_v3_below_nine_without_weak_skill_gets_nothing() -> None:
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    res = run_v3(make_ds(6.67, answers, [('SK_A', 2)]), 'A1')
    assert res['status'] == 'NO_WEAK_SKILL' and res['recommendations'] == []


def test_v4_score_is_recomputed_from_answers() -> None:
    # Điểm ghi 9.0 nhưng chỉ đúng 1/4 câu -> điểm thật 2.5, áp luật theo 2.5 (Level 1)
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_B', 2, 0), ('SK_B', 2, 1)]
    res = recommend_for_attempt(make_ds(9.0, answers, [('SK_A', 1), ('SK_A', 3)]), 'A1')
    assert (res['total_score'], res['recorded_score'], res['score_verified']) == (2.5, 9.0, False)
    assert res['recommendations'][0]['material_actual_level'] == 1


def test_v4_pass_rates_by_category_and_group() -> None:
    answers = [('SK_A', 1, 1), ('SK_A', 1, 0), ('SK_B', 1, 1), ('SK_C', 1, 1)]
    ds = with_groups(make_ds(7.5, answers, []), {'SK_A': 'G1', 'SK_B': 'G1', 'SK_C': 'G2'})
    res = recommend_for_attempt(ds, 'A1')
    assert [(c['id'], c['correct_q'], c['total_q']) for c in res['category_stats']] == [
        ('Ngữ pháp', 1, 2), ('Từ vựng', 1, 1), ('Đọc hiểu', 1, 1)]
    assert [(g['id'], g['pass_rate']) for g in res['group_stats']] == [('G1', 0.6667), ('G2', 1.0)]


def test_v4_reason_explains_questions_and_level() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    res = recommend_for_attempt(make_ds(5.0, answers, [('SK_A', 2)]), 'A1')
    reason = res['recommendations'][0]['reason']
    assert 'câu 1, 2' in reason and 'Level 1' in reason and 'Level 2 gần nhất' in reason


def test_v4_real_data_never_diagnoses_single_question_topic(real_ds: Dataset) -> None:
    for attempt_id in real_ds.attempt['attempt_id']:
        res = recommend_for_attempt(real_ds, attempt_id)
        for sk in res['weak_skills']:
            total = int(sk['error_stats'].split('/')[1].split(' ')[0])
            assert total >= 2, (attempt_id, sk['skill_id'])


def test_diagnostic_exam_blueprint(real_ds: Dataset) -> None:
    """Đề thi thử Thái Thịnh xếp theo giỏ: chuyên đề ≥ 2 câu có câu cơ bản; chuyên đề 1 câu gộp đủ 2 câu theo nhóm."""
    q = real_ds.question[real_ds.question['exam_id'] == 'EXAM_G9_TT_125']
    assert len(q) == 40
    per_topic = q.groupby('skill_id')
    sizes = per_topic.size()
    assert (per_topic['difficulty'].min()[sizes >= 2] == 1).all()
    singles = q[q['skill_id'].isin(sizes[sizes == 1].index)].merge(real_ds.skill[['skill_id', 'group_id']])
    assert singles.groupby('group_id').size().min() >= 2
    assert all(9 <= n <= 11 for n in q['correct_opt'].value_counts())


def test_diagnostic_exam_never_has_insufficient_topics(real_ds: Dataset) -> None:
    exam = real_ds.question[real_ds.question['exam_id'] == 'EXAM_G9_TT_125']
    wrong_all = pd.DataFrame({'attempt_id': 'SIM', 'question_id': exam['question_id'], 'is_correct': 0})
    attempt = pd.DataFrame([{'attempt_id': 'SIM', 'student_id': 'S', 'exam_id': 'EXAM_G9_TT_125', 'total_score': 0.0}])
    ds = Dataset(real_ds.student, real_ds.exam, real_ds.skill, real_ds.question, real_ds.material, attempt, wrong_all)
    res = recommend_for_attempt(ds, 'SIM')
    assert res['insufficient_skills'] == []
    assert len(res['weak_skills']) == 19  # 16 chuyên đề ≥ 2 câu (có Câu điều kiện) + 3 nhóm gộp


# BR-REC-05b: chọn học liệu theo dạng lỗi

def with_error_types(ds: Dataset, question_types: dict[str, str], material_types: dict[str, list[str]]) -> Dataset:
    ds.error_type = pd.DataFrame([('T_TIME', 'SK_A', 'Giới từ thời gian'), ('T_ADJ', 'SK_A', 'Giới từ sau tính từ')],
                                 columns=['error_type', 'skill_id', 'error_name'])
    ds.question['error_type'] = ds.question['question_id'].map(question_types)
    ds.material_error_type = pd.DataFrame([(m, t) for m, ts in material_types.items() for t in ts],
                                          columns=['material_id', 'error_type'])
    return ds


def test_v4_prefers_adjacent_level_that_teaches_the_error_type() -> None:
    # Sai 2/2 câu cơ bản dạng "giới từ sau tính từ", điểm 6.0 -> mục tiêu Level 1
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    ds = with_error_types(make_ds(6.0, answers, [('SK_A', 1), ('SK_A', 2)]), {'Q1': 'T_ADJ', 'Q2': 'T_ADJ'},
                          {'M_SK_A_1': ['T_TIME'], 'M_SK_A_2': ['T_TIME', 'T_ADJ']})
    rec = recommend_for_attempt(ds, 'A1')['recommendations'][0]
    assert (rec['assigned_target_level'], rec['material_actual_level']) == (1, 2)
    assert rec['matched_error_types'] == ['Giới từ sau tính từ']
    assert 'không dạy dạng lỗi này' in rec['reason'] and 'BR-REC' not in rec['reason']


def test_v4_keeps_target_level_when_it_already_teaches_the_error_type() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_B', 2, 1), ('SK_B', 2, 1)]
    ds = with_error_types(make_ds(6.0, answers, [('SK_A', 1), ('SK_A', 2)]), {'Q1': 'T_ADJ', 'Q2': 'T_TIME'},
                          {'M_SK_A_1': ['T_TIME', 'T_ADJ'], 'M_SK_A_2': ['T_ADJ']})
    assert recommend_for_attempt(ds, 'A1')['recommendations'][0]['material_actual_level'] == 1


def test_v4_error_type_never_jumps_more_than_one_level() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0), ('SK_B', 2, 0), ('SK_B', 2, 1)]
    ds = with_error_types(make_ds(4.0, answers, [('SK_A', 1), ('SK_A', 3)]), {'Q1': 'T_ADJ', 'Q2': 'T_ADJ'},
                          {'M_SK_A_1': ['T_TIME'], 'M_SK_A_3': ['T_ADJ']})
    rec = next(r for r in recommend_for_attempt(ds, 'A1')['recommendations'] if r['skill_id'] == 'SK_A')
    assert rec['material_actual_level'] == 1 and rec['matched_error_types'] == []


def test_v4_error_type_never_gives_level1_to_high_score() -> None:
    answers = [('SK_A', 1, 0), ('SK_A', 1, 0)] + [('SK_B', 2, 1)] * 8
    ds = with_error_types(make_ds(8.0, answers, [('SK_A', 1), ('SK_A', 2)]), {'Q1': 'T_ADJ', 'Q2': 'T_ADJ'},
                          {'M_SK_A_1': ['T_ADJ'], 'M_SK_A_2': ['T_TIME']})
    assert recommend_for_attempt(ds, 'A1')['recommendations'][0]['material_actual_level'] == 2


def test_v4_real_data_level_change_only_within_one_step(real_ds: Dataset) -> None:
    for attempt_id in real_ds.attempt['attempt_id']:
        for rec in recommend_for_attempt(real_ds, attempt_id)['recommendations']:
            if rec['matched_error_types'] and 'không dạy dạng lỗi này' in rec['reason']:
                assert abs(rec['material_actual_level'] - rec['assigned_target_level']) == 1


def test_question_text_has_no_latex(real_ds: Dataset) -> None:
    # Dữ liệu dán từ tài liệu soạn bằng LaTeX từng lọt "$\rightarrow$" vào phần giải thích
    text = real_ds.question[['question_text', 'explanation']].fillna('').astype(str)
    assert not text.apply(lambda col: col.str.contains(r'\$\\|\\[a-z]+arrow', regex=True)).any().any()


def test_every_pronunciation_question_has_underline(real_ds: Dataset) -> None:
    """Câu phát âm phải gạch chân phần cần so sánh (data/question_underline.csv), như đề giấy."""
    underline = pd.read_csv(DATA_DIR / 'question_underline.csv').set_index('question_id')
    pron = real_ds.question[real_ds.question['skill_id'].map(to_topic) == 'SK_PHON_PRON']
    assert set(pron['question_id']) == set(underline.index)
    for q in pron.to_dict('records'):
        for col in ('opt_a', 'opt_b', 'opt_c', 'opt_d'):
            marked = underline.loc[q['question_id'], col]
            assert marked.count('[') == 1 and marked.replace('[', '').replace(']', '') == q[col]


def test_v4_fills_free_slots_with_tentative_units() -> None:
    # BR-REC-07: SK_B sai 2/2 là điểm yếu; SK_A, SK_C sai 1/2 chưa đủ kết luận nhưng được bù vào chỗ trống Top-3
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0), ('SK_C', 2, 0), ('SK_C', 2, 1)]
    res = recommend_for_attempt(make_ds(5.0, answers, [('SK_A', 2), ('SK_B', 2), ('SK_C', 2)]), 'A1')
    assert [s['skill_id'] for s in res['weak_skills']] == ['SK_B']
    recs = res['recommendations']
    assert [(r['material_skill_id'], r['tentative']) for r in recs][0] == ('SK_B', False)
    assert sorted(r['material_skill_id'] for r in recs[1:]) == ['SK_A', 'SK_C']
    assert all(r['tentative'] and r['gap_type'] == 'Nên ôn thêm' for r in recs[1:])
    assert all('chưa đủ để kết luận yếu' in r['reason'] for r in recs[1:])


def test_v4_tentative_never_replaces_weak_points() -> None:
    # Đủ K điểm yếu thì không bù; điểm yếu thiếu học liệu cũng không được thay bằng đơn vị "nên ôn thêm"
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0), ('SK_C', 2, 0), ('SK_C', 2, 0)]
    ds = make_ds(4.0, answers, [('SK_A', 2), ('SK_B', 2), ('SK_C', 2)])
    res = recommend_for_attempt(ds, 'A1', top_k=2)
    assert [r['tentative'] for r in res['recommendations']] == [False, False]
    no_mat = recommend_for_attempt(make_ds(4.0, answers, [('SK_A', 2), ('SK_B', 2)]), 'A1', top_k=2)
    assert [(r['material_skill_id'], r['tentative']) for r in no_mat['recommendations']] == [('SK_B', False)]


def test_tentative_only_in_current_rules_and_not_in_mastery() -> None:
    answers = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0)]
    ds = make_ds(5.0, answers, [('SK_A', 2), ('SK_B', 2)])
    assert not any(r['tentative'] for r in recommend_for_attempt(ds, 'A1', rules=RULES_V3)['recommendations'])
    # Điểm ≥ 8, không có điểm yếu: vẫn là chế độ bồi dưỡng như cũ, không gắn "nên ôn thêm"
    good = [('SK_A', 2, 0)] + [('SK_A', 2, 1)] + [('SK_B', 2, 1)] * 8
    res = recommend_for_attempt(make_ds(9.0, good, [('SK_A', 3), ('SK_B', 3)]), 'A1')
    assert res['status'] == 'MASTERY' and not any(r.get('tentative') for r in res['recommendations'])


def test_tentative_basic_question_gets_basic_level_below_eight() -> None:
    # BR-REC-07: phần "nên ôn thêm" sai đúng 1 câu cơ bản -> Level 1 nếu dưới 8 điểm, không xuống Level 1 nếu từ 8
    base = [('SK_A', 1, 0), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0)]
    mats = [('SK_A', 1), ('SK_A', 2), ('SK_B', 2), ('SK_C', 2)]
    low = recommend_for_attempt(make_ds(6.25, base + [('SK_C', 2, 1)] * 4, mats), 'A1')  # 5/8 = 6,25 điểm
    tent = [r for r in low['recommendations'] if r['tentative']]
    assert [(r['material_skill_id'], r['material_actual_level']) for r in tent] == [('SK_A', 1)]
    assert 'câu cơ bản' in tent[0]['reason']
    high = recommend_for_attempt(make_ds(8.5, base + [('SK_C', 2, 1)] * 16, mats), 'A1')  # 17/20 = 8,5 điểm
    assert high['total_score'] >= 8
    assert [r['material_actual_level'] for r in high['recommendations'] if r['tentative']] == [2]


def test_reasons_never_show_rule_codes_and_always_say_what_material_covers(real_ds: Dataset) -> None:
    for attempt_id in real_ds.attempt['attempt_id']:
        res = recommend_for_attempt(real_ds, attempt_id)
        if res['status'] != 'DIAGNOSED':
            continue
        for rec in res['recommendations']:
            assert 'BR-' not in rec['reason'], (attempt_id, rec['reason'])
            assert 'Học liệu có phần:' in rec['reason'] or 'Học liệu ôn chuyên đề' in rec['reason']


# BR-DIAG-01 (cộng dồn bằng chứng): bài trước cũng sai cùng chuyên đề thì 1 câu sai ở bài này là đủ

def with_previous_attempt(ds: Dataset, prev_correct: list[int], when: str = '2026-05-01 09:00:00') -> Dataset:
    """Thêm lượt A0 (cùng đề, nộp trước A1) với kết quả từng câu prev_correct."""
    ds.attempt = pd.concat([
        pd.DataFrame([{'attempt_id': 'A0', 'student_id': 'S1', 'exam_id': 'EX', 'total_score': 5.0,
                       'submitted_at': when}]),
        ds.attempt.assign(submitted_at='2026-05-10 09:00:00'),
    ], ignore_index=True)
    ds.result = pd.concat([ds.result, pd.DataFrame([
        {'attempt_id': 'A0', 'question_id': f'Q{i}', 'is_correct': ok} for i, ok in enumerate(prev_correct, start=1)
    ])], ignore_index=True)
    return ds


ONE_WRONG = [('SK_A', 2, 0), ('SK_A', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0), ('SK_C', 2, 1), ('SK_C', 2, 1)]
MATS_ABC = [('SK_A', 2), ('SK_B', 2), ('SK_C', 2)]


def test_v4_one_wrong_confirmed_by_previous_attempt_is_weak() -> None:
    # Bài này SK_A sai 1/2; bài trước sai câu 2 (cũng SK_A) -> SK_A là điểm yếu, không còn là "nên ôn thêm"
    ds = with_previous_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), [1, 0, 1, 1, 1, 1])
    res = recommend_for_attempt(ds, 'A1')
    weak = {s['skill_id']: s for s in res['weak_skills']}
    assert set(weak) == {'SK_A', 'SK_B'}
    assert weak['SK_A']['previous_wrong_nos'] == [2] and weak['SK_B']['previous_wrong_nos'] == []
    assert 'bài làm trước cũng sai phần này (câu 2)' in weak['SK_A']['reason']
    assert not any(r['tentative'] for r in res['recommendations'])


def test_v4_previous_attempt_on_other_topic_or_later_does_not_confirm() -> None:
    # Bài trước chỉ sai SK_C -> SK_A vẫn là "nên ôn thêm"
    other = recommend_for_attempt(with_previous_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), [1, 1, 1, 1, 0, 1]), 'A1')
    assert [s['skill_id'] for s in other['weak_skills']] == ['SK_B']
    # Lượt nộp SAU bài đang xét không được dùng làm bằng chứng
    later = with_previous_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), [0, 0, 1, 1, 1, 1], when='2026-06-01 09:00:00')
    assert [s['skill_id'] for s in recommend_for_attempt(later, 'A1')['weak_skills']] == ['SK_B']


def test_v4_previous_attempt_needs_current_error_rate_and_only_in_current_rules() -> None:
    # SK_A sai 1/4 (25%) ở bài này thì dù bài trước có sai cũng không phải điểm yếu
    answers = [('SK_A', 2, 0)] + [('SK_A', 2, 1)] * 3 + [('SK_B', 2, 0), ('SK_B', 2, 0)]
    ds = with_previous_attempt(make_ds(5.0, answers, MATS_ABC), [0, 0, 0, 0, 1, 1])
    assert [s['skill_id'] for s in recommend_for_attempt(ds, 'A1')['weak_skills']] == ['SK_B']
    ds2 = with_previous_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), [1, 0, 1, 1, 1, 1])
    assert all(not s.get('previous_wrong_nos') for s in recommend_for_attempt(ds2, 'A1', rules=RULES_V3)['weak_skills'])


def test_v4_previous_attempt_must_match_the_same_topic_inside_a_group() -> None:
    # SK_A, SK_C mỗi chuyên đề 1 câu, gộp thành nhóm G (2 câu). Bài này sai câu SK_A; bài trước chỉ sai câu SK_C:
    # hai dạng khác nhau nên không tính là lặp lỗi. Bài trước sai đúng SK_A thì mới xác nhận.
    answers = [('SK_A', 2, 0), ('SK_C', 2, 1), ('SK_B', 2, 0), ('SK_B', 2, 0)]
    groups = {'SK_A': 'G', 'SK_C': 'G', 'SK_B': 'GB'}
    other = with_previous_attempt(with_groups(make_ds(5.0, answers, MATS_ABC), groups), [1, 0, 1, 1])
    assert [s['skill_id'] for s in recommend_for_attempt(other, 'A1')['weak_skills']] == ['SK_B']
    same = with_previous_attempt(with_groups(make_ds(5.0, answers, MATS_ABC), groups), [0, 1, 1, 1])
    weak = {s['skill_id']: s for s in recommend_for_attempt(same, 'A1')['weak_skills']}
    assert set(weak) == {'G', 'SK_B'} and weak['G']['previous_wrong_nos'] == [1]


def add_attempt(ds: Dataset, att_id: str, when: str, answers: list[tuple[str, int, int]] | None = None,
                same_exam: list[int] | None = None) -> Dataset:
    """Thêm lượt nộp lúc `when`: cùng đề EX (same_exam = đúng/sai từng câu) hoặc một đề mới chỉ gồm `answers`."""
    if same_exam is not None:
        exam, rows = 'EX', [(f'Q{i}', ok) for i, ok in enumerate(same_exam, start=1)]
    else:
        assert answers is not None
        exam = f'EX_{att_id}'
        qs = pd.DataFrame([{'question_id': f'{att_id}_Q{i}', 'exam_id': exam, 'skill_id': sk, 'difficulty': d,
                            'question_no': i} for i, (sk, d, _) in enumerate(answers, start=1)])
        ds.question = pd.concat([ds.question, qs], ignore_index=True)
        rows = [(f'{att_id}_Q{i}', ok) for i, (_, _, ok) in enumerate(answers, start=1)]
    if 'submitted_at' not in ds.attempt:
        ds.attempt = ds.attempt.assign(submitted_at='2026-05-10 09:00:00')
    ds.attempt = pd.concat([ds.attempt, pd.DataFrame([{'attempt_id': att_id, 'student_id': 'S1', 'exam_id': exam,
                                                       'total_score': 5.0, 'submitted_at': when}])], ignore_index=True)
    ds.result = pd.concat([ds.result, pd.DataFrame([{'attempt_id': att_id, 'question_id': q, 'is_correct': ok}
                                                    for q, ok in rows])], ignore_index=True)
    return ds


def test_v4_previous_check_skips_attempts_without_the_topic() -> None:
    # A0 (cũ nhất) sai SK_A; A_MID không có câu SK_A nào; A1 (bài đang xét) sai 1/2 SK_A -> vẫn xác nhận nhờ A0
    ds = add_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), 'A0', '2026-05-01 09:00:00', same_exam=[0, 1, 1, 1, 1, 1])
    ds = add_attempt(ds, 'A_MID', '2026-05-05 09:00:00', answers=[('SK_B', 2, 0), ('SK_B', 2, 1)])
    weak = {s['skill_id']: s for s in recommend_for_attempt(ds, 'A1')['weak_skills']}
    assert weak['SK_A']['previous_wrong_nos'] == [1] and weak['SK_A']['previous_wrong_times'] == 1


def test_v4_previous_check_counts_consecutive_wrong_attempts() -> None:
    # Sai SK_A ở cả hai bài trước -> lý do ghi đã sai ở 2 bài liên tiếp
    ds = add_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), 'A0', '2026-05-01 09:00:00', same_exam=[0, 0, 1, 1, 1, 1])
    ds = add_attempt(ds, 'A_MID', '2026-05-05 09:00:00', same_exam=[1, 0, 1, 1, 1, 1])
    sk = next(s for s in recommend_for_attempt(ds, 'A1')['weak_skills'] if s['skill_id'] == 'SK_A')
    assert sk['previous_wrong_times'] == 2 and sk['previous_wrong_nos'] == [2]
    assert 'đã sai phần này ở 2 bài làm liên tiếp trước đó (gần nhất: câu 2)' in sk['reason']


def test_v4_previous_check_stops_when_latest_attempt_with_topic_was_correct() -> None:
    # Sai SK_A ở A0 nhưng đã làm đúng hết SK_A ở A_MID (gần hơn) -> không xác nhận, SK_A chỉ là "nên ôn thêm"
    ds = add_attempt(make_ds(5.0, ONE_WRONG, MATS_ABC), 'A0', '2026-05-01 09:00:00', same_exam=[0, 0, 1, 1, 1, 1])
    ds = add_attempt(ds, 'A_MID', '2026-05-05 09:00:00', same_exam=[1, 1, 1, 1, 1, 1])
    res = recommend_for_attempt(ds, 'A1')
    assert [s['skill_id'] for s in res['weak_skills']] == ['SK_B']
    assert any(r['tentative'] and r['material_skill_id'] == 'SK_A' for r in res['recommendations'])
