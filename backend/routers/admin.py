"""Role-protected endpoints (shared): admins list users, moderators and admins list reports.

Roles come from the access token, see auth.require_role. An admin without MFA gets 403.
"""

from fastapi import APIRouter, Depends

from auth import ADMIN_ROLE, MODERATOR_ROLE, require_role
from db import get_conn
from services.student import active_sql

router = APIRouter(prefix="/admin", tags=["admin"])

MAX_ROWS = 200


@router.get("/users", dependencies=[Depends(require_role(ADMIN_ROLE))])
def list_users(conn=Depends(get_conn)):
    """The newest users, at most MAX_ROWS. Admin only."""
    return conn.execute(
        f"""
        select id, auth0_sub, display_name, email, {active_sql()} as is_student, created_at
        from users
        order by created_at desc, id
        limit %s
        """,
        (MAX_ROWS,),
    ).fetchall()


@router.get("/reports", dependencies=[Depends(require_role(MODERATOR_ROLE, ADMIN_ROLE))])
def list_reports(conn=Depends(get_conn)):
    """The newest reports, at most MAX_ROWS. Moderators and admins."""
    return conn.execute(
        """
        select id, reporter_id, reported_user_id, event_id, group_id, reason, created_at
        from reports
        order by created_at desc, id
        limit %s
        """,
        (MAX_ROWS,),
    ).fetchall()
