# Stripe payments: checkout, status, webhook (signature/idempotency/Pix async), activation, stacking, expiry, cancel, admin price sync
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests
import stripe
from dotenv import dotenv_values

from conftest import API, BASE_URL, mdb

ENVV = dotenv_values('/app/backend/.env')
WHSEC = ENVV["STRIPE_WEBHOOK_SECRET"]
stripe.api_key = ENVV["STRIPE_SECRET_KEY"]
WEBHOOK = f"{BASE_URL}/api/stripe/webhook"


def send_event(etype, session_id, payment_status, secret=WHSEC):
    payload = json.dumps({"id": f"evt_test_{int(time.time()*1000)}", "object": "event", "type": etype,
                          "data": {"object": {"id": session_id, "object": "checkout.session",
                                              "payment_status": payment_status, "payment_intent": None}}})
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    return requests.post(WEBHOOK, data=payload, timeout=30,
                         headers={"Stripe-Signature": f"t={ts},v1={sig}", "Content-Type": "application/json"})


def checkout(u, slug="pro", email=None):
    return u.post("/payments/checkout", json={"plan_slug": slug, "confirm_email": email or u.email,
                                              "origin_url": BASE_URL})


@pytest.fixture(scope="module", autouse=True)
def cleanup_tx(user_a, user_b):
    yield
    mdb.payment_transactions.delete_many({"user_id": {"$in": [user_a.id, user_b.id]}})


class TestCheckout:
    def test_requires_auth(self):
        r = requests.post(f"{API}/payments/checkout", json={"plan_slug": "pro", "confirm_email": "x@y.com",
                                                            "origin_url": BASE_URL})
        assert r.status_code in (401, 403)

    def test_wrong_email(self, user_a):
        assert user_a.get("/me").status_code == 200
        r = checkout(user_a, email="wrong@example.com")
        assert r.status_code == 400

    @pytest.mark.parametrize("slug", ["free", "platinum"])
    def test_invalid_plan(self, user_a, slug):
        assert checkout(user_a, slug=slug).status_code == 422

    @pytest.mark.parametrize("slug,amount", [("pro", 4990), ("elite", 9990)])
    def test_checkout_creates_session(self, user_a, slug, amount):
        r = checkout(user_a, slug=slug)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com")
        tx = mdb.payment_transactions.find_one({"session_id": d["session_id"]})
        assert tx["status"] == "initiated" and tx["payment_status"] == "pending"
        assert tx["amount_cents"] == amount and tx["user_id"] == user_a.id
        s = stripe.checkout.Session.retrieve(d["session_id"])
        assert s.amount_total == amount and s.currency == "brl"
        assert set(s.payment_method_types) == {"card", "pix"}


class TestStatus:
    def test_status_pending_and_scoping(self, user_a, user_b):
        sid = checkout(user_a).json()["session_id"]
        assert requests.get(f"{API}/payments/status/{sid}").status_code in (401, 403)
        r = user_a.get(f"/payments/status/{sid}")
        assert r.status_code == 200 and r.json()["payment_status"] == "pending"
        assert user_b.get(f"/payments/status/{sid}").status_code == 404


class TestWebhook:
    def test_bad_signature(self):
        assert send_event("checkout.session.completed", "cs_x", "paid", secret="whsec_wrong").status_code == 400
        r = requests.post(WEBHOOK, data="{}", headers={"Stripe-Signature": "t=1,v1=abc"})
        assert r.status_code == 400

    def test_paid_idempotent_and_activation(self, user_a):
        user_a.post("/subscription/cancel")
        sid = checkout(user_a).json()["session_id"]
        for _ in range(2):
            assert send_event("checkout.session.completed", sid, "paid").status_code == 200
        assert mdb.payments.count_documents({"session_id": sid}) == 1
        assert mdb.subscriptions.count_documents({"user_id": user_a.id, "status": "active"}) == 1
        sub = user_a.get("/subscription").json()
        assert sub["plan_slug"] == "pro" and sub["status"] == "active" and sub["price_cents"] == 4990
        exp = datetime.fromisoformat(sub["expires_at"])
        assert abs((exp - datetime.now(timezone.utc)) - timedelta(days=30)) < timedelta(minutes=5)
        assert user_a.get("/me").json()["plan_slug"] == "pro"
        pays = user_a.get("/payments").json()
        assert any(p["status"] == "paid" and p["session_id"] == sid for p in pays)
        st = user_a.get(f"/payments/status/{sid}").json()
        assert st["payment_status"] == "paid"

    def test_stack_same_plan(self, user_a):
        prev = datetime.fromisoformat(user_a.get("/subscription").json()["expires_at"])
        sid = checkout(user_a).json()["session_id"]
        assert send_event("checkout.session.completed", sid, "paid").status_code == 200
        new = datetime.fromisoformat(user_a.get("/subscription").json()["expires_at"])
        assert abs((new - prev) - timedelta(days=30)) < timedelta(minutes=1)
        assert mdb.subscriptions.count_documents({"user_id": user_a.id, "status": "active"}) == 1

    def test_pix_async(self, user_b):
        assert user_b.get("/me").status_code == 200
        sid = checkout(user_b, slug="elite").json()["session_id"]
        assert send_event("checkout.session.completed", sid, "unpaid").status_code == 200
        tx = mdb.payment_transactions.find_one({"session_id": sid})
        assert tx["status"] == "awaiting_payment" and tx["fulfilled"] is False
        assert user_b.get("/me").json()["plan_slug"] == "free"
        assert send_event("checkout.session.async_payment_succeeded", sid, "paid").status_code == 200
        assert user_b.get("/me").json()["plan_slug"] == "elite"
        assert user_b.get("/subscription").json()["price_cents"] == 9990


class TestExpiryCancel:
    def test_expiry_downgrade(self, user_b):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        mdb.users.update_one({"user_id": user_b.id}, {"$set": {"plan_expires_at": past}})
        assert user_b.get("/me").json()["plan_slug"] == "free"
        assert user_b.get("/subscription").json()["plan_slug"] == "free"
        assert mdb.subscriptions.count_documents({"user_id": user_b.id, "status": "active"}) == 0

    def test_cancel(self, user_a):
        assert user_a.post("/subscription/cancel").status_code == 200
        assert user_a.get("/me").json()["plan_slug"] == "free"
        assert user_a.get("/subscription").json()["plan_slug"] == "free"


class TestAdminPriceSync:
    def test_price_change_syncs(self, admin_user, user_a):
        try:
            r = admin_user.patch("/admin/plans/pro", json={"price_cents": 5490})
            assert r.status_code == 200, r.text
            sid = checkout(user_a).json()["session_id"]
            assert stripe.checkout.Session.retrieve(sid).amount_total == 5490
            assert mdb.payment_transactions.find_one({"session_id": sid})["amount_cents"] == 5490
        finally:
            r = admin_user.patch("/admin/plans/pro", json={"price_cents": 4990})
            assert r.status_code == 200
        sid = checkout(user_a).json()["session_id"]
        assert stripe.checkout.Session.retrieve(sid).amount_total == 4990

    def test_member_cannot_patch_plan(self, user_a):
        assert user_a.patch("/admin/plans/pro", json={"price_cents": 1}).status_code == 403
