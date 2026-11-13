from fastapi import APIRouter

from schemas.lease import NeighbourhoodStat

router = APIRouter(prefix="/pricing", tags=["pricing"])

# MOCK - replace (median per neighbourhood and room count from the listings table)
MOCK_NEIGHBOURHOODS = [
    NeighbourhoodStat(name="Complex Studențesc", median_eur_by_rooms={1: 330, 2: 430, 3: 560}, sample_size=28),
    NeighbourhoodStat(name="Fabric", median_eur_by_rooms={1: 360, 2: 470, 3: 600}, sample_size=24),
    NeighbourhoodStat(name="Iosefin", median_eur_by_rooms={1: 340, 2: 440, 3: 570}, sample_size=21),
    NeighbourhoodStat(name="Elisabetin", median_eur_by_rooms={1: 380, 2: 500, 3: 650}, sample_size=19),
    NeighbourhoodStat(name="Cetate", median_eur_by_rooms={1: 450, 2: 600, 3: 800}, sample_size=17),
    NeighbourhoodStat(name="Soarelui", median_eur_by_rooms={1: 320, 2: 420, 3: 540}, sample_size=22),
    NeighbourhoodStat(name="Circumvalațiunii", median_eur_by_rooms={1: 350, 2: 450, 3: 580}, sample_size=20),
    NeighbourhoodStat(name="Lipovei", median_eur_by_rooms={1: 340, 2: 440, 3: 560}, sample_size=18),
]


@router.get("/neighbourhoods", response_model=list[NeighbourhoodStat])
def list_neighbourhoods():
    return MOCK_NEIGHBOURHOODS  # MOCK - replace
