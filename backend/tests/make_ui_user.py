# Helper: create a TEST Clerk user + sign-in ticket for UI tests (prints JSON). Usage: python make_ui_user.py [user_id]
import json, os, sys, uuid, requests
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
CH = {"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "gameiq-tests", "Content-Type": "application/json"}
if len(sys.argv) > 1:
    uid = sys.argv[1]; email = None
else:
    email = f"test_ui_{uuid.uuid4().hex[:6]}+clerk_test@gameiq.com"
    r = requests.post("https://api.clerk.com/v1/users", headers=CH, json={"email_address": [email], "password": f"Tp-{uuid.uuid4().hex}!", "first_name": "TEST_ui", "skip_password_checks": True})
    r.raise_for_status(); uid = r.json()["id"]
t = requests.post("https://api.clerk.com/v1/sign_in_tokens", headers=CH, json={"user_id": uid, "expires_in_seconds": 3600})
t.raise_for_status()
print(json.dumps({"id": uid, "email": email, "ticket": t.json()["token"]}))
