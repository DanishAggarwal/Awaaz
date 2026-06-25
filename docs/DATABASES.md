Firestore is a document database. Collections are equivalent to tables. Each document has an auto-generated ID unless specified. Here are the key fields for each collection.

users
Document ID = Firebase Auth UID

uid	string — same as document ID
displayName	string
email	string
role	"citizen" — global role, not group-specific
platformAdmin	boolean — grants access to all admin views
points	number — gamification score
rank	"Citizen" | "Contributor" | "Jan Sevak" | "Community Hero"
groupIds	string[] — array of group IDs the user has joined
createdAt	timestamp

groups
id	string — auto-generated
name	string — e.g. 'Sector 12 RWA'
type	"public" | "private"
category	"ward" | "society" | "college" | "campus" | "road" | "other"
location	{ lat, lng, address }
createdBy	string — user UID
memberCount	number
createdAt	timestamp

issues
The central collection. Most features read and write here.

id	string — auto-generated
groupId	string
reportedBy	string — user UID
description	string
imageUrls	string[] — Firebase Storage URLs
location	{ lat, lng, address }
aiCategory	"pothole" | "garbage" | "waterlogging" | "streetlight" | "sewage" | "other"
aiSeverity	"low" | "medium" | "high" | "critical"
aiSummary	string — one-line Gemini summary
status	"reported" | "verified" | "assigned" | "in_progress" | "resolved" | "confirmed" | "closed" | "disputed"
endorsementCount	number
priorityScore	number — calculated field
dna	{ firstReportedAt, totalReports, resolvedCount, reopenCount, lastStatusChange }
communityBrief	string — Agent 1 output, shown to admin
resolutionProof	{ resolvedAt, resolvedBy, confirmations[], rejections[], resolutionImageUrl, truthEngineVerdict, truthEngineSummary }
isDuplicate	boolean
duplicateOf	string | null — issue ID if merged
createdAt / updatedAt	timestamp

Other collections
group_members	{ groupId, userId, role: 'member' | 'admin', joinedAt }. Document ID = groupId_userId composite.
endorsements	{ issueId, userId, createdAt }. Document ID = issueId_userId — prevents duplicates naturally.
status_history	Subcollection under issues/{issueId}/status_history. { fromStatus, toStatus, changedBy, note, timestamp }
notifications	{ userId, type, issueId, message, read, createdAt }
