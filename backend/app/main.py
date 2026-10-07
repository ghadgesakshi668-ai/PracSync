import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import SessionLocal, init_db
from app.routers import auth, exams, experiments, faculty, student, submissions
from app.services.seed import seed_database

logger = logging.getLogger("pracsync")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if settings.SEED_ON_STARTUP:
        with SessionLocal() as db:
            seed_database(db, sample_activity=settings.SEED_SAMPLE_ACTIVITY)
    yield


app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    problems = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path", "form")]
        msg = str(err.get("msg", "Invalid value")).replace("Value error, ", "")
        problems.append(f"{'.'.join(loc)}: {msg}" if loc else msg)
    return JSONResponse(status_code=422, content={"detail": "Please check your input. " + "; ".join(problems)})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)          # full trace stays in the server log only
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}


for r in (auth.router, exams.router, experiments.router, faculty.router, student.router, submissions.router):
    app.include_router(r)
