# Codex instructions — «На одной волне»

This is an educational MVP for the course «Стартап-экосистемы», **not the full VKR project**.

## Stack
- `frontend/`: React + Vite, plain JavaScript, CSS. No UI framework unless explicitly requested.
- `backend/`: Node.js + Express, PostgreSQL, Socket.IO.
- `docker-compose.yml`: frontend (5173), API (3001), PostgreSQL (5432 loopback only).
- The frontend sends HTTP requests to `/api` and Socket.IO connects to the same origin via `/socket.io`. Vite proxies both to the backend.

## Product rules
- For MVP, guest nicknames + temporary (24h) two-person rooms. Room code is six readable characters.
- No in-app playback, payments, account registration, or AI recommendations.
- Target journey: guest -> room -> second guest -> choose filters -> swipe movies -> match if both like -> matches list.
- Never label planned functionality as implemented.
- Keep room and session data in PostgreSQL, not in server process memory. The browser may store its current guest session token locally.
- Do not copy third-party poster images into the repo unless license permits. For the first demo use self-made gradients or seeded illustrative placeholders.

## Development discipline
1. Read `README.md`, `docs/MVP.md`, and the code before making changes.
2. Implement only the requested task; keep PRs small; separate frontend/backend tasks when possible.
3. Use parameterized SQL, validate requests, prevent exceeding two participants, and handle expired rooms.
4. Every feature requires one reproducible manual check in README and automated tests where feasible.
5. Do not claim Docker/build/test success without running them.
6. New migrations go in `backend/sql/` but note: Docker PostgreSQL init scripts run only on a fresh database volume. For existing volumes use a proper migration process or manual SQL application.
7. Keep design: purple/pink/cyan, modern youthful (not childish), both dark/light, adaptive, reduced-motion support.
8. Write explanations and docs in Russian, concise and beginner-friendly.

## Team
- Лера: frontend screens room/home and design system.
- Антон: frontend filters/swipes/match.
- Влад: backend routes/db/rooms.
- Николай: backend swipes/match/socket/docker/tests.
