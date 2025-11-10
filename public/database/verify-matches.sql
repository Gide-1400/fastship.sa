SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches');

SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches';

SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'matches';

SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches';

SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('update_match_priority', 'expire_old_matches', 'get_match_statistics');