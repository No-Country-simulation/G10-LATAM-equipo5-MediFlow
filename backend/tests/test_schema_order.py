from app.shared.schema_order import con_orden, ordenado


def test_con_orden_registra_el_orden_de_definicion_en_cada_objeto():
    esquema = con_orden(
        {
            "type": "object",
            "properties": {
                "tipo": {"type": "string"},
                "signos": {"type": "object", "properties": {"pa": {}, "fc": {}}},
                "lista": {"type": "array", "items": {"type": "object", "properties": {"z": {}, "a": {}}}},
            },
        }
    )
    assert esquema["propertyOrdering"] == ["tipo", "signos", "lista"]
    assert esquema["properties"]["signos"]["propertyOrdering"] == ["pa", "fc"]
    assert esquema["properties"]["lista"]["items"]["propertyOrdering"] == ["z", "a"]


def test_ordenado_reconstruye_el_orden_que_jsonb_perdio():
    # Así devuelve PostgreSQL un JSONB: claves reordenadas por largo.
    desde_jsonb = {
        "type": "object",
        "propertyOrdering": ["tipo_certificado", "motivo", "dias"],
        "properties": {"dias": {}, "motivo": {}, "nuevo": {}, "tipo_certificado": {}},
    }
    assert list(ordenado(desde_jsonb)["properties"]) == ["tipo_certificado", "motivo", "dias", "nuevo"]


def test_no_modifica_lo_que_no_es_esquema():
    assert con_orden(None) is None
    assert ordenado("texto") == "texto"
