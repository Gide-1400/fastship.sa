-- إضافة جداول مفقودة لنظام FastShip
-- يجب تنفيذ هذه الاستعلامات في Supabase SQL Editor

-- جدول طلبات التواصل بين الشاحنين والناقلين
CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_contact_requests_shipment_id ON contact_requests(shipment_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_trip_id ON contact_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);

-- جدول الرحلات (trips) - تأكد من وجوده
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  from_location VARCHAR(255) NOT NULL,
  to_location VARCHAR(255) NOT NULL,
  available_date DATE NOT NULL,
  available_capacity DECIMAL(10,2) DEFAULT 0,
  vehicle_type VARCHAR(50) DEFAULT 'any',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة فهارس للرحلات
CREATE INDEX IF NOT EXISTS idx_trips_carrier_id ON trips(carrier_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_available_date ON trips(available_date);
CREATE INDEX IF NOT EXISTS idx_trips_from_location ON trips(from_location);
CREATE INDEX IF NOT EXISTS idx_trips_to_location ON trips(to_location);

-- جدول الناقلين (carriers) - تأكد من وجوده
CREATE TABLE IF NOT EXISTS carriers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  vehicle_type VARCHAR(50) DEFAULT 'any',
  license_number VARCHAR(100),
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة فهارس للناقلين
CREATE INDEX IF NOT EXISTS idx_carriers_user_id ON carriers(user_id);
CREATE INDEX IF NOT EXISTS idx_carriers_status ON carriers(status);

-- تحديث جدول الشحنات لإضافة حقول مفقودة
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS preferred_date DATE,
ADD COLUMN IF NOT EXISTS vehicle_type_preferred VARCHAR(50) DEFAULT 'any',
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'in_transit', 'delivered', 'cancelled'));

-- إضافة فهارس للشحنات
CREATE INDEX IF NOT EXISTS idx_shipments_shipper_id ON shipments(shipper_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at);

-- تفعيل RLS (Row Level Security) للجداول الجديدة
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للرسائل
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can update their received messages" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- سياسات RLS للتنبيهات
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- يمكن للنظام إنشاء تنبيهات

-- جدول الرسائل بين المستخدمين
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة فهارس للرسائل
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_shipment_id ON messages(shipment_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- جدول التنبيهات والإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('shipment', 'message', 'system', 'contact_request')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_id UUID, -- معرف الشيء المرتبط (shipment_id, message_id, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة فهارس للتنبيهات
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- سياسات RLS للمستخدمين
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- سياسات RLS للشحنات
CREATE POLICY "Users can view their own shipments" ON shipments
  FOR SELECT USING (auth.uid() = shipper_id);

CREATE POLICY "Users can insert their own shipments" ON shipments
  FOR INSERT WITH CHECK (auth.uid() = shipper_id);

CREATE POLICY "Users can update their own shipments" ON shipments
  FOR UPDATE USING (auth.uid() = shipper_id);

-- سياسات RLS للرسائل
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can update their received messages" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- سياسات RLS للتنبيهات
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- يمكن للنظام إنشاء تنبيهات