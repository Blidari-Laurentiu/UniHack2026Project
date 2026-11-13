from fastapi import APIRouter, Depends

from auth import current_user

router = APIRouter(tags=["me"])


@router.get("/me")
def get_me(user: dict = Depends(current_user)):
    return user
