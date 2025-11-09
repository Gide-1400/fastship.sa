-- 🔄 تحديثات قاعدة البيانات للتفاعل بين قسم الشاحنين والناقلين
-- يجب تنفيذ هذه الاستعلامات في Supabase SQL Editor

-- =====================================
-- سياسات RLS للتفاعل بين القسمين
-- =====================================

-- 1. السماح للناقلين برؤية الشحنات المتاحة للمطابقة
CREATE POLICY "Carriers can view available shipments for matching" ON shipments
  FOR SELECT USING (
    status IN ('pending', 'active') AND 
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND user_type = 'carrier')
  );

-- 2. السماح للشاحنين برؤية رحلات الناقلين المتاحة للمطابقة  
CREATE POLICY "Shippers can view available trips for matching" ON trips
  FOR SELECT USING (
    status IN ('pending', 'active') AND 
    travel_date >= CURRENT_DATE AND
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND user_type = 'shipper')
  );

-- 3. السماح للناقلين برؤية معلومات الشاحنين (للتواصل)
CREATE POLICY "Carriers can view shipper profiles for contact" ON shippers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND user_type = 'carrier')
  );

-- 4. السماح للشاحنين برؤية معلومات الناقلين (للتواصل)
CREATE POLICY "Shippers can view carrier profiles for contact" ON carriers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND user_type = 'shipper')
  );

-- =====================================
-- تحديث جدول الرسائل لدعم أنواع جديدة
-- =====================================

-- إضافة حقول جديدة لجدول messages إذا لم تكن موجودة
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'general' 
CHECK (message_type IN ('general', 'contact_request', 'shipment_offer', 'trip_inquiry', 'system'));

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal' 
CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- =====================================
-- تحديث جدول contact_requests
-- =====================================

-- إضافة حقول إضافية لطلبات التواصل
ALTER TABLE contact_requests 
ADD COLUMN IF NOT EXISTS offered_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS response_message TEXT,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

-- =====================================
-- جدول جديد للمطابقات المحفوظة
-- =====================================

CREATE TABLE IF NOT EXISTS saved_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2), -- نقاط المطابقة
  match_reasons TEXT[], -- أسباب المطابقة كـ array
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- فهارس للمطابقات المحفوظة
CREATE INDEX IF NOT EXISTS idx_saved_matches_user_id ON saved_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_matches_shipment_id ON saved_matches(shipment_id);
CREATE INDEX IF NOT EXISTS idx_saved_matches_trip_id ON saved_matches(trip_id);
CREATE INDEX IF NOT EXISTS idx_saved_matches_score ON saved_matches(match_score);

-- تفعيل RLS للمطابقات المحفوظة
ALTER TABLE saved_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their saved matches" ON saved_matches
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- =====================================
-- جدول إحصائيات المطابقة
-- =====================================

CREATE TABLE IF NOT EXISTS matching_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2),
  location_score DECIMAL(5,2),
  capacity_score DECIMAL(5,2), 
  date_score DECIMAL(5,2),
  vehicle_score DECIMAL(5,2),
  view_count INTEGER DEFAULT 0,
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس للإحصائيات
CREATE INDEX IF NOT EXISTS idx_matching_stats_shipment_id ON matching_stats(shipment_id);
CREATE INDEX IF NOT EXISTS idx_matching_stats_trip_id ON matching_stats(trip_id);
CREATE INDEX IF NOT EXISTS idx_matching_stats_score ON matching_stats(match_score);

-- تفعيل RLS للإحصائيات
ALTER TABLE matching_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view matching stats for their items" ON matching_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments s 
      JOIN shippers sh ON s.shipper_id = sh.id 
      JOIN users u ON sh.user_id = u.id 
      WHERE s.id = matching_stats.shipment_id AND u.auth_user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM trips t 
      JOIN carriers c ON t.carrier_id = c.id 
      JOIN users u ON c.user_id = u.id 
      WHERE t.id = matching_stats.trip_id AND u.auth_user_id = auth.uid()
    )
  );

-- =====================================
-- تحديث جدول التقييمات
-- =====================================

-- إضافة حقول إضافية للتقييمات
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS review_type VARCHAR(50) DEFAULT 'general' 
CHECK (review_type IN ('general', 'delivery_quality', 'communication', 'punctuality', 'professionalism'));

ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;

-- فهرس جديد
CREATE INDEX IF NOT EXISTS idx_reviews_trip_id ON reviews(trip_id);

-- =====================================
-- جدول أسعار السوق والاقتراحات
-- =====================================

CREATE TABLE IF NOT EXISTS market_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_from VARCHAR(255) NOT NULL,
  route_to VARCHAR(255) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  avg_price_per_kg DECIMAL(10,2),
  min_price_per_kg DECIMAL(10,2),
  max_price_per_kg DECIMAL(10,2),
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس لأسعار السوق
CREATE INDEX IF NOT EXISTS idx_market_prices_route ON market_prices(route_from, route_to);
CREATE INDEX IF NOT EXISTS idx_market_prices_vehicle_type ON market_prices(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_market_prices_updated ON market_prices(last_updated);

-- =====================================
-- دوال مساعدة للمطابقة
-- =====================================

-- دالة لحساب المسافة التقريبية (بسيطة)
CREATE OR REPLACE FUNCTION calculate_route_distance(
  from_location TEXT,
  to_location TEXT
) RETURNS INTEGER AS $$
BEGIN
  -- هذه دالة بسيطة، يمكن تحسينها بـ Google Maps API
  -- حالياً ترجع قيم تقديرية للمدن السعودية الرئيسية
  
  -- الرياض - جدة
  IF (from_location ILIKE '%رياض%' AND to_location ILIKE '%جدة%') OR
     (from_location ILIKE '%جدة%' AND to_location ILIKE '%رياض%') THEN
    RETURN 950;
  END IF;
  
  -- الرياض - الدمام
  IF (from_location ILIKE '%رياض%' AND to_location ILIKE '%دمام%') OR
     (from_location ILIKE '%دمام%' AND to_location ILIKE '%رياض%') THEN
    RETURN 400;
  END IF;
  
  -- جدة - مكة
  IF (from_location ILIKE '%جدة%' AND to_location ILIKE '%مكة%') OR
     (from_location ILIKE '%مكة%' AND to_location ILIKE '%جدة%') THEN
    RETURN 80;
  END IF;
  
  -- افتراضي
  RETURN 500;
END;
$$ LANGUAGE plpgsql;

-- دالة لتحديث إحصائيات المطابقة
CREATE OR REPLACE FUNCTION update_matching_stats(
  p_shipment_id UUID,
  p_trip_id UUID,
  p_match_score DECIMAL,
  p_location_score DECIMAL,
  p_capacity_score DECIMAL,
  p_date_score DECIMAL,
  p_vehicle_score DECIMAL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO matching_stats (
    shipment_id, trip_id, match_score, location_score, 
    capacity_score, date_score, vehicle_score, view_count
  ) VALUES (
    p_shipment_id, p_trip_id, p_match_score, p_location_score,
    p_capacity_score, p_date_score, p_vehicle_score, 1
  )
  ON CONFLICT (shipment_id, trip_id) 
  DO UPDATE SET 
    view_count = matching_stats.view_count + 1,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- تحديث البيانات الموجودة
-- =====================================

-- تحديث الرسائل الموجودة لتكون من نوع عام
UPDATE messages SET message_type = 'general' WHERE message_type IS NULL;

-- تحديث التنبيهات لتتضمن نوع المطابقة
UPDATE notifications SET type = 'match' 
WHERE title ILIKE '%مطابق%' OR message ILIKE '%مطاب%';

-- =====================================
-- منح الصلاحيات
-- =====================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================
-- إنشاء فهارس للأداء المتقدم
-- =====================================

-- فهرس مركب للبحث السريع في الشحنات
CREATE INDEX IF NOT EXISTS idx_shipments_status_date_location ON shipments(status, preferred_date, pickup_location, delivery_location);

-- فهرس مركب للبحث السريع في الرحلات  
CREATE INDEX IF NOT EXISTS idx_trips_status_date_route ON trips(status, travel_date, origin, destination);

-- فهرس للرسائل غير المقروءة
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = FALSE;

-- فهرس للتنبيهات غير المقروءة
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- =====================================
-- تعليقات وتوثيق
-- =====================================

COMMENT ON TABLE saved_matches IS 'المطابقات المحفوظة من قبل المستخدمين';
COMMENT ON TABLE matching_stats IS 'إحصائيات تفاعل المستخدمين مع المطابقات';
COMMENT ON TABLE market_prices IS 'أسعار السوق المرجعية للمسارات المختلفة';

COMMENT ON FUNCTION calculate_route_distance(TEXT, TEXT) IS 'حساب المسافة التقريبية بين موقعين';
COMMENT ON FUNCTION update_matching_stats IS 'تحديث إحصائيات عرض المطابقات';