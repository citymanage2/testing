"""Construction room calculator — 22 parameters, pure in-memory math."""
import math
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class RoomInput(BaseModel):
    length: float
    width: float
    height: float
    door_count: int = 0
    door_width: float = 0.9
    door_height: float = 2.1
    window_count: int = 0
    window_width: float = 1.2
    window_height: float = 1.4
    # Extra openings / niches
    extra_opening_area: float = 0.0
    # Ceiling type: flat | cornice | slope
    ceiling_type: str = "flat"
    slope_angle: float = 30.0       # degrees, used when ceiling_type == "slope"
    cornice_width: float = 0.0      # m, perimeter × cornice_width = cornice area
    # Floor
    floor_type: str = "flat"        # flat | leveled
    floor_screed_thickness: float = 0.05  # m
    # Skirting
    skirting_height: float = 0.1
    # Extra walls (alcoves, columns)
    extra_wall_area: float = 0.0
    # Tiles: wall tile height (from floor)
    tile_height: float = 0.0


class RoomResult(BaseModel):
    # Basic geometry
    perimeter: float
    floor_area: float
    ceiling_area: float
    total_volume: float
    # Walls
    wall_area_gross: float          # before subtracting openings
    wall_area_net: float            # after subtracting doors + windows + extra
    wall_tile_area: float           # wall area up to tile_height
    # Openings
    door_area: float
    window_area: float
    # Ceiling
    ceiling_area_gross: float       # could differ for slope
    cornice_area: float
    # Floor
    floor_screed_volume: float      # m³
    # Skirting
    skirting_length: float
    skirting_area: float
    # Additional
    paint_area_net: float           # wall_area_net (walls for painting)
    wallpaper_area_net: float       # same as paint_area_net (alias)


@router.post("/room", response_model=RoomResult)
async def calculate_room(body: RoomInput):
    L, W, H = body.length, body.width, body.height
    perimeter = 2 * (L + W)
    floor_area = L * W
    total_volume = L * W * H

    # Ceiling
    if body.ceiling_type == "slope":
        angle_rad = math.radians(body.slope_angle)
        ceiling_area_gross = L * W / math.cos(angle_rad)
    else:
        ceiling_area_gross = floor_area
    ceiling_area = ceiling_area_gross
    cornice_area = perimeter * body.cornice_width

    # Walls
    wall_area_gross = perimeter * H + body.extra_wall_area
    door_area = body.door_count * body.door_width * body.door_height
    window_area = body.window_count * body.window_width * body.window_height
    wall_area_net = max(0.0, wall_area_gross - door_area - window_area - body.extra_opening_area)

    # Skirting
    skirting_length = perimeter - body.door_count * body.door_width
    skirting_area = skirting_length * body.skirting_height

    # Floor
    floor_screed_volume = floor_area * body.floor_screed_thickness

    # Tile
    wall_tile_area = max(0.0, perimeter * min(body.tile_height, H) - door_area - window_area) if body.tile_height > 0 else 0.0

    def r(v: float) -> float:
        return round(v, 3)

    return RoomResult(
        perimeter=r(perimeter),
        floor_area=r(floor_area),
        ceiling_area=r(ceiling_area),
        total_volume=r(total_volume),
        wall_area_gross=r(wall_area_gross),
        wall_area_net=r(wall_area_net),
        wall_tile_area=r(wall_tile_area),
        door_area=r(door_area),
        window_area=r(window_area),
        ceiling_area_gross=r(ceiling_area_gross),
        cornice_area=r(cornice_area),
        floor_screed_volume=r(floor_screed_volume),
        skirting_length=r(skirting_length),
        skirting_area=r(skirting_area),
        paint_area_net=r(wall_area_net),
        wallpaper_area_net=r(wall_area_net),
    )
