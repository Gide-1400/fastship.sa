-- ==========================================
-- إنشاء جدول المطابقات (matches)
-- جدول مطلوب لخوارزمية الربط بين الناقلين والشاحنين
-- ==========================================

-- إنشاء جدول المطابقات
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT[], -- أسباب المطابقة كـ array
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'contacted', 'accepted', 'rejected', 'expired')),
  
  -- تواريخ المشاهدة والتفاعل
  shipper_viewed_at TIMESTAMP WITH TIME ZONE,
  carrier_viewed_at TIMESTAMP WITH TIME ZONE,
  
  -- تاريخ انتهاء المطابقة (30 يوم افتراضياً)
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  
  -- أولوية المطابقة (حسب النقاط)
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- حقول التوقيت
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ضمان عدم تكرار المطابقة
  UNIQUE(shipment_id, trip_id)
);

-- ==========================================
-- إنشاء الفهارس للأداء
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_matches_shipment_id ON matches(shipment_id);
CREATE INDEX IF NOT EXISTS idx_matches_trip_id ON matches(trip_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_priority ON matches(priority);
CREATE INDEX IF NOT EXISTS idx_matches_expires_at ON matches(expires_at);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

-- فهرس مركب للبحث السريع
CREATE INDEX IF NOT EXISTS idx_matches_active ON matches(status, expires_at) 
WHERE status != 'expired' AND expires_at > NOW();

-- ==========================================
-- تفعيل Row Level Security
-- ==========================================

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- سياسات RLS للمطابقات
-- ==========================================

-- الشاحنون يمكنهم رؤية المطابقات لشحناتهم
CREATE POLICY "Shippers can view matches for their shipments" ON matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments s 
      JOIN shippers sh ON s.shipper_id = sh.id 
      JOIN users u ON sh.user_id = u.id 
      WHERE s.id = matches.shipment_id AND u.auth_user_id = auth.uid()
    )
  );

-- الناقلون يمكنهم رؤية المطابقات لرحلاتهم
CREATE POLICY "Carriers can view matches for their trips" ON matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t 
      JOIN carriers c ON t.carrier_id = c.id 
      JOIN users u ON c.user_id = u.id 
      WHERE t.id = matches.trip_id AND u.auth_user_id = auth.uid()
    )
  );

-- النظام يمكنه إنشاء المطابقات
CREATE POLICY "System can insert matches" ON matches
  FOR INSERT WITH CHECK (true);

-- الشاحنون يمكنهم تحديث حالة مشاهدة المطابقات لشحناتهم
CREATE POLICY "Shippers can update their match views" ON matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shipments s 
      JOIN shippers sh ON s.shipper_id = sh.id 
      JOIN users u ON sh.user_id = u.id 
      WHERE s.id = matches.shipment_id AND u.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments s 
      JOIN shippers sh ON s.shipper_id = sh.id 
      JOIN users u ON sh.user_id = u.id 
      WHERE s.id = matches.shipment_id AND u.auth_user_id = auth.uid()
    )
  );

-- الناقلون يمكنهم تحديث حالة مشاهدة المطابقات لرحلاتهم
CREATE POLICY "Carriers can update their match views" ON matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips t 
      JOIN carriers c ON t.carrier_id = c.id 
      JOIN users u ON c.user_id = u.id 
      WHERE t.id = matches.trip_id AND u.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t 
      JOIN carriers c ON t.carrier_id = c.id 
      JOIN users u ON c.user_id = u.id 
      WHERE t.id = matches.trip_id AND u.auth_user_id = auth.uid()
    )
  );

-- ==========================================
-- دوال مساعدة للمطابقات
-- ==========================================

-- دالة لتحديث الأولوية حسب النقاط
CREATE OR REPLACE FUNCTION update_match_priority()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث الأولوية حسب نقاط المطابقة
  IF NEW.match_score >= 90 THEN
    NEW.priority = 'urgent';
  ELSIF NEW.match_score >= 75 THEN
    NEW.priority = 'high';
  ELSIF NEW.match_score >= 50 THEN
    NEW.priority = 'normal';
  ELSE
    NEW.priority = 'low';
  END IF;
  
  -- تحديث وقت التعديل
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء المشغل (trigger)
CREATE TRIGGER trigger_update_match_priority
  BEFORE INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_match_priority();

-- ==========================================
-- دالة لإنتهاء صلاحية المطابقات القديمة
-- ==========================================

CREATE OR REPLACE FUNCTION expire_old_matches()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- تحديث المطابقات المنتهية الصلاحية
  UPDATE matches 
  SET status = 'expired', updated_at = NOW()
  WHERE status NOT IN ('expired', 'accepted') 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- دالة للحصول على إحصائيات المطابقات
-- ==========================================

CREATE OR REPLACE FUNCTION get_match_statistics(user_type TEXT, user_auth_id UUID)
RETURNS TABLE(
  total_matches INTEGER,
  new_matches INTEGER,
  viewed_matches INTEGER,
  contacted_matches INTEGER,
  avg_match_score DECIMAL,
  highest_score DECIMAL
) AS $$
BEGIN
  IF user_type = 'shipper' THEN
    RETURN QUERY
    SELECT 
      COUNT(*)::INTEGER as total_matches,
      COUNT(CASE WHEN m.status = 'new' THEN 1 END)::INTEGER as new_matches,
      COUNT(CASE WHEN m.status = 'viewed' THEN 1 END)::INTEGER as viewed_matches,
      COUNT(CASE WHEN m.status = 'contacted' THEN 1 END)::INTEGER as contacted_matches,
      ROUND(AVG(m.match_score), 2) as avg_match_score,
      MAX(m.match_score) as highest_score
    FROM matches m
    JOIN shipments s ON m.shipment_id = s.id
    JOIN shippers sh ON s.shipper_id = sh.id
    JOIN users u ON sh.user_id = u.id
    WHERE u.auth_user_id = user_auth_id
      AND m.status != 'expired'
      AND m.expires_at > NOW();
      
  ELSIF user_type = 'carrier' THEN
    RETURN QUERY
    SELECT 
      COUNT(*)::INTEGER as total_matches,
      COUNT(CASE WHEN m.status = 'new' THEN 1 END)::INTEGER as new_matches,
      COUNT(CASE WHEN m.status = 'viewed' THEN 1 END)::INTEGER as viewed_matches,
      COUNT(CASE WHEN m.status = 'contacted' THEN 1 END)::INTEGER as contacted_matches,
      ROUND(AVG(m.match_score), 2) as avg_match_score,
      MAX(m.match_score) as highest_score
    FROM matches m
    JOIN trips t ON m.trip_id = t.id
    JOIN carriers c ON t.carrier_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE u.auth_user_id = user_auth_id
      AND m.status != 'expired'
      AND m.expires_at > NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- منح الصلاحيات
-- ==========================================

GRANT ALL ON matches TO authenticated;
GRANT EXECUTE ON FUNCTION update_match_priority() TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_statistics(TEXT, UUID) TO authenticated;

-- ==========================================
-- تعليقات وتوثيق
-- ==========================================

COMMENT ON TABLE matches IS 'جدول المطابقات بين الشحنات والرحلات - محور نظام الربط';
COMMENT ON COLUMN matches.match_score IS 'نقاط المطابقة من 0 إلى 100';
COMMENT ON COLUMN matches.match_reasons IS 'أسباب المطابقة كـ مصفوفة نصوص';
COMMENT ON COLUMN matches.status IS 'حالة المطابقة: new, viewed, contacted, accepted, rejected, expired';
COMMENT ON COLUMN matches.priority IS 'أولوية المطابقة: low, normal, high, urgent';
COMMENT ON COLUMN matches.expires_at IS 'تاريخ انتهاء صلاحية المطابقة';

COMMENT ON FUNCTION update_match_priority() IS 'تحديث أولوية المطابقة حسب النقاط تلقائياً';
COMMENT ON FUNCTION expire_old_matches() IS 'إنتهاء صلاحية المطابقات القديمة';
COMMENT ON FUNCTION get_match_statistics(TEXT, UUID) IS 'الحصول على إحصائيات المطابقات للمستخدم';

-- ==========================================
-- بيانات تجريبية (اختيارية)
-- ==========================================

-- يمكن إضافة بعض البيانات التجريبية هنا للاختبار
-- INSERT INTO matches (shipment_id, trip_id, match_score, match_reasons, status)
-- VALUES (...);