import os
import json
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

# Load stripe_products.json for configuration
BACKEND_DIR = Path(__file__).parent
STRIPE_PRODUCTS_FILE = BACKEND_DIR / "stripe_products.json"

def load_stripe_products():
    """Load stripe products configuration from JSON file."""
    if STRIPE_PRODUCTS_FILE.exists():
        with open(STRIPE_PRODUCTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

STRIPE_CONFIG = load_stripe_products()

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./oppine.db")

    # Sentry Configuration
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

    # Storage Configuration
    # USE_S3_STORAGE from environment (True/False string) -> STORAGE_MODE (s3/local)
    STORAGE_MODE: str = "s3" if os.getenv("USE_S3_STORAGE", "False").lower() == "true" else os.getenv("STORAGE_MODE", "local")
    LOCAL_MEDIA_PATH: str = os.getenv("LOCAL_MEDIA_PATH", "media")

    # AWS S3 Configuration
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET_NAME", os.getenv("AWS_S3_BUCKET", ""))
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")

    # Stripe Configuration
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    # Plan Limits loaded from stripe_products.json (single source of truth)
    # All plans can edit templates - starter has 10 limit, growth unlimited
    PLAN_LIMITS: dict = {
        "starter": next((p["limits"] for p in (STRIPE_CONFIG or {}).get("products", []) if p["tier"] == "starter"), {"messages_per_month": 50, "businesses": 1, "templates_per_account": 10}),
        "growth": next((p["limits"] for p in (STRIPE_CONFIG or {}).get("products", []) if p["tier"] == "growth"), {"messages_per_month": -1, "businesses": -1, "templates_per_account": -1}),
    }

    # Oppine App Configuration
    APP_DOMAIN: str = os.getenv("APP_DOMAIN", "https://app.oppine.com.br")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")

    # Stripe Price IDs - Multi-currency support
    # Format: STRIPE_PRICE_ID_{TIER}_{INTERVAL}_{CURRENCY}
    # USD prices
    STRIPE_PRICE_ID_STARTER_MONTHLY_USD: str = os.getenv("STRIPE_PRICE_ID_STARTER_MONTHLY_USD", "")
    STRIPE_PRICE_ID_STARTER_ANNUAL_USD: str = os.getenv("STRIPE_PRICE_ID_STARTER_ANNUAL_USD", "")
    STRIPE_PRICE_ID_GROWTH_MONTHLY_USD: str = os.getenv("STRIPE_PRICE_ID_GROWTH_MONTHLY_USD", "")
    STRIPE_PRICE_ID_GROWTH_ANNUAL_USD: str = os.getenv("STRIPE_PRICE_ID_GROWTH_ANNUAL_USD", "")

    # BRL prices
    STRIPE_PRICE_ID_STARTER_MONTHLY_BRL: str = os.getenv("STRIPE_PRICE_ID_STARTER_MONTHLY_BRL", "")
    STRIPE_PRICE_ID_STARTER_ANNUAL_BRL: str = os.getenv("STRIPE_PRICE_ID_STARTER_ANNUAL_BRL", "")
    STRIPE_PRICE_ID_GROWTH_MONTHLY_BRL: str = os.getenv("STRIPE_PRICE_ID_GROWTH_MONTHLY_BRL", "")
    STRIPE_PRICE_ID_GROWTH_ANNUAL_BRL: str = os.getenv("STRIPE_PRICE_ID_GROWTH_ANNUAL_BRL", "")

    # EUR prices
    STRIPE_PRICE_ID_STARTER_MONTHLY_EUR: str = os.getenv("STRIPE_PRICE_ID_STARTER_MONTHLY_EUR", "")
    STRIPE_PRICE_ID_STARTER_ANNUAL_EUR: str = os.getenv("STRIPE_PRICE_ID_STARTER_ANNUAL_EUR", "")
    STRIPE_PRICE_ID_GROWTH_MONTHLY_EUR: str = os.getenv("STRIPE_PRICE_ID_GROWTH_MONTHLY_EUR", "")
    STRIPE_PRICE_ID_GROWTH_ANNUAL_EUR: str = os.getenv("STRIPE_PRICE_ID_GROWTH_ANNUAL_EUR", "")

    # Country to Currency mapping (loaded from stripe_products.json)
    COUNTRY_CURRENCY_MAP: dict = STRIPE_CONFIG.get("country_currency_map", {
        "BR": "BRL",
        "US": "USD",
        "default": "USD"
    }) if STRIPE_CONFIG else {"BR": "BRL", "US": "USD", "default": "USD"}

    # Currency symbols
    CURRENCY_SYMBOLS: dict = STRIPE_CONFIG.get("currency_symbols", {
        "USD": "$",
        "BRL": "R$",
        "EUR": "€"
    }) if STRIPE_CONFIG else {"USD": "$", "BRL": "R$", "EUR": "€"}

    # Google Business Profile Integration
    GOOGLE_INTEGRATION_ENABLED: bool = os.getenv("GOOGLE_INTEGRATION_ENABLED", "false").lower() == "true"
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "")  # Frontend URL that handles OAuth callback
    GOOGLE_TOKEN_ENCRYPTION_KEY: str = os.getenv("GOOGLE_TOKEN_ENCRYPTION_KEY", "")  # Fernet key for encrypting refresh tokens

    # Angular Hub Integration (SSO)
    ANGULAR_HUB_ENABLED: bool = os.getenv("ANGULAR_HUB_ENABLED", "false").lower() == "true"
    ANGULAR_HUB_API_URL: str = os.getenv("ANGULAR_HUB_API_URL", "https://api-hmg.angularhub.com.br")
    ANGULAR_HUB_SAAS_SLUG: str = os.getenv("ANGULAR_HUB_SAAS_SLUG", "oppine")
    ANGULAR_HUB_SAAS_ID: str = os.getenv("ANGULAR_HUB_SAAS_ID", "")  # UUID of the SaaS in Hub
    ANGULAR_HUB_API_KEY: str = os.getenv("ANGULAR_HUB_API_KEY", "")
    ANGULAR_HUB_JWT_SECRET: str = os.getenv("ANGULAR_HUB_JWT_SECRET", "")
    ANGULAR_HUB_WEBHOOK_SECRET: str = os.getenv("ANGULAR_HUB_WEBHOOK_SECRET", "")

    model_config = {
        "env_file": ".env",
        "extra": "allow"  # Allow extra fields from .env
    }

    def get_price_id(self, tier: str, interval: str, currency: str) -> Optional[str]:
        """Get the Stripe Price ID for a given tier, interval, and currency."""
        attr_name = f"STRIPE_PRICE_ID_{tier.upper()}_{interval.upper()}_{currency.upper()}"
        return getattr(self, attr_name, None) or None

    def get_tier_from_price_id(self, price_id: str) -> str:
        """Determine the tier name from a Stripe Price ID."""
        if not price_id:
            return "starter"

        # Check all price ID attributes to find a match
        for tier in ["starter", "growth"]:
            for interval in ["monthly", "annual"]:
                for currency in ["USD", "BRL", "EUR"]:
                    attr_name = f"STRIPE_PRICE_ID_{tier.upper()}_{interval.upper()}_{currency}"
                    if getattr(self, attr_name, None) == price_id:
                        return tier

        # Fallback: try to extract tier from price_id metadata (if it contains tier name)
        price_id_lower = price_id.lower()
        for tier in ["growth", "starter"]:  # Check in order of precedence
            if tier in price_id_lower:
                return tier

        return "starter"

    def get_currency_from_country(self, country_code: str) -> str:
        """Get the currency for a given country code."""
        return self.COUNTRY_CURRENCY_MAP.get(
            country_code.upper(),
            self.COUNTRY_CURRENCY_MAP.get("default", "USD")
        )

    def get_products_config(self) -> dict:
        """Get the full products configuration from stripe_products.json."""
        return STRIPE_CONFIG or {}


settings = Settings()


def _build_slug_plan_limits() -> dict:
    """
    Build plan limits mapping keyed by Hub slug (e.g. 'oppine-starter-monthly').
    Single source derived from settings.PLAN_LIMITS.
    """
    starter_limits = settings.PLAN_LIMITS.get("starter", {})
    growth_limits = settings.PLAN_LIMITS.get("growth", {})

    return {
        "oppine-starter-monthly": {**starter_limits, "period": "monthly"},
        "oppine-starter-yearly": {**starter_limits, "period": "monthly"},
        "oppine-growth-monthly": {**growth_limits, "period": "unlimited"},
        "oppine-growth-yearly": {**growth_limits, "period": "unlimited"},
    }


SLUG_PLAN_LIMITS = _build_slug_plan_limits()
DEFAULT_STARTER_LIMITS = SLUG_PLAN_LIMITS["oppine-starter-monthly"]
