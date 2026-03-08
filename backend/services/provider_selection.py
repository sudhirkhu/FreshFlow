"""
Nearest-provider selection service.

When the customer does not pick a specific laundry provider, the system
auto-selects the best match based on:
  1. Same city / zipcode (exact match first, then same city)
  2. Services requested vs. services offered
  3. Provider rating (higher is better)
  4. Distance approximation via zipcode proximity

Future enhancement: plug in a real geocoding API (Google Maps, Mapbox) for
lat/lng distance calculations.
"""

import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)


# Simple zipcode-to-approximate-coordinates for Frisco, TX area.
# In production, call a geocoding API or maintain a zipcode lookup table.
ZIPCODE_COORDS = {
    "75034": (33.1507, -96.8236),
    "75035": (33.1872, -96.8050),
    "75033": (33.1310, -96.8480),
    "75036": (33.1700, -96.7800),
    "75070": (33.1382, -96.6331),  # McKinney
    "75069": (33.1972, -96.6150),  # McKinney
    "75024": (33.0700, -96.8050),  # Plano
    "75025": (33.0800, -96.7500),  # Plano
    "75071": (33.2200, -96.6700),  # McKinney
}


def _zipcode_distance(zip_a: str, zip_b: str) -> float:
    """Rough Euclidean distance between two zipcodes using known coords.
    Returns a large number if either zipcode is unknown."""
    coord_a = ZIPCODE_COORDS.get(zip_a)
    coord_b = ZIPCODE_COORDS.get(zip_b)
    if not coord_a or not coord_b:
        return 999.0  # unknown → push to end
    return ((coord_a[0] - coord_b[0]) ** 2 + (coord_a[1] - coord_b[1]) ** 2) ** 0.5


def _services_match_score(requested_services: List[str], offered_services: List[str]) -> float:
    """Fraction of requested services that the provider offers (0.0 – 1.0)."""
    if not requested_services:
        return 1.0
    matched = sum(1 for s in requested_services if s in offered_services)
    return matched / len(requested_services)


async def select_nearest_provider(
    db,
    pickup_city: str,
    pickup_zipcode: str,
    requested_services: Optional[List[str]] = None,
) -> Optional[Dict]:
    """
    Return the best-matching active provider for the given pickup location.

    Selection strategy:
      - Filter active providers
      - Score each provider by: service match (40%), rating (30%), distance (30%)
      - Return the highest-scoring provider
    """

    providers = await db.service_providers.find(
        {"status": "active"}, {"_id": 0}
    ).to_list(200)

    if not providers:
        logger.warning("No active providers found in the database")
        return None

    requested = requested_services or []

    scored: list[tuple[float, dict]] = []
    for p in providers:
        svc_score = _services_match_score(requested, p.get("services", []))
        rating_score = p.get("rating", 0) / 5.0  # normalize to 0-1
        dist = _zipcode_distance(pickup_zipcode, p.get("zipcode", ""))

        # Same-city bonus
        city_bonus = 0.2 if p.get("city", "").lower() == pickup_city.lower() else 0.0

        # Distance score: inverse, cap at 1.0
        dist_score = max(0.0, 1.0 - dist * 10)  # scale so ~0.1 degree ≈ score 0

        total = (
            svc_score * 0.35
            + rating_score * 0.25
            + dist_score * 0.20
            + city_bonus
        )
        scored.append((total, p))

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_provider = scored[0]

    logger.info(
        "Auto-selected provider '%s' (score=%.2f) for pickup zip=%s city=%s",
        best_provider.get("business_name"),
        best_score,
        pickup_zipcode,
        pickup_city,
    )

    return best_provider
