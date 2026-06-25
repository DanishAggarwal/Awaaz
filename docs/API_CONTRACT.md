All frontend API calls go through one file: src/api.js. Never call fetch directly in a component. If a route changes, fix it in one place.

Base URL: /api. All protected routes require: Authorization: Bearer <firebase_id_token>

All responses follow: { success: boolean, data: any, error?: string }

Auth
POST /api/auth/sync	Protected. Called after Firebase login to create or update user doc. Body: { displayName, email, photoURL }. Returns: { user }

Groups
GET /api/groups	Public. Query: ?search=&type=public. Returns: { groups }
POST /api/groups	Protected. Body: { name, type, category, description, location }. Returns: { group }
GET /api/groups/:id	Public. Returns: { group, memberCount, recentIssues }
POST /api/groups/:id/join	Protected. Adds user as member. Returns: { message }
GET /api/groups/:id/issues	Protected (member only). Query: ?status=&sort=priority. Returns: { issues }

Issues
POST /api/issues	Protected. Body: { groupId, description, location, imageUrls }. Runs duplicate check + Gemini call + creates issue. Returns: { issue, duplicateFound? }
GET /api/issues/:id	Public. Returns: { issue, statusHistory, endorsementCount, userHasEndorsed? }
POST /api/issues/:id/endorse	Protected. Creates endorsement, increments count, recalculates score. Returns: { endorsementCount }
DELETE /api/issues/:id/endorse	Protected. Removes endorsement. Returns: { endorsementCount }
PATCH /api/issues/:id/status	Protected (admin only for most transitions). Body: { status, note?, resolutionImageUrl? }. If status=resolved, triggers Truth Engine async. Returns: { issue }
POST /api/issues/:id/confirm-resolution	Protected. Body: { confirmed: boolean }. Adds to confirmations or rejections. If 3 confirms → closed. If 2 rejects → disputed + reopen. Returns: { issue }

AI
POST /api/ai/complaint-letter	Protected. Body: { issueId }. Fetches issue, calls Gemini, returns formal complaint letter. Returns: { letter }

Feed
GET /api/feed/rising	Public. Query: ?limit=20&cursor=lastDocId. Issues sorted by priorityScore desc, status not closed. Returns: { issues, nextCursor }
GET /api/feed/stats	Public. Returns: { totalIssues, resolvedThisMonth, mostActiveGroup, avgResolutionDays }

Admin
GET /api/admin/queue	Protected (admin). Query: ?groupId=&category=&status=. Issues sorted by priorityScore. Returns: { issues }
GET /api/admin/stats	Protected (admin). Returns: { openIssues, resolvedIssues, disputedIssues, avgResolutionTime, categoryBreakdown }
