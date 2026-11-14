import logging
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from db import pool
from routers import events, health, lease, me, pricing, profile

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open(wait=False)
    try:
        yield
    finally:
        pool.close()


app = FastAPI(title="Timisoara Newcomer Hub", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database down, pool exhausted (PoolTimeout is a psycopg.Error) or a failed query anywhere,
# including inside the get_conn dependency: answer 503 {"detail": ...}. A handler for a specific
# exception class runs inside the CORS middleware, so the browser can read this response; an
# unhandled 500 has no CORS headers and the frontend would only see "Cannot reach the API".
@app.exception_handler(psycopg.Error)
async def database_error(request: Request, exc: psycopg.Error) -> JSONResponse:
    log.warning("database error on %s %s: %s", request.method, request.url.path, type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is unavailable right now. Please try again."},
    )


for module in (health, me, lease, pricing, events, profile):
    app.include_router(module.router)
