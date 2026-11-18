from pathlib import Path

from engine import load_dataset
from scripts.validate_data import MISSING_LEVEL, NO_MATERIAL, ONLY_LEVEL_1, material_coverage


def test_material_coverage_flags_topics_by_consequence(data_dir: Path) -> None:
    ds = load_dataset(data_dir)
    coverage = material_coverage(ds).set_index('skill_id')
    # Dữ liệu thật: mọi chuyên đề có học liệu; giao tiếp chỉ có Level 1 nên học sinh từ 8 điểm không nhận được
    assert NO_MATERIAL not in set(coverage['severity'])
    assert coverage.loc['SK_COMM_FUNC', 'severity'] == ONLY_LEVEL_1
    assert coverage.loc['SK_COMM_FUNC', 'missing'] == '2, 3'
    assert coverage.loc['SK_COLLOCATION', 'severity'] == MISSING_LEVEL
    # Chuyên đề đủ ba cấp độ không xuất hiện
    full = ds.material.groupby('skill_id')['target_level'].nunique()
    assert not set(full[full == 3].index) & set(coverage.index)

    # Bỏ hết học liệu Giới từ: lên đầu danh sách với mức nghiêm trọng nhất
    ds.material = ds.material[ds.material['skill_id'] != 'SK_PREPOSITION']
    coverage = material_coverage(ds)
    first = coverage.iloc[0]
    assert (first['skill_id'], first['severity'], first['levels'], first['missing']) == (
        'SK_PREPOSITION',
        NO_MATERIAL,
        '—',
        '1, 2, 3',
    )
    assert first['questions'] > 0
