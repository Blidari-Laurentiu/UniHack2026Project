"""Feature A (Person A): lease check and pricing."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high"]


class LeaseAnalyzeRequest(BaseModel):
    lease_text: str = Field(min_length=50, max_length=50_000)
    neighbourhood: str = Field(min_length=1, max_length=80)
    rooms: int = Field(ge=1, le=5)
    rent_eur: float = Field(gt=0, le=20_000)
    ui_language: Literal["en", "ro"] = "en"


# Gemini report: also used as the response_schema for structured output.
class RiskyClause(BaseModel):
    quote: str  # original language, under 25 words
    category: str  # e.g. deposit, termination, repairs, utilities, rent_increase
    severity: Severity
    why: str
    suggestion: str


class MissingClause(BaseModel):
    name: str
    why: str


class LeaseReport(BaseModel):
    summary: str
    overall_risk: Severity
    risky_clauses: list[RiskyClause]
    missing_clauses: list[MissingClause]


class PriceVerdict(BaseModel):
    median_eur: float
    diff_pct: float  # (rent - median) / median * 100
    verdict: Literal["below_market", "fair", "above_market", "suspiciously_low"]
    scope: Literal["neighbourhood", "city"]
    sample_size: int


class LeaseAnalysis(BaseModel):
    id: UUID
    created_at: datetime
    neighbourhood: str
    rooms: int
    rent_eur: float
    report: LeaseReport | None  # None when Gemini failed
    report_error: str | None = None
    price_verdict: PriceVerdict  # always present, even if Gemini failed


class LeaseAnalysisSummary(BaseModel):
    id: UUID
    created_at: datetime
    neighbourhood: str
    rooms: int
    rent_eur: float
    overall_risk: Severity | None
    verdict: Literal["below_market", "fair", "above_market", "suspiciously_low"]


class NeighbourhoodStat(BaseModel):
    name: str
    median_eur_by_rooms: dict[int, float]
    sample_size: int
