SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches');

SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM shipments;
SELECT COUNT(*) FROM trips;

SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';