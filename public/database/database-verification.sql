-- ==========================================
-- FastShip Database Verification & Setup
-- كود للتحقق من قاعدة البيانات والتأكد من الجاهزية
-- ==========================================

-- 🔍 **خطوة 1: التحقق من الجداول الأساسية الموجودة**
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'users', 'shippers', 'carriers', 'shipments', 'trips', 
        'messages', 'notifications', 'contact_requests', 'reviews'
    )
ORDER BY tablename;

-- النتيجة المتوقعة: يجب أن تظهر 9 جداول
-- إذا كانت أقل، فهناك جداول ناقصة من schema الأساسي


-- 🔍 **خطوة 2: التحقق من وجود جدول matches (المطلوب إنشاؤه)**
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'matches'
) AS matches_table_exists;

-- النتيجة المتوقعة: false (لأنه لم يتم إنشاؤه بعد)
-- بعد تنفيذ matches-table.sql يجب أن تصبح true


-- 🔍 **خطوة 3: التحقق من عدد السجلات في الجداول الأساسية**
SELECT 
    'users' AS table_name, COUNT(*) AS record_count FROM users
UNION ALL
SELECT 'shippers', COUNT(*) FROM shippers
UNION ALL
SELECT 'carriers', COUNT(*) FROM carriers  
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'trips', COUNT(*) FROM trips
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'contact_requests', COUNT(*) FROM contact_requests
ORDER BY table_name;


-- 🔍 **خطوة 4: التحقق من RLS policies الموجودة**
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- 🔍 **خطوة 5: التحقق من الفهارس الموجودة**
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
    AND tablename IN ('users', 'shippers', 'carriers', 'shipments', 'trips', 'messages', 'notifications')
ORDER BY tablename, indexname;


-- 🔍 **خطوة 6: التحقق من العلاقات (Foreign Keys)**
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;


-- 🔍 **خطوة 7: التحقق من الدوال المخصصة (إذا كانت موجودة)**
SELECT 
    routine_name,
    routine_type,
    specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_name IN (
        'calculate_route_distance',
        'update_matching_stats', 
        'expire_old_matches',
        'get_match_statistics'
    );


-- ==========================================
-- 📊 **تقرير حالة قاعدة البيانات**
-- ==========================================

-- نموذج للنتائج المتوقعة قبل تنفيذ matches-table.sql:

/*
خطوة 1 - الجداول الأساسية:
✅ users
✅ shippers  
✅ carriers
✅ shipments
✅ trips
✅ messages
✅ notifications
✅ contact_requests
✅ reviews

خطوة 2 - جدول matches:
❌ false (غير موجود - هذا طبيعي)

خطوة 3 - عدد السجلات:
- users: [عدد المستخدمين]
- shippers: [عدد الشاحنين] 
- carriers: [عدد الناقلين]
- shipments: [عدد الشحنات]
- trips: [عدد الرحلات]
- messages: [عدد الرسائل]
- notifications: [عدد الإشعارات]
- contact_requests: [عدد طلبات التواصل]

خطوة 4 - RLS Policies:
✅ يجب أن تظهر policies لكل جدول

خطوة 5 - الفهارس:
✅ يجب أن تظهر فهارس على المعرفات والحقول المهمة

خطوة 6 - العلاقات:
✅ يجب أن تظهر foreign keys بين الجداول

خطوة 7 - الدوال:
⚠️ قد تكون فارغة (هذا طبيعي)
*/


-- ==========================================
-- ✅ **كود للتحقق بعد تنفيذ matches-table.sql**
-- ==========================================

-- نفّذ هذا الكود بعد تنفيذ ملف matches-table.sql للتأكد من نجاح العملية:

-- 1. التحقق من إنشاء جدول matches
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'matches'
) AS matches_created;
-- يجب أن تكون النتيجة: true

-- 2. التحقق من أعمدة جدول matches
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'matches'
ORDER BY ordinal_position;

-- 3. التحقق من فهارس جدول matches
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
    AND tablename = 'matches'
ORDER BY indexname;

-- 4. التحقق من RLS policies لجدول matches
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename = 'matches'
ORDER BY policyname;

-- 5. التحقق من الدوال الجديدة
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_name IN (
        'update_match_priority',
        'expire_old_matches', 
        'get_match_statistics'
    );

-- 6. اختبار إنشاء مطابقة تجريبية (اختياري)
-- ملاحظة: هذا يتطلب وجود بيانات في جداول shipments و trips
/*
INSERT INTO matches (shipment_id, trip_id, match_score, match_reasons, status)
SELECT 
    s.id,
    t.id,
    75.5,
    ARRAY['موقع متطابق', 'السعة كافية'],
    'new'
FROM shipments s, trips t 
WHERE s.status = 'pending' 
    AND t.status = 'active'
LIMIT 1;

-- ثم حذف المطابقة التجريبية
DELETE FROM matches WHERE match_score = 75.5;
*/


-- ==========================================
-- 🚨 **استكشاف الأخطاء الشائعة**
-- ==========================================

-- إذا فشل إنشاء جدول matches، تحقق من:

-- 1. الصلاحيات
SELECT current_user, session_user;

-- 2. امتداد UUID (مطلوب لـ gen_random_uuid)
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';
-- إذا كانت فارغة، نفّذ: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. وجود الجداول المرجعية
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('shipments', 'trips');

-- 4. التحقق من أخطاء RLS
SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated');


-- ==========================================
-- 📝 **سجل التحقق النهائي**
-- ==========================================

SELECT 
    'Database Check Complete' AS status,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches')
        THEN '✅ matches table created'
        ELSE '❌ matches table missing'
    END AS matches_status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS total_tables,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS total_indexes;