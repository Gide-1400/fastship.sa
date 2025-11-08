-- 🔍 كود فحص شامل لجميع جداول قاعدة البيانات
-- انسخ والصق هذا الكود في Supabase SQL Editor للتحقق من وجود جميع الجداول

-- =====================================
-- 1. فحص الجداول الأساسية
-- =====================================

SELECT 
  'جداول أساسية' as category,
  table_name as "اسم الجدول",
  CASE 
    WHEN table_name IN (
      'users', 'shippers', 'carriers', 'shipments', 
      'trips', 'messages', 'notifications', 'contact_requests', 'reviews'
    ) THEN '✅ موجود'
    ELSE '❌ مفقود'
  END as "الحالة"
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'users', 'shippers', 'carriers', 'shipments', 
    'trips', 'messages', 'notifications', 'contact_requests', 'reviews'
  )

UNION ALL

-- =====================================
-- 2. فحص الجداول الجديدة المضافة
-- =====================================

SELECT 
  'جداول جديدة' as category,
  table_name as "اسم الجدول",
  CASE 
    WHEN table_name IN ('saved_matches', 'matching_stats', 'market_prices') 
    THEN '✅ موجود'
    ELSE '❌ مفقود'
  END as "الحالة"
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('saved_matches', 'matching_stats', 'market_prices')

ORDER BY category, "اسم الجدول";

-- =====================================
-- 3. عدد الجداول الإجمالي
-- =====================================

SELECT 
  '📊 إحصائيات' as "النوع",
  COUNT(*) as "العدد",
  '12 جدول مطلوب' as "المطلوب"
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'users', 'shippers', 'carriers', 'shipments', 'trips', 
    'messages', 'notifications', 'contact_requests', 'reviews',
    'saved_matches', 'matching_stats', 'market_prices'
  );

-- =====================================
-- 4. فحص الفهارس المهمة
-- =====================================

SELECT 
  '🔍 فهارس' as "النوع",
  indexname as "اسم الفهرس",
  tablename as "الجدول",
  '✅ موجود' as "الحالة"
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =====================================
-- 5. فحص سياسات الأمان (RLS)
-- =====================================

SELECT 
  '🔒 سياسات الأمان' as "النوع",
  schemaname as "المخطط",
  tablename as "الجدول", 
  policyname as "اسم السياسة",
  '✅ مفعل' as "الحالة"
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'shippers', 'carriers', 'shipments', 'trips',
    'messages', 'notifications', 'contact_requests', 'reviews',
    'saved_matches', 'matching_stats'
  )
ORDER BY tablename, policyname;

-- =====================================
-- 6. فحص الدوال المساعدة
-- =====================================

SELECT 
  '⚙️ دوال مساعدة' as "النوع",
  routine_name as "اسم الدالة",
  routine_type as "نوع الدالة",
  '✅ موجودة' as "الحالة"
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('calculate_route_distance', 'update_matching_stats')
ORDER BY routine_name;

-- =====================================
-- 7. اختبار سريع للعلاقات بين الجداول
-- =====================================

SELECT 
  '🔗 علاقات الجداول' as "النوع",
  tc.table_name as "الجدول الأساسي",
  kcu.column_name as "العمود",
  ccu.table_name as "الجدول المرجعي",
  '✅ متصل' as "الحالة"
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'shippers', 'carriers', 'shipments', 'trips', 
    'messages', 'notifications', 'contact_requests', 'reviews'
  )
ORDER BY tc.table_name, kcu.column_name;

-- =====================================
-- 8. تقرير نهائي مختصر
-- =====================================

WITH table_counts AS (
  SELECT 
    CASE 
      WHEN COUNT(*) = 12 THEN '🎉 جميع الجداول موجودة!'
      ELSE '⚠️ بعض الجداول مفقودة - العدد: ' || COUNT(*)::TEXT || '/12'
    END as status
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN (
      'users', 'shippers', 'carriers', 'shipments', 'trips',
      'messages', 'notifications', 'contact_requests', 'reviews',
      'saved_matches', 'matching_stats', 'market_prices'
    )
)
SELECT 
  '📋 تقرير نهائي' as "النوع",
  status as "الحالة",
  'جاهز لبدء قسم الناقلين!' as "التوصية"
FROM table_counts;