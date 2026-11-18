from scripts.validate_materials import catalog, validate


def test_every_catalog_material_has_valid_content() -> None:
    cat = catalog()
    errors = [e for material_id in cat.index for e in validate(str(material_id), cat)]
    assert errors == []
