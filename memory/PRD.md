# GAMEIQ — PRD

## Problem statement
GAMEIQ — Your Personal Gaming Coach. A premium coaching SaaS for competitive Valorant players, in Portuguese (pt-BR), built so other games can be added later. It needs sign-up and login, a dashboard, Free/Pro/Elite plans, My Subscription, My Account, an admin area, an AI Coach, a Weakness Finder, a Challenge Generator, a Progress Tracker, a Player Profile, a Riot Account page, a Valorant Performance page and match history. Design: black/graphite with neon purple and blue, a side menu, and layouts for desktop, tablet and phone.

## User choices
- Sign-in: Emergent-managed Clerk (email + password and Google)
- Database: MongoDB
- Payments: DEMO MODE ONLY (no payment provider)
- AI: Claude Sonnet 5.5 through the Emergent Universal Key
- Riot: placeholder only, labelled "integração pendente de aprovação Riot", with stats entered by hand
- First admin: gameiqval@gmail.com (set through ADMIN_EMAIL)

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) and `clerk_auth.py`. Collections: users, plans, subscriptions, payments, matches, challenges, riot_accounts, ai_chat, ai_usage
- Roles: admin and member, stored in db.users and checked on the server
- Frontend: React with Clerk (dark theme), a sidebar `AppShell`, pages in `src/pages/`, and Recharts for the charts

## Built (2026-06)
- Landing page with public plan cards; sign-in, sign-up and welcome pages (Clerk handles email verification and password reset)
- Dashboard, Player Profile, My Account (edit profile, delete account)
- Plans, with a confirmation step where the user retypes their account email; My Subscription with payment history. Both are DEMO MODE
- Valorant Performance: hand-entered matches with input checks, plus K/D, ACS, ADR, KAST and win rate, broken down by agent and by map
- Progress Tracker charts
- AI Coach: streaming chat that keeps history and remembers recent messages. Free plan gets 10 messages a month
- Weakness Finder (questions analysed by the AI), AI challenges for Pro/Elite only, manual challenges (Free plan: 3 active at a time)
- Riot Account: link, replace or unlink a Riot ID by hand (placeholder)
- Admin: users and roles, editing plan prices and text, payment log

## Backlog
- P1: Real payments (Stripe or another provider)
- P1: Riot API integration once Riot approves access
- P2: Clerk login screens in Portuguese (needs an extra package that the auth setup does not allow right now)
- P2: Support for more games (CS2, Fortnite, Apex), exportable reports for Elite
