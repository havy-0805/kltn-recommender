"""Kiểm tra file nội dung học liệu theo data/materials/SCHEMA.md.

Dùng: uv run python -m scripts.validate_materials [material_id ...]   (bỏ trống = kiểm tra mọi file có trong thư mục)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from pydantic import ValidationError

from schemas import MaterialContent

DATA_DIR = Path(__file__).resolve().parents[2] / 'data'
MATERIALS_DIR = DATA_DIR / 'materials'


def catalog() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / 'Dữ liệu mẫu - material.csv').set_index('material_id')


def validate(material_id: str, cat: pd.DataFrame) -> list[str]:
    path = MATERIALS_DIR / f'{material_id}.json'
    if material_id not in cat.index:
        return [f'{material_id}: không có trong material.csv']
    if not path.exists():
        return [f'{material_id}: chưa có file {path.name}']
    try:
        content = MaterialContent.model_validate(json.loads(path.read_text(encoding='utf-8')))
    except (json.JSONDecodeError, ValidationError) as err:
        return [f'{material_id}: {err}']
    row = cat.loc[material_id].to_dict()
    expected = {'material_id': material_id, 'skill_id': row['skill_id'], 'title': row['material_title'],
                'target_level': int(row['target_level'])}
    return [f'{material_id}: {k} phải là {v!r}, đang là {getattr(content, k)!r}'
            for k, v in expected.items() if getattr(content, k) != v]


def main(ids: list[str]) -> int:
    cat = catalog()
    ids = ids or sorted(p.stem for p in MATERIALS_DIR.glob('*.json'))
    errors = [e for mid in ids for e in validate(mid, cat)]
    for e in errors:
        print('LỖI', e)
    print(f'{len(ids) - len({e.split(":")[0] for e in errors})}/{len(ids)} học liệu hợp lệ')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
