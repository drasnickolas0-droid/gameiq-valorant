# Shared fixtures: Clerk test users (created via Clerk Backend API), fresh session tokens, cleanup
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
CLERK = "https://api.clerk.com/v1"
CH = {"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "gameiq-tests",
      "Content-Type": "application/json"}

_mongo = MongoClient(os.environ['MONGO_URL'])
mdb = _mongo[os.environ['DB_NAME']]


class ClerkUser:
    def __init__(self, label):
        self.email = f"test_{label}_{uuid.uuid4().hex[:6]}+clerk_test@gameiq.com"
        r = requests.post(f"{CLERK}/users", headers=CH, json={
            "email_address": [self.email], "password": f"Tp-{uuid.uuid4().hex}!",
            "first_name": f"TEST_{label}", "skip_password_checks": True})
        assert r.status_code == 200, r.text
        self.id = r.json()["id"]
        s = requests.post(f"{CLERK}/sessions", headers=CH, json={"user_id": self.id})
        assert s.status_code == 200, s.text
        self.sid = s.json()["id"]
        self._tok, self._ts = None, 0

    def token(self):
        if not self._tok or time.time() - self._ts > 40:
            r = requests.post(f"{CLERK}/sessions/{self.sid}/tokens", headers=CH)
            assert r.status_code == 200, r.text
            self._tok, self._ts = r.json()["jwt"], time.time()
        return self._tok

    def h(self):
        return {"Authorization": f"Bearer {self.token()}"}

    def get(self, p, **kw): return requests.get(f"{API}{p}", headers=self.h(), timeout=90, **kw)
    def post(self, p, **kw): return requests.post(f"{API}{p}", headers=self.h(), timeout=120, **kw)
    def patch(self, p, **kw): return requests.patch(f"{API}{p}", headers=self.h(), timeout=60, **kw)
    def delete(self, p, **kw): return requests.delete(f"{API}{p}", headers=self.h(), timeout=60, **kw)

    def destroy(self):
        for c in ("users", "subscriptions", "payments", "challenges", "matches", "riot_accounts", "ai_chat"):
            mdb[c].delete_many({"user_id": self.id})
        requests.delete(f"{CLERK}/users/{self.id}", headers=CH)


@pytest.fixture(scope="session")
def user_a():
    u = ClerkUser("a"); yield u; u.destroy()


@pytest.fixture(scope="session")
def user_b():
    u = ClerkUser("b"); yield u; u.destroy()


@pytest.fixture(scope="session")
def admin_user():
    u = ClerkUser("admin")
    r = u.get("/me"); assert r.status_code == 200
    mdb.users.update_one({"user_id": u.id}, {"$set": {"role": "admin", "env": "preview"}})
    yield u
    u.destroy()
