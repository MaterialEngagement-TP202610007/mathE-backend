# Postman Collection — VAK Engagement API

## Files
- `VAK-Engagement-API.postman_collection.json` — all endpoints, grouped by resource.
- `VAK-Engagement-Local.postman_environment.json` — `baseUrl` for local dev.

## Import
1. Postman → **Import** → drop both files.
2. Top-right environment selector → **VAK Engagement — Local**.

## Cookie auth — how it works
The API uses an **HttpOnly cookie** `auth_token` (not a Bearer header). Postman has a built-in cookie jar:
1. Run **Auth → Login** with valid credentials.
2. Postman stores the `auth_token` cookie for `localhost` automatically.
3. Every other request replays the cookie — no manual token copy.
4. **Auth → Me** validates the session (200 = still logged in, 401 = expired/invalid).
5. **Auth → Logout** clears the cookie.

> `Secure` cookie on `http://localhost` works in the Postman desktop app and in Chrome/Firefox (localhost is a secure context). If using a non-localhost host over plain HTTP the cookie won't be stored — use HTTPS.

## Auto-captured variables
Test scripts save ids into collection variables so chained requests just work:

| Variable | Set by |
|----------|--------|
| `userId` | Auth → Login |
| `questionId` | Questions → Generate |
| `questionnaireId` | Questionnaires → Create |
| `answerId` | Questionnaires → Submit answer |
| `resultId` | Questionnaires → Complete |
| `schoolId` | manual (default `1`) |
| `notificationId`, `datasetId` | set manually from a list response |

## Typical flows
**Student:** Login → Create questionnaire → Submit answer (×N) → Complete → Results → List my results.
**Teacher:** Login → Generate question → List my questions → Approve/Reject → Results → Correct label.
**Admin:** Login → List students → Activate user.

See [`../API_REFERENCE.md`](../API_REFERENCE.md) for full request/response contracts.
