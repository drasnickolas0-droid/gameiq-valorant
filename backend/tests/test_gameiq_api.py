# GAMEIQ backend regression: auth guard, profile, matches/stats, subscription(demo), riot, challenges, AI, admin
import requests
import pytest
from conftest import API, mdb

PROTECTED = [("get", "/me"), ("patch", "/me"), ("get", "/subscription"), ("post", "/subscription/change"),
             ("post", "/subscription/cancel"), ("get", "/payments"), ("get", "/matches"), ("post", "/matches"),
             ("get", "/stats/summary"), ("get", "/challenges"), ("post", "/challenges"), ("get", "/riot"),
             ("post", "/riot/link"), ("delete", "/riot"), ("get", "/ai/history"), ("post", "/ai/chat"),
             ("post", "/ai/weakness"), ("post", "/ai/generate-challenge"), ("get", "/admin/users"),
             ("get", "/admin/payments"), ("patch", "/admin/plans/pro")]

MATCH = {"agent": "Jett", "map": "Ascent", "result": "win", "kills": 20, "deaths": 10, "assists": 5,
         "acs": 250, "adr": 160, "kast": 75}


# --- public endpoints
def test_public_endpoints():
    assert requests.get(f"{API}/").status_code == 200
    r = requests.get(f"{API}/plans"); assert r.status_code == 200
    assert [p["slug"] for p in r.json()] == ["free", "pro", "elite"]
    c = requests.get(f"{API}/clerk/config").json(); assert c["enabled"] is True


# --- auth guard
@pytest.mark.parametrize("method,path", PROTECTED)
def test_protected_401(method, path):
    r = getattr(requests, method)(f"{API}{path}", json={})
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


def test_invalid_token_401():
    r = requests.get(f"{API}/me", headers={"Authorization": "Bearer abc.def.ghi"})
    assert r.status_code == 401


# --- profile
def test_me_autocreate_and_patch(user_a):
    r = user_a.get("/me"); assert r.status_code == 200
    d = r.json()
    assert d["role"] == "member" and d["plan_slug"] == "free" and d["email"] == user_a.email
    assert d["riot_connected"] is False
    p = user_a.patch("/me", json={"display_name": "TEST_Display", "goal": "Imortal", "rank": "Ouro 2"})
    assert p.status_code == 200
    d = user_a.get("/me").json()
    assert d["display_name"] == "TEST_Display" and d["goal"] == "Imortal" and d["rank"] == "Ouro 2"


# --- matches + stats
def test_matches_crud_and_stats(user_a, user_b):
    m1 = user_a.post("/matches", json=MATCH); assert m1.status_code == 200
    m2 = user_a.post("/matches", json={**MATCH, "agent": "Sova", "map": "Bind", "result": "loss",
                                        "kills": 10, "deaths": 20, "acs": 150}); assert m2.status_code == 200
    ids = [m1.json()["id"], m2.json()["id"]]
    assert "_id" not in m1.json()
    lst = user_a.get("/matches").json(); assert {m["id"] for m in lst} >= set(ids)
    s = user_a.get("/stats/summary").json()
    assert s["total"] == 2 and s["wins"] == 1 and s["losses"] == 1 and s["win_rate"] == 50
    assert s["kd"] == 1.0 and s["acs"] == 200
    assert {a["name"] for a in s["by_agent"]} == {"Jett", "Sova"}
    assert {a["name"] for a in s["by_map"]} == {"Ascent", "Bind"}
    assert len(s["timeline"]) == 2
    # user B cannot delete A's match
    assert user_b.delete(f"/matches/{ids[0]}").status_code == 404
    assert user_b.get("/matches").json() == []
    assert user_a.delete(f"/matches/{ids[0]}").status_code == 200
    assert ids[0] not in [m["id"] for m in user_a.get("/matches").json()]
    assert user_a.delete(f"/matches/{ids[0]}").status_code == 404


def test_match_validation(user_a):
    assert user_a.post("/matches", json={"agent": "Jett"}).status_code == 422


# --- subscription demo
def test_subscription_flow(user_a):
    bad = user_a.post("/subscription/change", json={"plan_slug": "pro", "confirm_email": "wrong@x.com"})
    assert bad.status_code == 400
    nf = user_a.post("/subscription/change", json={"plan_slug": "nope", "confirm_email": user_a.email})
    assert nf.status_code == 404
    ok = user_a.post("/subscription/change", json={"plan_slug": "pro", "confirm_email": user_a.email.upper()})
    assert ok.status_code == 200 and ok.json()["demo"] is True
    sub = user_a.get("/subscription").json()
    assert sub["plan_slug"] == "pro" and sub["status"] == "active_demo" and sub["price_cents"] == 4990
    assert user_a.get("/me").json()["plan_slug"] == "pro"
    pays = user_a.get("/payments").json()
    assert len(pays) == 1 and pays[0]["amount_cents"] == 4990 and pays[0]["status"] == "demo"
    assert user_a.post("/subscription/cancel").status_code == 200
    assert user_a.get("/me").json()["plan_slug"] == "free"
    sub = user_a.get("/subscription").json()
    assert sub["status"] == "cancelled"


# --- riot
def test_riot_link(user_a):
    assert user_a.get("/riot").json()["connected"] is False
    assert user_a.post("/riot/link", json={"riot_id": "NoTag", "region": "br"}).status_code == 400
    r = user_a.post("/riot/link", json={"riot_id": "TEST_Player#BR1", "region": "br"})
    assert r.status_code == 200 and r.json()["riot_tag"] == "BR1"
    g = user_a.get("/riot").json(); assert g["connected"] is True and g["riot_id"] == "TEST_Player#BR1"
    assert user_a.get("/me").json()["riot_connected"] is True
    assert user_a.delete("/riot").status_code == 200
    assert user_a.get("/riot").json()["connected"] is False


def test_riot_link_empty_parts(user_a):
    # 'Name#' or '#TAG' should be rejected
    r1 = user_a.post("/riot/link", json={"riot_id": "Name#", "region": "br"})
    r2 = user_a.post("/riot/link", json={"riot_id": "#TAG", "region": "br"})
    user_a.delete("/riot")
    assert r1.status_code == 400 and r2.status_code == 400, f"{r1.status_code},{r2.status_code}"


# --- challenges
def test_challenges_crud(user_a, user_b):
    c = user_a.post("/challenges", json={"title": "TEST_ch", "description": "d"}); assert c.status_code == 200
    cid = c.json()["id"]
    assert user_a.patch(f"/challenges/{cid}", json={"completed": True}).status_code == 200
    got = [x for x in user_a.get("/challenges").json() if x["id"] == cid][0]
    assert got["completed"] is True
    assert user_b.patch(f"/challenges/{cid}", json={"completed": False}).status_code == 404


# --- AI (real Claude)
def test_ai_generate_challenge(user_a):
    r = user_a.post("/ai/generate-challenge"); assert r.status_code == 200, r.text
    d = r.json(); assert d["ai_generated"] is True and d["title"]
    assert d["id"] in [x["id"] for x in user_a.get("/challenges").json()]


def test_ai_weakness(user_a):
    r = user_a.post("/ai/weakness", json={"answers": {"aim": "Fraca", "utility": "Básico"}})
    assert r.status_code == 200, r.text
    assert len(r.json()["analysis"]) > 50


def test_ai_chat_stream_and_history(user_a):
    r = requests.post(f"{API}/ai/chat", headers=user_a.h(), json={"message": "Dê 1 dica curta de mira."},
                      stream=True, timeout=120)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    lines = [l for l in r.iter_lines(decode_unicode=True) if l]
    assert all(l.startswith("data: ") for l in lines)
    assert lines[-1] == "data: [DONE]"
    text = "".join(l[6:] for l in lines[:-1])
    assert "[Erro" not in text, text
    assert " " in text and len(text) > 20
    h = user_a.get("/ai/history").json()
    assert [m["role"] for m in h][-2:] == ["user", "assistant"]


def test_ai_chat_free_limit(user_a):
    # seed 10 user messages directly (avoid 10 LLM calls), expect 402
    mdb.ai_chat.insert_many([{"id": f"TEST_{i}", "user_id": user_a.id, "role": "user", "content": "x",
                              "created_at": "2026-01-01"} for i in range(10)])
    r = user_a.post("/ai/chat", json={"message": "oi"})
    assert r.status_code == 402
    assert user_a.delete("/ai/history").status_code == 200
    assert user_a.get("/ai/history").json() == []


# --- admin
def test_admin_forbidden_for_member(user_a):
    assert user_a.get("/admin/users").status_code == 403
    assert user_a.get("/admin/payments").status_code == 403
    assert user_a.patch("/admin/plans/pro", json={"price_cents": 1}).status_code == 403


def test_admin_flows(admin_user, user_b):
    user_b.get("/me")
    r = admin_user.get("/admin/users"); assert r.status_code == 200
    d = r.json(); assert set(d["roles"]) == {"admin", "member"}
    assert any(u["user_id"] == user_b.id for u in d["users"])
    assert all("_id" not in u for u in d["users"])
    assert admin_user.get("/admin/payments").status_code == 200
    # promote B, then demote B
    assert admin_user.patch(f"/admin/users/{user_b.id}/role", json={"role": "admin"}).status_code == 200
    assert user_b.get("/me").json()["role"] == "admin"
    assert admin_user.patch(f"/admin/users/{user_b.id}/role", json={"role": "member"}).status_code == 200
    assert admin_user.patch(f"/admin/users/{user_b.id}/role", json={"role": "god"}).status_code == 403
    assert admin_user.patch("/admin/users/nonexistent/role", json={"role": "member"}).status_code == 404
    # only admin demote -> 409
    admins = mdb.users.count_documents({"role": "admin", "env": {"$in": ["preview", None]}})
    if admins == 1:
        assert admin_user.patch(f"/admin/users/{admin_user.id}/role", json={"role": "member"}).status_code == 409
    # plan price edit, then restore
    orig = [p for p in requests.get(f"{API}/plans").json() if p["slug"] == "pro"][0]["price_cents"]
    assert admin_user.patch("/admin/plans/pro", json={"price_cents": 5990}).status_code == 200
    assert [p for p in requests.get(f"{API}/plans").json() if p["slug"] == "pro"][0]["price_cents"] == 5990
    assert admin_user.patch("/admin/plans/pro", json={"price_cents": orig}).status_code == 200
    assert admin_user.patch("/admin/plans/pro", json={}).status_code == 400
    assert admin_user.patch("/admin/plans/nope", json={"name": "x"}).status_code == 404
