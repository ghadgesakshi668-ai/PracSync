"""FastAPI dependencies: current user + role-based authorisation."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.constants import Role
from app.database import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorised = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Your session has expired or is invalid. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorised
    payload = decode_access_token(creds.credentials)
    if not payload or "sub" not in payload:
        raise unauthorised
    try:
        user = db.get(User, int(payload["sub"]))
    except (TypeError, ValueError):
        raise unauthorised
    if user is None:
        raise unauthorised
    return user


def require_faculty(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.FACULTY:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This action is only available to faculty.")
    return user


def require_student(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.STUDENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This action is only available to students.")
    return user
