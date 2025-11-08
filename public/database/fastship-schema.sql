-- FastShip Database Schema
-- Complete schema for the shipping platform with separate shipper and carrier functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (core authentication table)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE NOT NULL, -- References Supabase Auth user ID
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('shipper', 'carrier')), -- shipper or carrier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shippers table (for users who want to ship items)
CREATE TABLE IF NOT EXISTS shippers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  address TEXT,
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_shipments INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Carriers table (for users who transport shipments)
CREATE TABLE IF NOT EXISTS carriers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) DEFAULT 'any',
  license_number VARCHAR(100),
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipments table (items to be shipped by shippers)
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipper_id UUID NOT NULL REFERENCES shippers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  weight DECIMAL(10,2) NOT NULL,
  dimensions VARCHAR(50), -- e.g., "10x20x30 cm"
  pickup_location VARCHAR(255) NOT NULL,
  delivery_location VARCHAR(255) NOT NULL,
  preferred_date DATE,
  vehicle_type_preferred VARCHAR(50) DEFAULT 'any',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'in_transit', 'delivered', 'cancelled')),
  price DECIMAL(10,2),
  insurance BOOLEAN DEFAULT FALSE,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table (transportation routes offered by carriers)
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  travel_date DATE NOT NULL,
  capacity DECIMAL(10,2) NOT NULL, -- Available capacity in kg
  price_per_kg DECIMAL(10,2),
  vehicle_type VARCHAR(50) DEFAULT 'any',
  description TEXT,
  terms TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (communication between users)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  related_trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table (system and user notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('system', 'shipment', 'trip', 'message', 'match')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_id UUID, -- ID of related record (shipment, trip, message, etc.)
  related_type VARCHAR(50), -- Type of related record
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact requests table (requests between shippers and carriers)
CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipper_id UUID NOT NULL REFERENCES shippers(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table (feedback between shippers and carriers)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

CREATE INDEX IF NOT EXISTS idx_shippers_user_id ON shippers(user_id);
CREATE INDEX IF NOT EXISTS idx_shippers_status ON shippers(status);

CREATE INDEX IF NOT EXISTS idx_carriers_user_id ON carriers(user_id);
CREATE INDEX IF NOT EXISTS idx_carriers_status ON carriers(status);

CREATE INDEX IF NOT EXISTS idx_shipments_shipper_id ON shipments(shipper_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_location ON shipments(pickup_location);
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_location ON shipments(delivery_location);
CREATE INDEX IF NOT EXISTS idx_shipments_preferred_date ON shipments(preferred_date);

CREATE INDEX IF NOT EXISTS idx_trips_carrier_id ON trips(carrier_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_origin ON trips(origin);
CREATE INDEX IF NOT EXISTS idx_trips_destination ON trips(destination);
CREATE INDEX IF NOT EXISTS idx_trips_travel_date ON trips(travel_date);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_related_shipment_id ON messages(related_shipment_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_contact_requests_shipper_id ON contact_requests(shipper_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_carrier_id ON contact_requests(carrier_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_shipment_id ON contact_requests(shipment_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_trip_id ON contact_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_id ON reviews(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shipment_id ON reviews(shipment_id);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shippers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- RLS Policies for Shippers
CREATE POLICY "Shippers can view their own records" ON shippers
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Shippers can update their own records" ON shippers
  FOR UPDATE USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert shipper records for themselves" ON shippers
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- RLS Policies for Carriers
CREATE POLICY "Carriers can view their own records" ON carriers
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Carriers can update their own records" ON carriers
  FOR UPDATE USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert carrier records for themselves" ON carriers
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- RLS Policies for Shipments
CREATE POLICY "Shippers can view their own shipments" ON shipments
  FOR SELECT USING (shipper_id = (SELECT id FROM shippers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

CREATE POLICY "Shippers can insert their own shipments" ON shipments
  FOR INSERT WITH CHECK (shipper_id = (SELECT id FROM shippers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

CREATE POLICY "Shippers can update their own shipments" ON shipments
  FOR UPDATE USING (shipper_id = (SELECT id FROM shippers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

-- RLS Policies for Trips
CREATE POLICY "Carriers can view their own trips" ON trips
  FOR SELECT USING (carrier_id = (SELECT id FROM carriers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

CREATE POLICY "Carriers can insert their own trips" ON trips
  FOR INSERT WITH CHECK (carrier_id = (SELECT id FROM carriers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

CREATE POLICY "Carriers can update their own trips" ON trips
  FOR UPDATE USING (carrier_id = (SELECT id FROM carriers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

-- RLS Policies for Messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (sender_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()) 
                    OR receiver_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their received messages" ON messages
  FOR UPDATE USING (receiver_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- RLS Policies for Notifications
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- RLS Policies for Contact Requests
CREATE POLICY "Users can view contact requests they are involved in" ON contact_requests
  FOR SELECT USING (shipper_id = (SELECT id FROM shippers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()))
                    OR carrier_id = (SELECT id FROM carriers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

CREATE POLICY "Shippers can create contact requests" ON contact_requests
  FOR INSERT WITH CHECK (shipper_id = (SELECT id FROM shippers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

CREATE POLICY "Carriers can update contact requests they are involved in" ON contact_requests
  FOR UPDATE USING (carrier_id = (SELECT id FROM carriers WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())));

-- RLS Policies for Reviews
CREATE POLICY "Users can view reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (reviewer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;