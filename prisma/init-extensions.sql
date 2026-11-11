-- prisma/migrations/00_init_extensions/migration.sql
-- Bật extension cần thiết cho PostgreSQL
-- Chạy thủ công hoặc tạo migration riêng

-- Tìm kiếm tiếng Việt không dấu
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Tìm kiếm mờ (fuzzy search) + trigram index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- UUID generation (Prisma dùng cuid nhưng backup)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
