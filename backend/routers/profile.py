from uuid import UUID

from fastapi import APIRouter, Depends

from auth import current_user
from schemas.events import Interest, ProfileIn, ProfileOut

router = APIRouter(prefix="/profile", tags=["profile"])

# MOCK - replace (select from interests)
MOCK_INTERESTS = [
    Interest(id=UUID("b1000000-0000-4000-8000-000000000001"), slug="theatre", label="Theatre"),
    Interest(id=UUID("b1000000-0000-4000-8000-000000000002"), slug="live_music", label="Live music"),
    Interest(id=UUID("b1000000-0000-4000-8000-000000000003"), slug="board_games", label="Board games"),
    Interest(id=UUID("b1000000-0000-4000-8000-000000000004"), slug="football", label="Football"),
    Interest(id=UUID("b1000000-0000-4000-8000-000000000005"), slug="hiking", label="Hiking"),
    Interest(id=UUID("b1000000-0000-4000-8000-000000000006"), slug="language_exchange", label="Language exchange"),
]
_BY_SLUG = {i.slug: i for i in MOCK_INTERESTS}


@router.get("/interests", response_model=list[Interest])
def list_interests():
    return MOCK_INTERESTS  # MOCK - replace


@router.get("", response_model=ProfileOut)
def get_profile(user: dict = Depends(current_user)):
    # MOCK - replace: join user_interests and user_availability
    return ProfileOut(
        display_name=user.get("display_name") or "Mei",
        is_student=bool(user.get("is_student")),
        interests=[_BY_SLUG["board_games"], _BY_SLUG["live_music"]],
        availability=["weekday_evening", "weekend_afternoon"],
    )


@router.put("", response_model=ProfileOut)
def save_profile(body: ProfileIn, user: dict = Depends(current_user)):
    # MOCK - replace: update display_name, replace user_interests and user_availability
    return ProfileOut(
        display_name=body.display_name,
        is_student=bool(user.get("is_student")),
        interests=[_BY_SLUG[s] for s in body.interest_slugs if s in _BY_SLUG],
        availability=sorted(set(body.availability)),
    )
