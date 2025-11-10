// ============================================
// FastShip Enhanced Matching System v2.0
// نظام المطابقة المحسّن مع حفظ النتائج
// ============================================

class FastShipMatcherV2 {
  constructor() {
    this.supabase = window.supabaseClient;
    this.cachedMatches = new Map(); // ذاكرة مؤقتة
  }

  /**
   * البحث عن رحلات متطابقة مع الشحنة وحفظها في قاعدة البيانات
   * @param {Object} shipment - بيانات الشحنة
   * @param {boolean} forceRecalculate - إعادة الحساب حتى لو كانت موجودة
   * @returns {Array} قائمة المطابقات
   */
  async findAndSaveMatches(shipment, forceRecalculate = false) {
    try {
      // 1. التحقق من وجود مطابقات محفوظة مسبقاً
      if (!forceRecalculate) {
        const existingMatches = await this.getExistingMatches(shipment.id);
        if (existingMatches.length > 0) {
          console.log('✓ تم العثور على مطابقات محفوظة:', existingMatches.length);
          return existingMatches;
        }
      }

      // 2. حذف المطابقات القديمة إذا كان إعادة حساب
      if (forceRecalculate) {
        await this.supabase
          .from('matches')
          .delete()
          .eq('shipment_id', shipment.id);
      }

      // 3. البحث عن رحلات نشطة
      const { data: trips, error } = await this.supabase
        .from('trips')
        .select(`
          *,
          carriers (
            id,
            user_id,
            vehicle_type,
            rating,
            total_trips,
            users (
              id,
              full_name,
              phone
            )
          )
        `)
        .eq('status', 'active')
        .gte('travel_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      console.log(`🔍 تم العثور على ${trips.length} رحلة نشطة`);

      // 4. حساب المطابقات
      const matchesToSave = [];
      for (const trip of trips) {
        const matchScore = this.calculateMatchScore(shipment, trip);
        
        // حفظ فقط المطابقات الجيدة (أكثر من 30%)
        if (matchScore >= 30) {
          const reasons = this.getMatchReasons(shipment, trip);
          matchesToSave.push({
            shipment_id: shipment.id,
            trip_id: trip.id,
            match_score: matchScore,
            match_reasons: reasons,
            status: 'new',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 يوم
          });
        }
      }

      console.log(`💾 سيتم حفظ ${matchesToSave.length} مطابقة`);

      // 5. حفظ المطابقات في قاعدة البيانات
      if (matchesToSave.length > 0) {
        const { data: savedMatches, error: saveError } = await this.supabase
          .from('matches')
          .insert(matchesToSave)
          .select(`
            *,
            trips (
              *,
              carriers (
                *,
                users (
                  id,
                  full_name,
                  phone
                )
              )
            )
          `);

        if (saveError) {
          console.error('خطأ في حفظ المطابقات:', saveError);
        } else {
          console.log('✅ تم حفظ المطابقات بنجاح');
          
          // إرسال إشعارات للناقلين
          await this.notifyCarriersAboutNewMatch(savedMatches);
          
          // إرسال إشعار للشاحن أيضاً
          await this.notifyShipperAboutNewMatches(shipment, savedMatches);
          
          return savedMatches;
        }
      }

      return [];

    } catch (error) {
      console.error('خطأ في البحث عن المطابقات:', error);
      return [];
    }
  }

  /**
   * الحصول على المطابقات المحفوظة مسبقاً
   */
  async getExistingMatches(shipmentId) {
    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select(`
          *,
          trips (
            *,
            carriers (
              *,
              users (
                id,
                full_name,
                phone
              )
            )
          )
        `)
        .eq('shipment_id', shipmentId)
        .neq('status', 'expired')
        .gt('expires_at', new Date().toISOString())
        .order('match_score', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('خطأ في الحصول على المطابقات:', error);
      return [];
    }
  }

  /**
   * البحث عن شحنات متطابقة مع رحلة (للناقلين)
   */
  async findMatchingShipmentsForTrip(trip, forceRecalculate = false) {
    try {
      // 1. التحقق من وجود مطابقات محفوظة
      if (!forceRecalculate) {
        const existingMatches = await this.getExistingMatchesForTrip(trip.id);
        if (existingMatches.length > 0) {
          console.log('✓ تم العثور على مطابقات محفوظة:', existingMatches.length);
          return existingMatches;
        }
      }

      // 2. البحث عن شحنات معلقة
      const { data: shipments, error } = await this.supabase
        .from('shipments')
        .select(`
          *,
          shippers (
            id,
            user_id,
            rating,
            total_shipments,
            users (
              id,
              full_name,
              phone
            )
          )
        `)
        .eq('status', 'pending')
        .gte('preferred_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      console.log(`🔍 تم العثور على ${shipments.length} شحنة معلقة`);

      // 3. حساب وحفظ المطابقات
      const matchesToSave = [];
      for (const shipment of shipments) {
        const matchScore = this.calculateMatchScore(shipment, trip);
        
        if (matchScore >= 30) {
          const reasons = this.getMatchReasons(shipment, trip);
          
          // التحقق من عدم وجود المطابقة مسبقاً
          const { data: existing } = await this.supabase
            .from('matches')
            .select('id')
            .eq('shipment_id', shipment.id)
            .eq('trip_id', trip.id)
            .single();

          if (!existing) {
            matchesToSave.push({
              shipment_id: shipment.id,
              trip_id: trip.id,
              match_score: matchScore,
              match_reasons: reasons,
              status: 'new',
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // 4. حفظ المطابقات
      if (matchesToSave.length > 0) {
        const { data: savedMatches, error: saveError } = await this.supabase
          .from('matches')
          .insert(matchesToSave)
          .select(`
            *,
            shipments (
              *,
              shippers (
                *,
                users (
                  id,
                  full_name,
                  phone
                )
              )
            )
          `);

        if (saveError) {
          console.error('خطأ في حفظ المطابقات:', saveError);
        } else {
          console.log('✅ تم حفظ المطابقات بنجاح');
          return savedMatches;
        }
      }

      return [];

    } catch (error) {
      console.error('خطأ في البحث عن الشحنات المتطابقة:', error);
      return [];
    }
  }

  /**
   * الحصول على المطابقات لرحلة معينة
   */
  async getExistingMatchesForTrip(tripId) {
    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select(`
          *,
          shipments (
            *,
            shippers (
              *,
              users (
                id,
                full_name,
                phone
              )
            )
          )
        `)
        .eq('trip_id', tripId)
        .neq('status', 'expired')
        .gt('expires_at', new Date().toISOString())
        .order('match_score', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('خطأ في الحصول على المطابقات:', error);
      return [];
    }
  }

  /**
   * تحديث حالة المطابقة
   */
  async updateMatchStatus(matchId, status, additionalData = {}) {
    try {
      const updateData = {
        status: status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      const { data, error } = await this.supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('خطأ في تحديث حالة المطابقة:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * تحديد أن الشاحن شاهد المطابقة
   */
  async markMatchAsViewedByShipper(matchId) {
    return await this.updateMatchStatus(matchId, 'viewed', {
      shipper_viewed_at: new Date().toISOString()
    });
  }

  /**
   * تحديد أن الناقل شاهد المطابقة
   */
  async markMatchAsViewedByCarrier(matchId) {
    return await this.updateMatchStatus(matchId, 'viewed', {
      carrier_viewed_at: new Date().toISOString()
    });
  }

  /**
   * حساب نقاط المطابقة (نفس الخوارزمية السابقة)
   */
  calculateMatchScore(shipment, trip) {
    let score = 0;

    // 1. مطابقة الموقع (40 نقطة)
    const locationScore = this.calculateLocationScore(shipment, trip);
    score += locationScore * 40;

    // 2. مطابقة الوزن والسعة (30 نقطة)
    const capacityScore = this.calculateCapacityScore(shipment, trip);
    score += capacityScore * 30;

    // 3. مطابقة التاريخ (20 نقطة)
    const dateScore = this.calculateDateScore(shipment, trip);
    score += dateScore * 20;

    // 4. مطابقة نوع المركبة (10 نقاط)
    const vehicleScore = this.calculateVehicleScore(shipment, trip);
    score += vehicleScore * 10;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * حساب مطابقة الموقع
   */
  calculateLocationScore(shipment, trip) {
    const pickupMatch = this.locationSimilarity(shipment.pickup_location, trip.origin);
    const deliveryMatch = this.locationSimilarity(shipment.delivery_location, trip.destination);
    return (pickupMatch + deliveryMatch) / 2;
  }

  /**
   * حساب مطابقة السعة
   */
  calculateCapacityScore(shipment, trip) {
    const shipmentWeight = parseFloat(shipment.weight) || 0;
    const availableCapacity = parseFloat(trip.capacity) || 0;

    if (availableCapacity === 0) return 0;
    if (shipmentWeight > availableCapacity) return 0; // لا يمكن النقل

    const utilization = shipmentWeight / availableCapacity;

    if (utilization >= 0.7 && utilization <= 0.9) return 1.0;
    if (utilization >= 0.5 && utilization <= 1.0) return 0.8;
    if (utilization >= 0.3 && utilization <= 1.2) return 0.6;
    
    return 0.4;
  }

  /**
   * حساب مطابقة التاريخ
   */
  calculateDateScore(shipment, trip) {
    const shipmentDate = new Date(shipment.preferred_date);
    const tripDate = new Date(trip.travel_date);
    const diffDays = Math.abs((shipmentDate - tripDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 1.0;
    if (diffDays <= 1) return 0.9;
    if (diffDays <= 3) return 0.7;
    if (diffDays <= 7) return 0.5;
    if (diffDays <= 14) return 0.3;
    
    return 0;
  }

  /**
   * حساب مطابقة نوع المركبة
   */
  calculateVehicleScore(shipment, trip) {
    const shipmentType = shipment.vehicle_type_preferred || 'any';
    const vehicleType = trip.vehicle_type || 'any';

    if (shipmentType === 'any' || vehicleType === 'any') return 1.0;
    if (shipmentType === vehicleType) return 1.0;

    // فئات متوافقة
    const compatibleTypes = {
      'car': ['suv', 'sedan'],
      'pickup': ['van', 'small_truck'],
      'truck': ['heavy_truck', 'trailer'],
      'van': ['pickup', 'delivery_truck']
    };

    if (compatibleTypes[shipmentType]?.includes(vehicleType)) return 0.7;
    
    return 0.3;
  }

  /**
   * قياس تشابه المواقع
   */
  locationSimilarity(loc1, loc2) {
    if (!loc1 || !loc2) return 0;

    const clean1 = loc1.toLowerCase().trim();
    const clean2 = loc2.toLowerCase().trim();

    if (clean1 === clean2) return 1.0;
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;

    // مدن سعودية
    const saudiCities = ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الخبر', 'أبها', 'تبوك'];
    const city1 = saudiCities.find(city => clean1.includes(city));
    const city2 = saudiCities.find(city => clean2.includes(city));

    if (city1 && city2 && city1 === city2) return 0.9;
    
    return 0.2;
  }

  /**
   * الحصول على أسباب المطابقة
   */
  getMatchReasons(shipment, trip) {
    const reasons = [];

    const pickupMatch = this.locationSimilarity(shipment.pickup_location, trip.origin);
    const deliveryMatch = this.locationSimilarity(shipment.delivery_location, trip.destination);

    if (pickupMatch >= 0.8) reasons.push('موقع الاستلام متطابق');
    if (deliveryMatch >= 0.8) reasons.push('موقع التسليم متطابق');

    const shipmentWeight = parseFloat(shipment.weight);
    const capacity = parseFloat(trip.capacity);
    if (shipmentWeight <= capacity) reasons.push('السعة كافية');

    const shipmentDate = new Date(shipment.preferred_date);
    const tripDate = new Date(trip.travel_date);
    const diffDays = Math.abs((shipmentDate - tripDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) reasons.push('التاريخ متطابق');

    if (trip.carriers?.rating >= 4.5) reasons.push('ناقل ذو تقييم عالي');

    return reasons;
  }

  /**
   * إرسال إشعارات للناقلين عن المطابقات الجديدة
   */
  async notifyCarriersAboutNewMatch(matches) {
    try {
      for (const match of matches) {
        const carrierId = match.trips?.carrier_id;
        const carrierUserId = match.trips?.carriers?.user_id;

        if (carrierUserId && window.enhancedNotifications) {
          await window.enhancedNotifications.createMatchNotification({
            match: match,
            isHighScore: match.match_score >= 80
          }, 'carrier');
        }
      }
    } catch (error) {
      console.error('خطأ في إرسال الإشعارات للناقلين:', error);
    }
  }

  /**
   * إرسال إشعارات للشاحن عن المطابقات الجديدة
   */
  async notifyShipperAboutNewMatches(shipment, matches) {
    try {
      if (matches.length === 0) return;

      const shipperUserId = shipment.shippers?.user_id;
      if (!shipperUserId || !window.enhancedNotifications) return;

      // إرسال إشعار واحد للشاحن عن جميع المطابقات
      const highScoreMatches = matches.filter(m => m.match_score >= 80);
      const title = highScoreMatches.length > 0 ? '🎯 مطابقات ممتازة!' : '📦 مطابقات جديدة';
      const message = `تم العثور على ${matches.length} ناقل متطابق مع شحنتك "${shipment.title}"`;

      await window.enhancedNotifications.createNotification({
        userId: shipperUserId,
        type: 'match',
        title: title,
        message: message,
        priority: highScoreMatches.length > 0 ? 'high' : 'normal',
        relatedId: shipment.id,
        relatedType: 'shipment',
        actionUrl: `/shipper-app/matches.html?shipment_id=${shipment.id}`,
        actionText: 'عرض المطابقات',
        icon: 'fas fa-bullseye'
      });
    } catch (error) {
      console.error('خطأ في إرسال الإشعارات للشاحن:', error);
    }
  }

  /**
   * حذف المطابقات المنتهية
   */
  async cleanupExpiredMatches() {
    try {
      const { error } = await this.supabase
        .from('matches')
        .update({ status: 'expired' })
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'new');

      if (error) throw error;
      console.log('✅ تم تحديث المطابقات المنتهية');
    } catch (error) {
      console.error('خطأ في حذف المطابقات المنتهية:', error);
    }
  }
}

// إنشاء instance عام
window.fastShipMatcher = new FastShipMatcherV2();

// تنظيف تلقائي كل ساعة
setInterval(() => {
  window.fastShipMatcher.cleanupExpiredMatches();
}, 60 * 60 * 1000);
