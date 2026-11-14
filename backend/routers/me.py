from fastapi import APIRouter, Depends

from auth import caller_access, current_user

router = APIRouter(tags=["me"])


@router.get("/me")
def get_me(user: dict = Depends(current_user), access: dict = Depends(caller_access)):
    return {**user, "roles": sorted(access["roles"]), "mfa": access["mfa"]}
