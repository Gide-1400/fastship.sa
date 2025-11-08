-- ============================================
-- FastShip - إعدادات الصلاحيات المبسطة
-- Simple RLS Policies for Testing
-- ============================================

-- تعطيل RLS مؤقتاً للاختبار (في بيئة التطوير فقط)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE shippers DISABLE ROW LEVEL SECURITY;
ALTER TABLE carriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE matching_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- أو يمكنك استخدام RLS مبسط
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Enable all operations for authenticated users" ON users
-- FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- CREATE POLICY "Enable all operations for carriers" ON carriers
-- FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- CREATE POLICY "Enable all operations for shippers" ON shippers
-- FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- CREATE POLICY "Enable all operations for shipments" ON shipments
-- FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- CREATE POLICY "Enable all operations for messages" ON messages
-- FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- تأكد من أن الجداول يمكن الوصول إليها
GRANT ALL ON users TO anon, authenticated;
GRANT ALL ON shippers TO anon, authenticated;
GRANT ALL ON carriers TO anon, authenticated;
GRANT ALL ON shipments TO anon, authenticated;
GRANT ALL ON trips TO anon, authenticated;
GRANT ALL ON messages TO anon, authenticated;
GRANT ALL ON contact_requests TO anon, authenticated;
GRANT ALL ON reviews TO anon, authenticated;
GRANT ALL ON saved_matches TO anon, authenticated;
GRANT ALL ON matching_stats TO anon, authenticated;
GRANT ALL ON market_prices TO anon, authenticated;
GRANT ALL ON notifications TO anon, authenticated;

-- تأكد من صلاحيات USAGE على التسلسلات
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ملاحظة: هذا للاختبار فقط. في الإنتاج يجب استخدام RLS صحيح