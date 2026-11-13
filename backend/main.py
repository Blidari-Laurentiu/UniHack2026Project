from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import pool
from routers import events, health, lease, me, pricing, profile


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

for module in (health, me, lease, pricing, events, profile):
    app.include_router(module.router)
