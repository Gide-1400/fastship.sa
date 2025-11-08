# FastShip Database Setup

This directory contains the SQL scripts needed to set up the FastShip database schema.

## Files

1. **[fastship-schema.sql](file://c:\Users\admin\Desktop\مجلد%20جديد%20(3)\fast-ship-sa\fast-ship-sa-main\public\database\fastship-schema.sql)** - The complete database schema definition
2. **[migrate-schema.sql](file://c:\Users\admin\Desktop\مجلد%20جديد%20(3)\fast-ship-sa\fast-ship-sa-main\public\database\migrate-schema.sql)** - Migration script that drops existing tables and creates the new schema
3. **[additional-tables.sql](file://c:\Users\admin\Desktop\مجلد%20جديد%20(3)\fast-ship-sa\fast-ship-sa-main\public\database\additional-tables.sql)** - Legacy schema file (for reference only)

## How to Set Up the Database

### Option 1: Fresh Installation (Recommended)
If you're setting up the database for the first time or want to start fresh:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of [migrate-schema.sql](file://c:\Users\admin\Desktop\مجلد%20جديد%20(3)\fast-ship-sa\fast-ship-sa-main\public\database\migrate-schema.sql)
4. Run the script

### Option 2: Incremental Update
If you want to keep existing data and only add missing tables:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of [fastship-schema.sql](file://c:\Users\admin\Desktop\مجلد%20جديد%20(3)\fast-ship-sa\fast-ship-sa-main\public\database\fastship-schema.sql)
4. Run the script

## Database Schema Overview

The new schema includes the following tables:

- **users** - Core user information
- **shippers** - Information specific to shipping users
- **carriers** - Information specific to transportation users
- **shipments** - Items to be shipped by shippers
- **trips** - Transportation routes offered by carriers
- **messages** - Communication between users
- **notifications** - System and user notifications
- **contact_requests** - Requests between shippers and carriers
- **reviews** - Feedback system between users

## Security

All tables have Row Level Security (RLS) policies enabled to ensure users can only access their own data.

## Indexes

Appropriate indexes have been created for optimal query performance, especially for location-based searches and status filtering.