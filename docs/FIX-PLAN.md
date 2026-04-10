# Fix Plan — Issues từ 3-agent review

## P0 — CRITICAL (fix ngay)

- [x] P0-1: Rotate credentials → USER phải tự rotate (Google Cloud, Neon, Gemini)
- [ ] P0-2: Rate limiting `/api/chat` + `/api/upload/csv`
- [ ] P0-3: Error response generic (không leak internal message)
- [ ] P0-4: Dùng `daily_aggregates` cho stat cards thay scan `leads`

## P1 — HIGH (fix trước release)

- [ ] P1-5: Batch Bitrix ingest (per-row → bulk)
- [ ] P1-6: JWT re-check `active` mỗi request
- [ ] P1-7: File upload → Vercel Blob → truyền URL (skip session này)
- [ ] P1-8: Try-catch trong AiChatPanel async calls
- [ ] P1-9: Snapshot bỏ `raw` JSONB, chỉ lưu delta columns

## P2 — MEDIUM (cải thiện)

- [ ] P2-10: Integration test upload + auth guard
- [ ] P2-11: Cache `getAccessibleProjectIds` per-request
- [ ] P2-12: Index chatMessages(conversation_id, created_at)
- [ ] P2-13: Chat messages limit size validation
