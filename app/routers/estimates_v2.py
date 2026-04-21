"""CRUD-роутер для смет v2: Estimate → EstimateSection → EstimatePosition → PriceLayer."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.estimate_v2 import (
    Estimate, EstimateSection, EstimatePosition, PriceLayer,
    ESTIMATE_STATUS_TRANSITIONS, ESTIMATE_TYPES, CALC_METHODS,
)
from app.models.project_member import ProjectMember
from app.schemas.estimate_v2 import (
    EstimateCreate, EstimateUpdate, EstimateStatusTransition, EstimateResponse,
    SectionCreate, SectionUpdate, SectionResponse,
    PositionCreate, PositionUpdate, PositionResponse,
    PriceLayerCreate, PriceLayerUpdate, PriceLayerResponse,
    CostCalcRequest, EstimateSummaryResponse, LayerTotalsSchema,
    BranchCompareResponse, PositionDiffSchema, EstimateExtrasUpdate,
)

router = APIRouter()

LAYER_TYPES = ("client", "cost", "subcontract", "actual")
# Слои, для которых источник цены обязателен (принцип достоверности)
LAYERS_REQUIRING_SOURCE = ("cost", "subcontract")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_estimate_or_404(db: AsyncSession, estimate_id: str) -> Estimate:
    est = await db.get(Estimate, estimate_id)
    if not est:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    return est


async def _check_project_access(db: AsyncSession, project_id: str, user_id: str) -> None:
    """Проверить, что пользователь является участником проекта."""
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")


async def _get_estimate_with_access(db: AsyncSession, estimate_id: str, user_id: str) -> Estimate:
    """Получить смету или 404; проверить доступ к проекту."""
    est = await _get_estimate_or_404(db, estimate_id)
    await _check_project_access(db, est.project_id, user_id)
    return est


def _check_not_locked(est: Estimate) -> None:
    if est.is_locked:
        raise HTTPException(status_code=403, detail="Смета подписана и заблокирована для изменений")


def _build_position_response(pos: EstimatePosition, layers: list) -> PositionResponse:
    data = PositionResponse.model_validate(pos)
    data.layers = [PriceLayerResponse.model_validate(layer) for layer in layers]
    return data


async def _load_position_with_layers(db: AsyncSession, position_id: str) -> PositionResponse:
    pos = await db.get(EstimatePosition, position_id)
    layers_result = await db.execute(
        select(PriceLayer).where(PriceLayer.position_id == position_id)
    )
    return _build_position_response(pos, layers_result.scalars().all())


# ═══════════════════════════════ ESTIMATE ════════════════════════════════════

@router.post("", response_model=EstimateResponse, status_code=201)
async def create_estimate(
    body: EstimateCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if body.estimate_type not in ESTIMATE_TYPES:
        raise HTTPException(status_code=400, detail=f"estimate_type должен быть одним из: {ESTIMATE_TYPES}")
    if body.calculation_method not in CALC_METHODS:
        raise HTTPException(status_code=400, detail=f"calculation_method должен быть одним из: {CALC_METHODS}")
    await _check_project_access(db, body.project_id, current_user.id)
    now = _now()
    est = Estimate(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        name=body.name,
        description=body.description,
        status="draft",
        is_locked=False,
        parent_id=body.parent_id,
        version_name=body.version_name,
        estimate_type=body.estimate_type,
        calculation_method=body.calculation_method,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(est)
    await db.commit()
    await db.refresh(est)
    return est


@router.get("", response_model=list[EstimateResponse])
async def list_estimates_by_project(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _check_project_access(db, project_id, current_user.id)
    result = await db.execute(
        select(Estimate)
        .where(Estimate.project_id == project_id)
        .order_by(Estimate.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{estimate_id}", response_model=EstimateResponse)
async def get_estimate(
    estimate_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await _get_estimate_with_access(db, estimate_id, current_user.id)


@router.patch("/{estimate_id}", response_model=EstimateResponse)
async def update_estimate(
    estimate_id: str,
    body: EstimateUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(est, field, value)
    est.updated_at = _now()
    await db.commit()
    await db.refresh(est)
    return est


@router.post("/{estimate_id}/status", response_model=EstimateResponse)
async def transition_status(
    estimate_id: str,
    body: EstimateStatusTransition,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    allowed = ESTIMATE_STATUS_TRANSITIONS.get(est.status, [])
    if body.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Недопустимый переход: «{est.status}» → «{body.status}». "
                f"Допустимые переходы: {allowed or ['нет']}"
            ),
        )
    est.status = body.status
    est.is_locked = body.status == "signed"
    est.updated_at = _now()
    await db.commit()
    await db.refresh(est)
    return est


@router.post("/{estimate_id}/branch", response_model=EstimateResponse, status_code=201)
async def branch_estimate(
    estimate_id: str,
    body: EstimateCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Создать ветку (новую версию) существующей сметы.
    Глубоко копирует разделы, позиции и все слои цен.
    """
    from app.services.cost_calc_service import copy_estimate_structure
    source = await _get_estimate_with_access(db, estimate_id, current_user.id)
    project_id = body.project_id or source.project_id
    if project_id != source.project_id:
        await _check_project_access(db, project_id, current_user.id)
    now = _now()
    branch = Estimate(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=body.name,
        description=body.description,
        status="draft",
        is_locked=False,
        parent_id=estimate_id,
        version_name=body.version_name,
        estimate_type=body.estimate_type or source.estimate_type,
        calculation_method=body.calculation_method or source.calculation_method,
        extras=dict(source.extras or {}),
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(branch)
    await db.flush()
    await copy_estimate_structure(db, estimate_id, branch.id)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.patch("/{estimate_id}/extras", response_model=EstimateResponse)
async def update_estimate_extras(
    estimate_id: str,
    body: EstimateExtrasUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Обновить коэффициенты накладных расходов (overhead, transport, contingency)."""
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    extras = dict(est.extras or {})
    if body.overhead_pct is not None:
        extras["overhead_pct"] = body.overhead_pct
    if body.transport_pct is not None:
        extras["transport_pct"] = body.transport_pct
    if body.contingency_pct is not None:
        extras["contingency_pct"] = body.contingency_pct
    est.extras = extras
    est.updated_at = _now()
    await db.commit()
    await db.refresh(est)
    return est


@router.post("/{estimate_id}/calculate-cost", response_model=dict)
async def calculate_cost(
    estimate_id: str,
    body: CostCalcRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Автосчёт слоя COST для всех позиций сметы, привязанных к каталогу.
    Берёт актуальную CatalogPrice для каждой позиции.
    Сохраняет коэффициенты накладных расходов в estimate.extras.
    """
    from app.services.cost_calc_service import calculate_cost_layer
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    stats = await calculate_cost_layer(
        db=db,
        estimate_id=estimate_id,
        overhead_pct=body.overhead_pct,
        transport_pct=body.transport_pct,
        contingency_pct=body.contingency_pct,
        price_source_id=body.price_source_id,
    )
    await db.commit()
    return {
        "ok": True,
        **stats,
        "message": (
            f"Обновлено {stats['updated']} позиций. "
            f"Без каталога: {stats['skipped_no_catalog']}. "
            f"Нет цены в каталоге: {stats['skipped_no_price']}."
        ),
    }


@router.get("/{estimate_id}/summary", response_model=EstimateSummaryResponse)
async def get_summary(
    estimate_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Итоговые суммы по всем слоям цен, маржа, накладные."""
    from app.services.cost_calc_service import get_estimate_summary
    await _get_estimate_with_access(db, estimate_id, current_user.id)
    s = await get_estimate_summary(db, estimate_id)
    return EstimateSummaryResponse(
        estimate_id=s.estimate_id,
        estimate_name=s.estimate_name,
        positions_count=s.positions_count,
        layers={
            lt: LayerTotalsSchema(
                work=lt_obj.work,
                material=lt_obj.material,
                total=lt_obj.total,
            )
            for lt, lt_obj in s.layers.items()
        },
        overhead_pct=s.overhead_pct,
        transport_pct=s.transport_pct,
        contingency_pct=s.contingency_pct,
        cost_total_with_overhead=s.cost_total_with_overhead,
        margin=s.margin,
        margin_pct=s.margin_pct,
    )


@router.get("/{estimate_id}/compare/{other_id}", response_model=BranchCompareResponse)
async def compare_branches(
    estimate_id: str,
    other_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Сравнение двух смет/веток: различия по позициям и ценам."""
    from app.services.cost_calc_service import compare_estimates
    await _get_estimate_with_access(db, estimate_id, current_user.id)
    await _get_estimate_with_access(db, other_id, current_user.id)
    result = await compare_estimates(db, estimate_id, other_id)
    return BranchCompareResponse(
        estimate_a_id=result.estimate_a_id,
        estimate_b_id=result.estimate_b_id,
        only_in_a=[
            PositionDiffSchema(
                position_name=d.position_name, unit=d.unit, quantity=d.quantity,
                a_layers=d.a_layers, b_layers=d.b_layers, diff_type=d.diff_type,
            )
            for d in result.only_in_a
        ],
        only_in_b=[
            PositionDiffSchema(
                position_name=d.position_name, unit=d.unit, quantity=d.quantity,
                a_layers=d.a_layers, b_layers=d.b_layers, diff_type=d.diff_type,
            )
            for d in result.only_in_b
        ],
        changed=[
            PositionDiffSchema(
                position_name=d.position_name, unit=d.unit, quantity=d.quantity,
                a_layers=d.a_layers, b_layers=d.b_layers, diff_type=d.diff_type,
            )
            for d in result.changed
        ],
        unchanged_count=result.unchanged_count,
        total_a=result.total_a,
        total_b=result.total_b,
    )


@router.delete("/{estimate_id}", status_code=204)
async def delete_estimate(
    estimate_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    await db.delete(est)
    await db.commit()


# ═══════════════════════════════ SECTIONS ════════════════════════════════════

@router.post("/{estimate_id}/sections", response_model=SectionResponse, status_code=201)
async def create_section(
    estimate_id: str,
    body: SectionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    section = EstimateSection(
        id=str(uuid.uuid4()),
        estimate_id=estimate_id,
        parent_id=body.parent_id,
        name=body.name,
        order_index=body.order_index,
        created_at=_now(),
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


@router.get("/{estimate_id}/sections", response_model=list[SectionResponse])
async def list_sections(
    estimate_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_estimate_with_access(db, estimate_id, current_user.id)
    result = await db.execute(
        select(EstimateSection)
        .where(EstimateSection.estimate_id == estimate_id)
        .order_by(EstimateSection.order_index)
    )
    return result.scalars().all()


@router.patch("/{estimate_id}/sections/{section_id}", response_model=SectionResponse)
async def update_section(
    estimate_id: str,
    section_id: str,
    body: SectionUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    section = await db.get(EstimateSection, section_id)
    if not section or section.estimate_id != estimate_id:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(section, field, value)
    await db.commit()
    await db.refresh(section)
    return section


@router.delete("/{estimate_id}/sections/{section_id}", status_code=204)
async def delete_section(
    estimate_id: str,
    section_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    section = await db.get(EstimateSection, section_id)
    if not section or section.estimate_id != estimate_id:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    await db.delete(section)
    await db.commit()


# ═══════════════════════════════ POSITIONS ═══════════════════════════════════

@router.post("/{estimate_id}/positions", response_model=PositionResponse, status_code=201)
async def create_position(
    estimate_id: str,
    body: PositionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    now = _now()
    pos = EstimatePosition(
        id=str(uuid.uuid4()),
        estimate_id=estimate_id,
        section_id=body.section_id,
        catalog_item_id=body.catalog_item_id,
        row_type=body.row_type,
        name=body.name,
        unit=body.unit,
        quantity=body.quantity,
        order_index=body.order_index,
        created_at=now,
        updated_at=now,
    )
    db.add(pos)
    await db.commit()
    await db.refresh(pos)
    return await _load_position_with_layers(db, pos.id)


@router.get("/{estimate_id}/positions", response_model=list[PositionResponse])
async def list_positions(
    estimate_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_estimate_with_access(db, estimate_id, current_user.id)
    result = await db.execute(
        select(EstimatePosition)
        .where(EstimatePosition.estimate_id == estimate_id)
        .order_by(EstimatePosition.order_index)
    )
    positions = result.scalars().all()
    if not positions:
        return []
    # Загружаем все слои одним запросом вместо N+1
    pos_ids = [p.id for p in positions]
    layers_result = await db.execute(
        select(PriceLayer).where(PriceLayer.position_id.in_(pos_ids))
    )
    layers_by_pos: dict[str, list] = {}
    for layer in layers_result.scalars().all():
        layers_by_pos.setdefault(layer.position_id, []).append(layer)
    return [_build_position_response(p, layers_by_pos.get(p.id, [])) for p in positions]


@router.patch("/{estimate_id}/positions/{position_id}", response_model=PositionResponse)
async def update_position(
    estimate_id: str,
    position_id: str,
    body: PositionUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    pos = await db.get(EstimatePosition, position_id)
    if not pos or pos.estimate_id != estimate_id:
        raise HTTPException(status_code=404, detail="Позиция не найдена")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(pos, field, value)
    pos.updated_at = _now()
    await db.commit()
    return await _load_position_with_layers(db, pos.id)


@router.delete("/{estimate_id}/positions/{position_id}", status_code=204)
async def delete_position(
    estimate_id: str,
    position_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    pos = await db.get(EstimatePosition, position_id)
    if not pos or pos.estimate_id != estimate_id:
        raise HTTPException(status_code=404, detail="Позиция не найдена")
    await db.delete(pos)
    await db.commit()


# ═══════════════════════════════ PRICE LAYERS ════════════════════════════════

@router.post("/{estimate_id}/positions/{position_id}/layers", response_model=PriceLayerResponse, status_code=201)
async def create_price_layer(
    estimate_id: str,
    position_id: str,
    body: PriceLayerCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    if body.layer_type not in LAYER_TYPES:
        raise HTTPException(status_code=400, detail=f"layer_type должен быть одним из: {LAYER_TYPES}")
    # Принцип достоверности: слои cost и subcontract требуют источника цены
    if body.layer_type in LAYERS_REQUIRING_SOURCE and not body.price_source_id:
        raise HTTPException(
            status_code=422,
            detail=f"Слой «{body.layer_type}» требует обязательного источника цены (price_source_id)",
        )
    pos = await db.get(EstimatePosition, position_id)
    if not pos or pos.estimate_id != estimate_id:
        raise HTTPException(status_code=404, detail="Позиция не найдена")
    existing = await db.execute(
        select(PriceLayer).where(
            PriceLayer.position_id == position_id,
            PriceLayer.layer_type == body.layer_type,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"Слой «{body.layer_type}» уже существует для этой позиции")
    total = (body.work_price + body.material_price) * pos.quantity
    layer = PriceLayer(
        id=str(uuid.uuid4()),
        position_id=position_id,
        layer_type=body.layer_type,
        work_price=body.work_price,
        material_price=body.material_price,
        total=total,
        price_source_id=body.price_source_id,
        notes=body.notes,
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return layer


@router.patch("/{estimate_id}/positions/{position_id}/layers/{layer_id}", response_model=PriceLayerResponse)
async def update_price_layer(
    estimate_id: str,
    position_id: str,
    layer_id: str,
    body: PriceLayerUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    layer = await db.get(PriceLayer, layer_id)
    if not layer or layer.position_id != position_id:
        raise HTTPException(status_code=404, detail="Слой цен не найден")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(layer, field, value)
    # Пересчитать итог — pos гарантированно существует (layer ссылается через FK+CASCADE)
    pos = await db.get(EstimatePosition, position_id)
    layer.total = (layer.work_price + layer.material_price) * pos.quantity
    await db.commit()
    await db.refresh(layer)
    return layer


@router.delete("/{estimate_id}/positions/{position_id}/layers/{layer_id}", status_code=204)
async def delete_price_layer(
    estimate_id: str,
    position_id: str,
    layer_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    est = await _get_estimate_with_access(db, estimate_id, current_user.id)
    _check_not_locked(est)
    layer = await db.get(PriceLayer, layer_id)
    if not layer or layer.position_id != position_id:
        raise HTTPException(status_code=404, detail="Слой цен не найден")
    await db.delete(layer)
    await db.commit()


# ═══════════════════════════════ IMPORT ══════════════════════════════════════

@router.post("/import", response_model=dict, status_code=201)
async def import_estimate_from_file(
    project_id: str = Form(..., description="ID проекта"),
    estimate_name: str = Form(..., description="Название создаваемой сметы"),
    source_name: str = Form("Смета заказчика", description="Название источника цен"),
    use_ai: bool = Form(True, description="Включить AI-нормализацию и сопоставление с каталогом"),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Импорт сметы из файла (Excel, PDF, DOCX).

    Пайплайн:
    1. Определение типа файла.
    2. Парсинг в унифицированную структуру ParsedPosition.
    3. AI-нормализация + сопоставление с каталогом (если use_ai=true).
    4. Создание Estimate(draft) + разделов + позиций + слоя цен CLIENT.

    Возвращает id созданной сметы и статистику.
    """
    from app.services.parse_service import parse_excel_client, parse_pdf_client, parse_docx_client
    from app.services.ai_pipeline_v2 import run_import_pipeline

    await _check_project_access(db, project_id, current_user.id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не передан")

    data = await file.read()
    fname = file.filename.lower()
    content_type = file.content_type or ""

    if fname.endswith(".xlsx") or "spreadsheetml" in content_type or "ms-excel" in content_type:
        positions = parse_excel_client(data)
    elif fname.endswith(".pdf") or "pdf" in content_type:
        positions = await parse_pdf_client(data, file.filename)
    elif fname.endswith(".docx") or fname.endswith(".doc") or "wordprocessingml" in content_type:
        positions = await parse_docx_client(data, file.filename)
    else:
        raise HTTPException(status_code=400, detail="Поддерживаются только .xlsx, .pdf, .docx")

    if not positions:
        raise HTTPException(status_code=422, detail="Не удалось извлечь позиции из файла")

    estimate, total, needs_review = await run_import_pipeline(
        db=db,
        project_id=project_id,
        estimate_name=estimate_name,
        positions=positions,
        created_by=current_user.id,
        source_name=source_name,
        use_ai_normalization=use_ai,
    )

    return {
        "estimate_id": estimate.id,
        "status": estimate.status,
        "total_positions": total,
        "needs_review": needs_review,
        "message": (
            f"Смета создана: {total} позиций"
            + (f", {needs_review} требуют проверки цен" if needs_review else "")
        ),
    }
