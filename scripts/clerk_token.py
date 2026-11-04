"""Dev helper: prints a short-lived Clerk session JWT for the smoke-test user (smoke+clerk_test@example.com)."""
import os, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
H = {"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}"}
uid = requests.get("https://api.clerk.com/v1/users", params={"email_address": "smoke+clerk_test@example.com"}, headers=H).json()[0]["id"]
s = requests.post("https://api.clerk.com/v1/sessions", headers=H, json={"user_id": uid}).json()
print(requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", headers=H, json={}).json()["jwt"])
