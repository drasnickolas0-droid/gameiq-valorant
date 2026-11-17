import asyncio
import os
import uuid
import logging
from contextlib import suppress
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, AsyncGenerator

import requests
import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
import re
import json
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

RIOT_ID_RE = re.compile(r"^[^#]{3,16}#[A-Za-z0-9]{2,5}$")
FREE_AI_MONTHLY = 10
FREE_MANUAL_CHALLENGES = 3

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"


def stripe_sync_plan(slug: str, name: str, price_cents: int) -> None:
    try:
        from backend.setup_stripe import sync
    except ModuleNotFoundError:
        from setup_stripe import sync
    sync([{"emergent_product_id": f"gameiq_{slug}", "name": f"GAMEIQ {name} — 1 mês", "tax_code": "txcd_10103001",
           "prices": [{"lookup_key": f"gameiq_{slug}_month", "amount": price_cents, "currency": "brl"}]}])


try:
    from backend.clerk_auth import clerk_router, require_user
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

ROLES = ["admin", "member"]
DEFAULT_ROLE = "member"
RETIRED_ROLES: dict = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "plans": [IndexModel([("slug", ASCENDING)], name="slug", unique=True)],
    "subscriptions": [IndexModel([("user_id", ASCENDING)], name="user_id"),
                      IndexModel([("created_at", DESCENDING)], name="created_desc")],
    "payments": [IndexModel([("user_id", ASCENDING)], name="user_id"),
                 IndexModel([("created_at", DESCENDING)], name="created_desc")],
    "challenges": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "matches": [IndexModel([("user_id", ASCENDING), ("played_at", DESCENDING)], name="user_played")],
    "riot_accounts": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "ai_chat": [IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)], name="user_created")],
    "payment_transactions": [IndexModel([("session_id", ASCENDING)], name="session_id", unique=True),
                             IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "ai_usage": [IndexModel([("user_id", ASCENDING), ("month", ASCENDING)], name="user_month", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logging.getLogger(__name__).error("ensure_indexes(%s): %s", collection, exc)


app = FastAPI()
api_router = APIRouter(prefix="/api")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PlanOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slug: str; name: str; price_cents: int; currency: str = "BRL"
    tagline: str; features: List[str]; highlighted: bool = False

class PlanUpdate(BaseModel):
    name: Optional[str] = None; price_cents: Optional[int] = None
    tagline: Optional[str] = None; features: Optional[List[str]] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None; goal: Optional[str] = None; rank: Optional[str] = None

class MatchIn(BaseModel):
    agent: str = Field(min_length=1, max_length=30); map: str = Field(min_length=1, max_length=30)
    result: Literal["win", "loss", "draw"]
    kills: int = Field(ge=0, le=200); deaths: int = Field(ge=0, le=200); assists: int = Field(ge=0, le=200)
    acs: int = Field(ge=0, le=1000); adr: int = Field(ge=0, le=1000); kast: int = Field(ge=0, le=100)
    played_at: Optional[str] = None; notes: Optional[str] = None

class ChallengeIn(BaseModel):
    title: str; description: str; difficulty: str = "medium"

class CompleteChallengeIn(BaseModel):
    completed: bool

class RiotLinkIn(BaseModel):
    riot_id: str; region: str; manual: bool = True

class WeaknessAnswersIn(BaseModel):
    answers: dict

class AICoachIn(BaseModel):
    message: str; session_id: Optional[str] = None

class RoleIn(BaseModel):
    role: str


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def _clerk_user(user_id: str) -> dict:
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
        headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "gameiq"})
    r.raise_for_status()
    return r.json()


def _is_admin_email(user_id: str) -> bool:
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    if not admins: return False
    cu = _clerk_user(user_id)
    return any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
               for e in cu["email_addresses"])


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role"):
        role = "admin" if await run_in_threadpool(_is_admin_email, uid) else DEFAULT_ROLE
        try:
            cu = await run_in_threadpool(_clerk_user, uid)
            emails = cu.get("email_addresses", [])
            pid = cu.get("primary_email_address_id")
            email = next((e["email_address"] for e in emails if e["id"] == pid),
                         emails[0]["email_address"] if emails else "")
            name = ((cu.get("first_name") or "") + " " + (cu.get("last_name") or "")).strip() or email.split("@")[0]
            avatar = cu.get("image_url")
        except Exception:
            email, name, avatar = "", "", None
        new_doc = {"user_id": uid, "role": role, "env": ENV, "email": email, "name": name,
                   "avatar_url": avatar, "display_name": name, "plan_slug": "free",
                   "goal": None, "rank": None, "created_at": now_iso()}
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role}})
        member = await db.users.find_one_and_update({"user_id": uid}, {"$setOnInsert": new_doc},
            upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    exp = member.get("plan_expires_at")
    if member.get("plan_slug", "free") != "free" and exp and datetime.fromisoformat(exp) < datetime.now(timezone.utc):
        await db.users.update_one({"user_id": uid}, {"$set": {"plan_slug": "free", "plan_expires_at": None}})
        await db.subscriptions.update_many({"user_id": uid, "status": "active"},
                                           {"$set": {"status": "expired", "expired_at": now_iso()}})
        member = {**member, "plan_slug": "free", "plan_expires_at": None}
    return {**member, "env": ENV, "role": effective_role(member["role"])}


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


DEFAULT_PLANS = [
    {"slug": "free", "name": "Free", "price_cents": 0, "currency": "BRL",
     "tagline": "Comece sua jornada competitiva",
     "features": ["Análise básica de desempenho", "10 mensagens AI Coach/mês",
                  "3 desafios manuais", "Entrada manual de estatísticas"], "highlighted": False},
    {"slug": "pro", "name": "Pro", "price_cents": 1490, "currency": "BRL",
     "tagline": "Acesso completo ao treinador GAMEIQ",
     "features": ["AI Coach ilimitado (Claude Sonnet 5.5)", "Análises detalhadas",
                  "Desafios personalizados por IA", "Histórico completo",
                  "Recomendações por agente/mapa"], "highlighted": True},
    {"slug": "elite", "name": "Elite", "price_cents": 2490, "currency": "BRL",
     "tagline": "Para jogadores competitivos sérios",
     "features": ["Tudo do Pro, sem limites", "Relatórios avançados",
                  "Análise profunda K/D, ACS, KAST, ADR",
                  "Comparativo histórico completo", "Recursos exclusivos ranqueadas"],
     "highlighted": False},
]


async def seed_plans():
    for p in DEFAULT_PLANS:
        await db.plans.update_one({"slug": p["slug"]}, {"$setOnInsert": p}, upsert=True)


@api_router.get("/")
async def root():
    return {"message": "GAMEIQ API", "version": "1.0"}


@api_router.get("/plans")
async def list_plans():
    plans = await db.plans.find({}, {"_id": 0}).to_list(50)
    order = {"free": 0, "pro": 1, "elite": 2}
    plans.sort(key=lambda p: order.get(p["slug"], 99))
    return plans


@api_router.get("/me")
async def get_me(member: dict = Depends(current_member)):
    riot = await db.riot_accounts.find_one({"user_id": member["user_id"]}, {"_id": 0})
    return {
        "user_id": member["user_id"], "email": member.get("email", ""),
        "name": member.get("name", ""), "avatar_url": member.get("avatar_url"),
        "display_name": member.get("display_name") or member.get("name", ""),
        "created_at": member.get("created_at"), "role": member["role"],
        "plan_slug": member.get("plan_slug", "free"), "goal": member.get("goal"),
        "rank": member.get("rank"), "game": member.get("game", "valorant"),
        "riot_connected": bool(riot), "riot_id": riot["riot_id"] if riot else None,
    }


@api_router.patch("/me")
async def update_me(body: ProfileUpdate, member: dict = Depends(current_member)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": member["user_id"]}, {"$set": update})
    return {"ok": True}


@api_router.delete("/me")
async def delete_me(member: dict = Depends(current_member)):
    uid = member["user_id"]
    for coll in ("users", "subscriptions", "payments", "challenges", "matches",
                 "riot_accounts", "ai_chat", "ai_usage"):
        await db[coll].delete_many({"user_id": uid})
    try:
        requests.delete(f"https://api.clerk.com/v1/users/{uid}", timeout=10,
            headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "gameiq"})
    except Exception:
        pass
    return {"ok": True}


@api_router.get("/subscription")
async def get_subscription(member: dict = Depends(current_member)):
    sub = await db.subscriptions.find_one({"user_id": member["user_id"], "status": "active"}, {"_id": 0},
                                          sort=[("created_at", -1)])
    plan_slug = member.get("plan_slug", "free")
    if not sub or plan_slug == "free":
        return {"user_id": member["user_id"], "plan_slug": "free", "status": "active",
                "started_at": member.get("created_at"), "expires_at": None,
                "payment_method": None, "price_cents": 0, "currency": "BRL",
                "account_email": member.get("email", "")}
    return {"user_id": member["user_id"], "plan_slug": sub["plan_slug"], "status": sub["status"],
            "started_at": sub.get("started_at"), "expires_at": sub.get("expires_at"),
            "payment_method": sub.get("payment_method"),
            "price_cents": sub.get("amount_cents", 0), "currency": "BRL",
            "account_email": member.get("email", "")}


class CheckoutIn(BaseModel):
    plan_slug: Literal["pro", "elite"]
    confirm_email: str
    origin_url: str


@api_router.post("/payments/checkout")
async def create_checkout(body: CheckoutIn, member: dict = Depends(current_member)):
    if body.confirm_email.strip().lower() != member.get("email", "").lower():
        raise HTTPException(status_code=400, detail="E-mail de confirmação não bate com a conta")
    if not re.match(r"^https?://[^\s/]+$", body.origin_url.rstrip("/")):
        raise HTTPException(status_code=400, detail="origin_url inválida")
    plan = await db.plans.find_one({"slug": body.plan_slug}, {"_id": 0})
    if not plan or plan["price_cents"] <= 0:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    origin = body.origin_url.rstrip("/")
    lookup_key = f"gameiq_{body.plan_slug}_month"

    def _create():
        prices = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data
        if not prices or prices[0].unit_amount != plan["price_cents"]:
            stripe_sync_plan(body.plan_slug, plan["name"], plan["price_cents"])
            prices = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data
        price = prices[0]
        session = stripe.checkout.Session.create(
            line_items=[{"price": price.id, "quantity": 1}], mode="payment",
            payment_method_types=["card", "pix"],
            customer_email=member.get("email") or None,
            success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/payment/cancel",
            client_reference_id=member["user_id"],
            metadata={"user_id": member["user_id"], "plan_slug": body.plan_slug, "lookup_key": lookup_key},
        )
        return session, price

    try:
        session, price = await run_in_threadpool(_create)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe indisponível: {exc.user_message or str(exc)[:200]}")
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "user_id": member["user_id"],
        "email": member.get("email", ""), "plan_slug": body.plan_slug, "lookup_key": lookup_key,
        "amount_cents": price.unit_amount, "currency": price.currency,
        "status": "initiated", "payment_status": "pending", "fulfilled": False, "env": ENV,
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def fulfill_session(session_id: str, payment_method: Optional[str] = None,
                          payment_intent: Optional[str] = None) -> None:
    """Mark paid and activate the plan exactly once."""
    tx = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "fulfilled": False},
        {"$set": {"status": "completed", "payment_status": "paid", "fulfilled": True,
                  "payment_method": payment_method, "stripe_payment_intent_id": payment_intent,
                  "updated_at": now_iso()}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not tx:
        return
    now = datetime.now(timezone.utc)
    user = await db.users.find_one({"user_id": tx["user_id"]}, {"_id": 0})
    current_exp = None
    if user and user.get("plan_slug") == tx["plan_slug"] and user.get("plan_expires_at"):
        current_exp = datetime.fromisoformat(user["plan_expires_at"])
    base = current_exp if current_exp and current_exp > now else now
    expires = (base + timedelta(days=30)).isoformat()
    await db.subscriptions.update_many({"user_id": tx["user_id"], "status": "active"},
                                       {"$set": {"status": "replaced", "replaced_at": now_iso()}})
    pm_label = {"card": "Cartão", "pix": "Pix"}.get(payment_method or "", payment_method or "Stripe")
    await db.subscriptions.insert_one({
        "id": str(uuid.uuid4()), "user_id": tx["user_id"], "plan_slug": tx["plan_slug"], "status": "active",
        "started_at": now_iso(), "expires_at": expires, "payment_method": pm_label,
        "amount_cents": tx["amount_cents"], "session_id": session_id, "env": ENV, "created_at": now_iso(),
    })
    await db.users.update_one({"user_id": tx["user_id"]},
                              {"$set": {"plan_slug": tx["plan_slug"], "plan_expires_at": expires}})
    await db.payments.insert_one({
        "id": str(uuid.uuid4()), "user_id": tx["user_id"], "email": tx.get("email", ""),
        "plan_slug": tx["plan_slug"], "amount_cents": tx["amount_cents"], "currency": tx["currency"].upper(),
        "status": "paid", "payment_method": pm_label, "session_id": session_id, "env": ENV,
        "created_at": now_iso(),
    })


def _session_payment_method(s) -> Optional[str]:
    try:
        if s.get("payment_intent"):
            pi = stripe.PaymentIntent.retrieve(s["payment_intent"])
            types = pi.get("payment_method_types") or []
            if pi.get("payment_method"):
                return stripe.PaymentMethod.retrieve(pi["payment_method"]).get("type")
            return types[0] if types else None
    except stripe.error.StripeError:
        return None
    return None


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, member: dict = Depends(current_member)):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": member["user_id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    if tx["payment_status"] not in ("paid", "failed", "expired"):
        try:
            s = await run_in_threadpool(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid":
                pm = await run_in_threadpool(_session_payment_method, s)
                await fulfill_session(session_id, pm, s.get("payment_intent"))
            elif s.status == "expired":
                await db.payment_transactions.update_one({"session_id": session_id, "fulfilled": False},
                    {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now_iso()}})
            elif s.status == "complete":
                await db.payment_transactions.update_one({"session_id": session_id, "fulfilled": False},
                    {"$set": {"status": "awaiting_payment", "updated_at": now_iso()}})
            tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": session_id, "status": tx["status"], "payment_status": tx["payment_status"],
            "plan_slug": tx["plan_slug"]}


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, os.environ.get("STRIPE_WEBHOOK_SECRET", ""))
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if obj.get("payment_status") == "paid":
            pm = await run_in_threadpool(_session_payment_method, obj)
            await fulfill_session(obj["id"], pm, obj.get("payment_intent"))
        else:
            await db.payment_transactions.update_one({"session_id": obj["id"], "fulfilled": False},
                {"$set": {"status": "awaiting_payment", "updated_at": now_iso()}})
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"], "fulfilled": False},
            {"$set": {"status": "failed", "payment_status": "failed", "updated_at": now_iso()}})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"], "fulfilled": False},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now_iso()}})
    elif t == "charge.refunded":
        await db.payment_transactions.update_one({"stripe_payment_intent_id": obj.get("payment_intent")},
            {"$set": {"status": "refunded", "payment_status": "refunded", "updated_at": now_iso()}})
        await db.payments.update_one({"session_id": {"$exists": True}, "status": "paid",
                                      "user_id": (obj.get("metadata") or {}).get("user_id", "__none__")},
                                     {"$set": {"status": "refunded"}})
    return {"status": "ok"}


@api_router.post("/subscription/cancel")
async def cancel_subscription(member: dict = Depends(current_member)):
    await db.subscriptions.update_many({"user_id": member["user_id"], "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": now_iso()}})
    await db.users.update_one({"user_id": member["user_id"]},
                              {"$set": {"plan_slug": "free", "plan_expires_at": None}})
    return {"ok": True}


@api_router.get("/payments")
async def list_payments(member: dict = Depends(current_member)):
    return await db.payments.find({"user_id": member["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api_router.get("/matches")
async def list_matches(member: dict = Depends(current_member)):
    return await db.matches.find({"user_id": member["user_id"]}, {"_id": 0}).sort("played_at", -1).to_list(200)


@api_router.post("/matches")
async def add_match(body: MatchIn, member: dict = Depends(current_member)):
    doc = {"id": str(uuid.uuid4()), "user_id": member["user_id"], **body.model_dump(),
           "played_at": body.played_at or now_iso(), "created_at": now_iso(), "source": "manual"}
    await db.matches.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/matches/{match_id}")
async def delete_match(match_id: str, member: dict = Depends(current_member)):
    r = await db.matches.delete_one({"id": match_id, "user_id": member["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partida não encontrada")
    return {"ok": True}


async def _stats_summary(uid: str) -> dict:
    matches = await db.matches.find({"user_id": uid}, {"_id": 0}).sort("played_at", -1).to_list(500)
    if not matches:
        return {"total": 0, "wins": 0, "losses": 0, "win_rate": 0, "kd": 0, "acs": 0,
                "adr": 0, "kast": 0, "by_agent": [], "by_map": [], "timeline": [],
                "last_updated": None}
    wins = sum(1 for m in matches if m["result"] == "win")
    losses = sum(1 for m in matches if m["result"] == "loss")
    total = len(matches)
    k = sum(m["kills"] for m in matches)
    d = sum(m["deaths"] for m in matches) or 1

    def avg(key): return round(sum(m[key] for m in matches) / total, 2)

    def group(key):
        out = {}
        for m in matches:
            g = out.setdefault(m[key], {"name": m[key], "games": 0, "wins": 0,
                                         "kills": 0, "deaths": 0, "acs": 0})
            g["games"] += 1
            g["wins"] += 1 if m["result"] == "win" else 0
            g["kills"] += m["kills"]; g["deaths"] += m["deaths"]; g["acs"] += m["acs"]
        return [{**v, "win_rate": round(v["wins"] / v["games"] * 100),
                 "kd": round(v["kills"] / max(v["deaths"], 1), 2),
                 "acs": round(v["acs"] / v["games"])} for v in out.values()]

    timeline = [{"date": m["played_at"][:10], "acs": m["acs"],
                 "kd": round(m["kills"]/max(m["deaths"], 1), 2), "kast": m["kast"]}
                for m in reversed(matches[:20])]
    return {"total": total, "wins": wins, "losses": losses,
            "win_rate": round(wins / total * 100),
            "kd": round(k / d, 2), "acs": avg("acs"), "adr": avg("adr"), "kast": avg("kast"),
            "by_agent": sorted(group("agent"), key=lambda x: -x["games"])[:10],
            "by_map": sorted(group("map"), key=lambda x: -x["games"])[:10],
            "timeline": timeline, "last_updated": now_iso()}


@api_router.get("/stats/summary")
async def stats_summary(member: dict = Depends(current_member)):
    return await _stats_summary(member["user_id"])


@api_router.get("/challenges")
async def list_challenges(member: dict = Depends(current_member)):
    return await db.challenges.find({"user_id": member["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api_router.post("/challenges")
async def add_challenge(body: ChallengeIn, member: dict = Depends(current_member)):
    if member.get("plan_slug", "free") == "free":
        active = await db.challenges.count_documents({"user_id": member["user_id"], "completed": False})
        if active >= FREE_MANUAL_CHALLENGES:
            raise HTTPException(status_code=402, detail="Plano Free permite 3 desafios ativos. Conclua um ou faça upgrade.")
    doc = {"id": str(uuid.uuid4()), "user_id": member["user_id"], **body.model_dump(),
           "completed": False, "created_at": now_iso()}
    await db.challenges.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.patch("/challenges/{cid}")
async def toggle_challenge(cid: str, body: CompleteChallengeIn, member: dict = Depends(current_member)):
    r = await db.challenges.update_one({"id": cid, "user_id": member["user_id"]},
        {"$set": {"completed": body.completed,
                  "completed_at": now_iso() if body.completed else None}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    return {"ok": True}


@api_router.get("/riot")
async def get_riot(member: dict = Depends(current_member)):
    doc = await db.riot_accounts.find_one({"user_id": member["user_id"]}, {"_id": 0})
    return doc or {"connected": False, "integration_status": "pending_riot_approval"}


@api_router.post("/riot/link")
async def link_riot(body: RiotLinkIn, member: dict = Depends(current_member)):
    riot_id = body.riot_id.strip()
    if not RIOT_ID_RE.match(riot_id):
        raise HTTPException(status_code=400, detail="Riot ID deve estar no formato Nome#TAG (nome 3-16, tag 2-5 letras/números)")
    name, tag = riot_id.split("#", 1)
    doc = {"user_id": member["user_id"], "riot_id": riot_id,
           "riot_name": name, "riot_tag": tag, "region": body.region, "manual": True,
           "integration_status": "manual_linked_pending_riot_approval",
           "linked_at": now_iso(), "last_sync": now_iso(), "connected": True}
    await db.riot_accounts.update_one({"user_id": member["user_id"]}, {"$set": doc}, upsert=True)
    return doc


@api_router.delete("/riot")
async def unlink_riot(member: dict = Depends(current_member)):
    await db.riot_accounts.delete_one({"user_id": member["user_id"]})
    return {"ok": True}


@api_router.get("/ai/history")
async def ai_history(member: dict = Depends(current_member)):
    return await db.ai_chat.find({"user_id": member["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api_router.delete("/ai/history")
async def ai_clear(member: dict = Depends(current_member)):
    await db.ai_chat.delete_many({"user_id": member["user_id"]})
    return {"ok": True}


SYSTEM_PROMPT = """Você é o GAMEIQ AI Coach, treinador virtual especialista em Valorant.
Analise o desempenho do jogador, identifique pontos fortes e fracos, e dê orientações práticas
e acionáveis em português do Brasil. Fale como coach profissional de esports: direto, motivador
e técnico. Foque em: mira, movimentação, posicionamento, utility, comunicação, economia,
escolha de agente e mapa. Nunca prometa evolução garantida. Nunca invente estatísticas; só use
o que o jogador te passou. Respostas concisas (3-6 parágrafos curtos ou lista objetiva)."""


@api_router.post("/ai/chat")
async def ai_chat(body: AICoachIn, member: dict = Depends(current_member)):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    if member.get("plan_slug", "free") == "free":
        usage = await db.ai_usage.find_one({"user_id": member["user_id"], "month": month}, {"_id": 0})
        if usage and usage.get("count", 0) >= FREE_AI_MONTHLY:
            raise HTTPException(status_code=402, detail="Limite mensal do plano Free atingido (10 mensagens). Faça upgrade para Pro.")
    await db.ai_usage.update_one({"user_id": member["user_id"], "month": month},
                                 {"$inc": {"count": 1}}, upsert=True)

    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    session_id = body.session_id or str(uuid.uuid4())
    recent = await db.ai_chat.find({"user_id": member["user_id"]}, {"_id": 0, "role": 1, "content": 1}) \
        .sort("created_at", -1).limit(10).to_list(10)
    history = "\n".join(f"{'Jogador' if m['role'] == 'user' else 'Coach'}: {m['content'][:800]}"
                        for m in reversed(recent))
    stats = await _stats_summary(member["user_id"])
    riot = await db.riot_accounts.find_one({"user_id": member["user_id"]}, {"_id": 0})
    context = (f"Dados do jogador — Riot ID: {riot['riot_id'] if riot else 'não conectado'}. "
               f"Stats: {stats['total']} partidas, {stats['win_rate']}% WR, K/D {stats['kd']}, "
               f"ACS {stats['acs']}, ADR {stats['adr']}, KAST {stats['kast']}%.")

    await db.ai_chat.insert_one({"id": str(uuid.uuid4()), "user_id": member["user_id"],
        "role": "user", "content": body.message, "session_id": session_id, "created_at": now_iso()})

    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"gameiq-{member['user_id']}-{session_id}",
        system_message=SYSTEM_PROMPT + "\n\n" + context +
            (f"\n\nConversa recente (para contexto):\n{history}" if history else ""),
    ).with_model("anthropic", "claude-sonnet-5-5")

    async def event_generator() -> AsyncGenerator[str, None]:
        buffer = []
        try:
            async for event in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(event, TextDelta):
                    buffer.append(event.content)
                    # SSE-safe: encode newlines so multi-line chunks don't break the event
                    safe = event.content.replace("\n", "\\n")
                    yield f"data: {safe}\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception as exc:
            yield f"data: [Erro: {str(exc)[:200]}]\n\n"
        full = "".join(buffer)
        if full:
            await db.ai_chat.insert_one({"id": str(uuid.uuid4()), "user_id": member["user_id"],
                "role": "assistant", "content": full, "session_id": session_id, "created_at": now_iso()})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_router.post("/ai/weakness")
async def weakness_analyze(body: WeaknessAnswersIn, member: dict = Depends(current_member)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (f"Analise estas respostas do questionário Weakness Finder e devolva 3 pontos fracos "
              f"prioritários com 1 exercício concreto cada. Respostas: {body.answers}")
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"weakness-{member['user_id']}-{uuid.uuid4()}",
        system_message=SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-5-5")
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        return {"analysis": resp}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI indisponível: {exc}")


@api_router.post("/ai/generate-challenge")
async def generate_challenge(member: dict = Depends(current_member)):
    if member.get("plan_slug", "free") == "free":
        raise HTTPException(status_code=402, detail="Desafios gerados por IA são exclusivos dos planos Pro e Elite.")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    stats = await _stats_summary(member["user_id"])
    prompt = (f"Com base nestas stats ({stats['total']} jogos, WR {stats['win_rate']}%, "
              f"K/D {stats['kd']}, ACS {stats['acs']}), crie 1 desafio diário acionável. "
              f"Responda em JSON: {{\"title\": \"...\", \"description\": \"...\", "
              f"\"difficulty\": \"easy|medium|hard\"}}. Apenas o JSON.")
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"chal-{member['user_id']}-{uuid.uuid4()}",
        system_message=SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-5-5")
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        m = re.search(r"\{.*\}", resp, re.DOTALL)
        data = json.loads(m.group(0)) if m else {"title": "Desafio diário",
            "description": resp[:200], "difficulty": "medium"}
        doc = {"id": str(uuid.uuid4()), "user_id": member["user_id"],
               "title": data.get("title", "Desafio"),
               "description": data.get("description", ""),
               "difficulty": data.get("difficulty", "medium"),
               "ai_generated": True, "completed": False, "created_at": now_iso()}
        await db.challenges.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI indisponível: {exc}")


@api_router.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_role("admin"))):
    people = await db.users.find(IN_ENV, {"_id": 0}).to_list(1000)
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role"))} for p in people]}


@api_router.patch("/admin/users/{user_id}/role")
async def admin_set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_role("admin"))):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Precisa manter ao menos um admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    return {"user_id": user_id, "role": body.role}


@api_router.patch("/admin/plans/{slug}")
async def admin_update_plan(slug: str, body: PlanUpdate, admin: dict = Depends(require_role("admin"))):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    r = await db.plans.update_one({"slug": slug}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    plan = await db.plans.find_one({"slug": slug}, {"_id": 0})
    if slug in ("pro", "elite") and plan["price_cents"] > 0:
        try:
            await run_in_threadpool(stripe_sync_plan, slug, plan["name"], plan["price_cents"])
        except stripe.error.StripeError as exc:
            raise HTTPException(status_code=502, detail=f"Plano salvo, mas falhou ao atualizar no Stripe: {exc}")
    return {"ok": True}


@api_router.get("/admin/payments")
async def admin_payments(admin: dict = Depends(require_role("admin"))):
    pays = await db.payments.find(IN_ENV, {"_id": 0}).sort("created_at", -1).to_list(500)
    missing = {p["user_id"] for p in pays if not p.get("email")}
    if missing:
        users = await db.users.find({"user_id": {"$in": list(missing)}}, {"_id": 0, "user_id": 1, "email": 1}).to_list(1000)
        emails = {u["user_id"]: u.get("email", "") for u in users}
        for p in pays:
            p.setdefault("email", emails.get(p["user_id"], ""))
            if not p["email"]:
                p["email"] = emails.get(p["user_id"], "")
    return pays


@api_router.get("/admin/subscriptions")
async def admin_subs(admin: dict = Depends(require_role("admin"))):
    return await db.subscriptions.find(IN_ENV, {"_id": 0}).sort("created_at", -1).to_list(500)


app.include_router(clerk_router)
app.include_router(api_router)

app.add_middleware(CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def start_tasks():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await seed_plans()


@app.on_event("shutdown")
async def shutdown():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    mongo_client.close()
