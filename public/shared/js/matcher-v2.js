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
      console.log('🔍 البحث عن رحلات نشطة...');
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
        .eq('status', 'active');

      if (error) {
        console.error('❌ خطأ في البحث عن الرحلات:', error);
        throw error;
      }

      console.log(`🔍 تم العثور على ${trips?.length || 0} رحلة نشطة`);
      if (trips && trips.length > 0) {
        console.log('📋 عينة من الرحلات:');
        trips.slice(0, 3).forEach((trip, index) => {
          console.log(`  ${index + 1}. ${trip.origin} → ${trip.destination} (${trip.capacity} كجم)`);
        });
      }

      // 4. حساب المطابقات
      const matchesToSave = [];
      for (const trip of trips) {
        const matchScore = this.calculateMatchScore(shipment, trip);
        console.log(`🔢 مطابقة للشحنة "${shipment.title}" مع رحلة "${trip.origin} → ${trip.destination}": ${matchScore}%`);
        
        // حفظ فقط المطابقات الجيدة جداً (أكثر من 40%)
        if (matchScore >= 40) {
          const reasons = this.getMatchReasons(shipment, trip);
          console.log(`✅ مطابقة جيدة جداً: ${matchScore}% - الأسباب:`, reasons);
          matchesToSave.push({
            shipment_id: shipment.id,
            trip_id: trip.id,
            match_score: matchScore,
            match_reasons: reasons,
            status: 'new',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 يوم
          });
        } else {
          console.log(`❌ مطابقة ضعيفة: ${matchScore}% - تم تجاهلها`);
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
      console.log('📦 البحث عن شحنات معلقة...');
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
        .eq('status', 'pending');

      if (error) {
        console.error('❌ خطأ في البحث عن الشحنات:', error);
        throw error;
      }

      console.log(`� تم العثور على ${shipments?.length || 0} شحنة معلقة`);
      if (shipments && shipments.length > 0) {
        console.log('📋 عينة من الشحنات:');
        shipments.slice(0, 3).forEach((shipment, index) => {
          console.log(`  ${index + 1}. ${shipment.title}: ${shipment.pickup_location} → ${shipment.delivery_location} (${shipment.weight} كجم)`);
        });
      }

      // 3. حساب وحفظ المطابقات
      const matchesToSave = [];
      for (const shipment of shipments) {
        const matchScore = this.calculateMatchScore(shipment, trip);
        console.log(`🔢 مطابقة للرحلة "${trip.origin} → ${trip.destination}" مع شحنة "${shipment.title}": ${matchScore}%`);
        
        if (matchScore >= 5) {
          const reasons = this.getMatchReasons(shipment, trip);
          
          // التحقق من عدم وجود المطابقة مسبقاً
          const { data: existing, error: existError } = await this.supabase
            .from('matches')
            .select('id')
            .eq('shipment_id', shipment.id)
            .eq('trip_id', trip.id)
            .maybeSingle();

          if (!existing) {
            console.log(`✅ مطابقة جيدة: ${matchScore}% - الأسباب:`, reasons);
            matchesToSave.push({
              shipment_id: shipment.id,
              trip_id: trip.id,
              match_score: matchScore,
              match_reasons: reasons,
              status: 'new',
              created_at: new Date().toISOString()
            });
          } else {
            console.log(`🔄 المطابقة موجودة مسبقاً`);
          }
        } else {
          console.log(`❌ مطابقة ضعيفة: ${matchScore}% - تم تجاهلها`);
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

    // 1. مطابقة المسار - المدن فقط (50 نقطة)
    const routeScore = this.calculateRouteScore(shipment, trip);
    score += routeScore * 50;
    console.log(`  �️ نتيجة المسار: ${routeScore.toFixed(2)} = ${(routeScore * 50).toFixed(1)} نقطة`);

    // 2. مطابقة الوزن مع نوع الناقل (50 نقطة)
    const weightTypeScore = this.calculateWeightTypeScore(shipment, trip);
    score += weightTypeScore * 50;
    console.log(`  ⚖️ نتيجة الوزن/النوع: ${weightTypeScore.toFixed(2)} = ${(weightTypeScore * 50).toFixed(1)} نقطة`);

    const finalScore = Math.round(Math.min(100, Math.max(0, score)));
    console.log(`  🎯 النتيجة النهائية: ${finalScore}%`);
    
    return finalScore;
  }

  /**
   * حساب مطابقة المسار (المدن فقط)
   */
  calculateRouteScore(shipment, trip) {
    const pickupMatch = this.citySimilarity(shipment.pickup_location, trip.origin);
    const deliveryMatch = this.citySimilarity(shipment.delivery_location, trip.destination);
    
    console.log(`    📍 مطابقة نقطة الانطلاق: "${shipment.pickup_location}" vs "${trip.origin}" = ${pickupMatch.toFixed(2)}`);
    console.log(`    📍 مطابقة نقطة الوصول: "${shipment.delivery_location}" vs "${trip.destination}" = ${deliveryMatch.toFixed(2)}`);
    
    // يجب أن تتطابق النقطتين معاً بشكل جيد (على الأقل 0.8 لكل منهما)
    if (pickupMatch < 0.8 || deliveryMatch < 0.8) {
      console.log(`    ❌ المسار لا يتطابق جيداً - إحدى النقاط أو كلتاهما غير متطابقة`);
      return 0.1;
    }
    
    // متوسط المطابقة
    const routeScore = (pickupMatch + deliveryMatch) / 2;
    return routeScore;
  }

  /**
   * حساب مطابقة الوزن مع نوع الناقل
   */
  calculateWeightTypeScore(shipment, trip) {
    const shipmentWeight = parseFloat(shipment.weight) || 0;
    const carrierType = trip.carriers?.vehicle_type || trip.vehicle_type || 'any';
    
    console.log(`    ⚖️ وزن الشحنة: ${shipmentWeight} كجم، نوع الناقل: ${carrierType}`);

    // إذا لم يحدد وزن الشحنة
    if (shipmentWeight === 0) {
      console.log(`    ⚠️ وزن الشحنة غير محدد - نتيجة متوسطة`);
      return 0.5;
    }

    // تصنيف الشحنات ومطابقتها مع أنواع الناقلين
    let idealCarrierTypes = [];
    let suitableCarrierTypes = [];
    
    if (shipmentWeight <= 20) {
      // شحنات صغيرة (0-20 كجم)
      idealCarrierTypes = ['individual', 'car', 'personal'];
      suitableCarrierTypes = ['pickup', 'van'];
      console.log(`    📦 شحنة صغيرة - مناسبة للناقل الفردي أو السيارة الخاصة`);
      
    } else if (shipmentWeight <= 100) {
      // شحنات متوسطة (20-100 كجم)
      idealCarrierTypes = ['car', 'pickup'];
      suitableCarrierTypes = ['van', 'individual'];
      console.log(`    📦 شحنة متوسطة - مناسبة للسيارة أو البيك أب`);
      
    } else if (shipmentWeight <= 1000) {
      // شحنات كبيرة (100-1000 كجم)
      idealCarrierTypes = ['van', 'pickup', 'truck'];
      suitableCarrierTypes = ['car'];
      console.log(`    📦 شحنة كبيرة - مناسبة للفان أو البيك أب الكبير`);
      
    } else {
      // شحنات ثقيلة (1000+ كجم / 1+ طن)
      idealCarrierTypes = ['truck', 'fleet'];
      suitableCarrierTypes = ['van'];
      console.log(`    � شحنة ثقيلة - تحتاج شاحنة أو أسطول`);
    }

    // التحقق من التطابق
    if (idealCarrierTypes.includes(carrierType)) {
      console.log(`    ✅ مطابقة مثالية - نوع الناقل مناسب تماماً`);
      return 1.0;
    }
    
    if (suitableCarrierTypes.includes(carrierType)) {
      console.log(`    ✅ مطابقة جيدة - نوع الناقل مناسب`);
      return 0.7;
    }
    
    // إذا كان النوع 'any' أو غير محدد
    if (carrierType === 'any' || !carrierType) {
      console.log(`    ⚠️ نوع الناقل غير محدد - نتيجة متوسطة`);
      return 0.5;
    }
    
    console.log(`    ❌ نوع الناقل غير مناسب للشحنة`);
    return 0.2;
  }

  /**
   * حساب مطابقة التاريخ
   */
  calculateDateScore(shipment, trip) {
    const shipmentDate = new Date(shipment.preferred_date);
    const tripDate = new Date(trip.travel_date);
    const diffDays = Math.abs((shipmentDate - tripDate) / (1000 * 60 * 60 * 24));
    console.log(`    📅 تاريخ الشحنة: ${shipment.preferred_date}، تاريخ الرحلة: ${trip.travel_date}، الفرق: ${diffDays.toFixed(1)} يوم`);

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
    // نوع المركبة ليس مهماً - المهم هو السعة
    return 1.0;
  }

  /**
   * مطابقة المدن فقط (مسافة حتى 100 كم مقبولة)
   */
  citySimilarity(loc1, loc2) {
    if (!loc1 || !loc2) return 0;

    const clean1 = loc1.toLowerCase().trim();
    const clean2 = loc2.toLowerCase().trim();

    console.log(`      🌆 مقارنة المدن: "${clean1}" vs "${clean2}"`);

    // مطابقة تامة
    if (clean1 === clean2) {
      console.log(`      ✅ تطابق تام`);
      return 1.0;
    }

    // استخراج المدن السعودية الرئيسية
    const saudiCities = {
      'الرياض': ['الرياض', 'riyadh'],
      'جدة': ['جدة', 'jeddah', 'jiddah'],
      'مكة': ['مكة', 'مكة المكرمة', 'mecca', 'makkah'],
      'المدينة': ['المدينة', 'المدينة المنورة', 'medina', 'madinah'],
      'الدمام': ['الدمام', 'dammam'],
      'الخبر': ['الخبر', 'khobar', 'al-khobar'],
      'الظهران': ['الظهران', 'dhahran'],
      'الخرج': ['الخرج', 'al-kharj'],
      'أبها': ['أبها', 'abha'],
      'تبوك': ['تبوك', 'tabuk'],
      'القصيم': ['القصيم', 'بريدة', 'عنيزة', 'qassim', 'buraidah'],
      'حائل': ['حائل', 'hail'],
      'جازان': ['جازان', 'jazan', 'gizan'],
      'نجران': ['نجران', 'najran'],
      'الباحة': ['الباحة', 'al-baha'],
      'عرعر': ['عرعر', 'arar'],
      'سكاكا': ['سكاكا', 'sakaka']
    };

    // العثور على مجموعة المدن لكل موقع
    let city1Group = null;
    let city2Group = null;
    
    for (const [mainCity, variations] of Object.entries(saudiCities)) {
      if (variations.some(variant => clean1.includes(variant))) {
        city1Group = mainCity;
      }
      if (variations.some(variant => clean2.includes(variant))) {
        city2Group = mainCity;
      }
    }

    // مطابقة نفس المدينة
    if (city1Group && city2Group && city1Group === city2Group) {
      console.log(`      ✅ نفس المدينة: ${city1Group}`);
      return 1.0;
    }

    // مدن قريبة جداً (منطقة واحدة)
    const nearCities = {
      'الرياض': ['الخرج'],
      'الدمام': ['الخبر', 'الظهران'],
      'الخبر': ['الدمام', 'الظهران'],
      'الظهران': ['الدمام', 'الخبر']
    };

    if (city1Group && city2Group) {
      if (nearCities[city1Group]?.includes(city2Group) || nearCities[city2Group]?.includes(city1Group)) {
        console.log(`      ✅ مدن قريبة: ${city1Group} - ${city2Group}`);
        return 0.9;
      }
    }

    // تطابق جزئي في النص
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      console.log(`      ✅ تطابق جزئي في النص`);
      return 0.6;
    }

    // مدن مختلفة لكن معروفة
    if (city1Group && city2Group) {
      console.log(`      ⚠️ مدن مختلفة: ${city1Group} vs ${city2Group}`);
      return 0.3;
    }

    console.log(`      ❌ لا يوجد تطابق في المدن`);
    return 0;
  }
  
  /**
   * قياس تشابه المواقع (النسخة القديمة)
   */
  locationSimilarity(loc1, loc2) {
    if (!loc1 || !loc2) return 0;

    const clean1 = loc1.toLowerCase().trim();
    const clean2 = loc2.toLowerCase().trim();

    console.log(`      🗺️ مقارنة المواقع: "${clean1}" vs "${clean2}"`);

    if (clean1 === clean2) {
      console.log(`      ✅ تطابق تام`);
      return 1.0;
    }
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      console.log(`      ✅ تطابق جزئي`);
      return 0.8;
    }

    // مدن سعودية
    const saudiCities = ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الخبر', 'أبها', 'تبوك', 'القصيم', 'حائل', 'جازان', 'نجران', 'الباحة', 'عرعر', 'سكاكا'];
    const city1 = saudiCities.find(city => clean1.includes(city));
    const city2 = saudiCities.find(city => clean2.includes(city));

    if (city1 && city2) {
      if (city1 === city2) {
        console.log(`      ✅ نفس المدينة: ${city1}`);
        return 0.9;
      } else {
        console.log(`      ⚠️ مدن مختلفة: ${city1} vs ${city2}`);
        return 0.3;
      }
    }
    
    // تجربة التطابق مع الكلمات المشتركة
    const words1 = clean1.split(/\s+/);
    const words2 = clean2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 2);
    
    if (commonWords.length > 0) {
      console.log(`      🔍 كلمات مشتركة: ${commonWords.join(', ')}`);
      return 0.4;
    }
    
    console.log(`      ⚠️ لا يوجد تطابق واضح - نعطي نقاط أساسية`);
    return 0.3;
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
