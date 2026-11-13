# Timișoara rent ranges (rough sample data)

**Rough sample data for the hackathon demo, not a market study.** These are asking rents (what listings advertise), not signed contract prices, for furnished flats, in EUR per month. Checked on **2026-11-13**.

`db/seed_listings.py` generates listings by drawing prices from inside these ranges. The neighbourhood names below are exactly the names stored in `listings.neighbourhood`, with Romanian diacritics (comma-below ș and ț), matching `API.md`.

"Rooms" follows the Romanian convention (*camere*), which counts the living room: 1 = garsonieră or one-room flat, 2 = living room plus one bedroom, 3 = living room plus two bedrooms.

| Neighbourhood | 1 room | 2 rooms | 3 rooms | Basis |
| --- | --- | --- | --- | --- |
| Centru | 330–450 | 480–700 | 600–900 | Estimate: city average plus a premium for the centre |
| Elisabetin | 300–400 | 430–600 | 550–780 | Estimate: central, close to Centru |
| Circumvalațiunii | 300–400 | 420–580 | 520–720 | Estimate: around the city average |
| Iosefin | 280–380 | 400–550 | 500–700 | Sourced: expatlife.ai Iosefin, 2 rooms about 360–560 EUR |
| Fabric | 260–360 | 380–520 | 480–650 | Sourced: expatlife.ai Fabric, 2 rooms about 260–440 EUR; one of the cheapest areas per m² for sale (Imobiliare.ro) |
| Complex Studențesc | 220–350 | 380–520 | 480–650 | Sourced: live listings, studios about 170–350 EUR (Storia, OLX, Romimo) |
| Girocului | 280–380 | 400–550 | 500–700 | Estimate: newer blocks, around the city average |
| Tipografilor | 270–360 | 400–540 | 500–680 | Estimate: around the city average |
| Dâmbovița | 260–350 | 380–500 | 470–620 | Estimate: slightly below average |
| Calea Șagului | 250–330 | 360–480 | 450–600 | Estimate: outer area, below average |

Rows marked "Estimate" have no neighbourhood-specific source. They take the city-wide figures below and shift them according to where the area sits relative to the centre and the cheaper areas. Treat them as plausible, not measured.

## City-wide anchors

- Storia, June 2026 averages for Timișoara: garsonieră 300 EUR, 2 rooms 436 EUR, 3 rooms 500 EUR. July 2026: 2 rooms 450 EUR, 3 rooms 500 EUR.
- Global Property Guide, Q3 2026: studio about 300 EUR, one-bedroom about 450 EUR, two-bedroom about 550 EUR.
- Imobiliare.ro Market 360, Q4 2025: average rent about 500 EUR; cheapest areas CUG 399 EUR, Galata 400 EUR, Dacia 400 EUR.
- Storia, April 2026: Timișoara rents up 8% year on year, the largest rise among the cities in that report.

## Sources (checked 2026-11-13)

- Storia newsroom, rent analysis before the new academic year: https://www.storia.ro/blog/newsroom/analiza-storia-cautarile-pentru-chirii-se-intensifica-in-perioada-premergatoare-noului-an-universitar-contactarile-au-crescut-cu-45-fata-de-iunie
- Revista Biz, the same Storia figures: https://www.revistabiz.ro/cautarile-pentru-chirii-cresc-in-perioada-premergatoare-noului-an-universitar-cat-de-mari-sunt-preturile/
- Storia newsroom, April 2026 rent analysis: https://www.storia.ro/blog/newsroom/analiza-storia-piata-chiriilor-s-a-temperat-in-luna-aprilie-1-de-la-un-an-la-altul-si-aproape-2-fata-de-luna-precedenta
- Economedia, Storia April analysis by city: https://economedia.ro/analiza-storia-preturile-chiriilor-din-romania-ar-fi-scazut-sau-stagnat-in-aprilie-fata-de-luna-trecuta-care-sunt-orasele-cu-cele-mai-mari-si-cele-mai-mici-preturi.html
- Adevărul, Timișoara the most affordable large city for rent: https://adevarul.ro/stiri-locale/timisoara/chiriile-cresc-timisoara-ramane-cel-mai-accesibil-2286539.html
- Global Property Guide, Romania rental yields: https://www.globalpropertyguide.com/Europe/Romania/rental-yields
- expatlife.ai, Fabric: https://expatlife.ai/romania/cities/timisoara/neighborhoods/fabric
- expatlife.ai, Iosefin: https://expatlife.ai/romania/cities/timisoara/neighborhoods/iosefin
- Wall-Street.ro, cheaper neighbourhoods by price per m²: https://www.wall-street.ro/articol/imobiliare/infografic-acestea-sunt-cartierele-cu-apartamente-ieftine-din-marile-orase.html
- Storia listing, studio in Complexul Studențesc: https://www.storia.ro/ro/oferta/garsoniera-in-complexul-studentesc-toate-cheltuielile-incluse-IDyz7S
- OLX listing, one room in Complex Studențesc (posted 2026-11-02): https://www.olx.ro/d/oferta/apartament-cu-1-camera-de-inchiriat-complex-studentesc-timisoara-IDl4ImQ.html
- Romimo, studios for rent in Timișoara: https://www.romimo.ro/Apartamente/Garsoniera/inchiriere/Timis/Timisoara/?pag=4

The sources mix methods and periods (asking prices from different portals and months), so do not compare them directly. We read them for the overall level, not for exact numbers.
