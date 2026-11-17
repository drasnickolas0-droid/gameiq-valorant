"""Idempotent Stripe catalog setup for GAMEIQ plans (one-time monthly passes)."""
import os
from pathlib import Path

import stripe
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

CATALOG = [
    {"emergent_product_id": "gameiq_pro", "name": "GAMEIQ Pro — 1 mês", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "gameiq_pro_month", "amount": 4990, "currency": "brl"}]},
    {"emergent_product_id": "gameiq_elite", "name": "GAMEIQ Elite — 1 mês", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "gameiq_elite_month", "amount": 9990, "currency": "brl"}]},
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            if p.name != entry["name"]:
                stripe.Product.modify(p.id, name=entry["name"])
            return p
    return stripe.Product.create(name=entry["name"], tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})


def sync(catalog=CATALOG):
    for entry in catalog:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
            if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]
                             or existing[0].product != product.id):
                stripe.Price.modify(existing[0].id, active=False)
                existing = []
            if not existing:
                stripe.Price.create(product=product.id, unit_amount=p["amount"], currency=p["currency"],
                                    lookup_key=p["lookup_key"], transfer_lookup_key=True)


if __name__ == "__main__":
    sync()
    print("catalog synced")
