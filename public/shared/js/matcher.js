// خوارزمية المطابقة بين الشحنات والرحلات
// FastShip Matching Algorithm

class FastShipMatcher {
  constructor() {
    this.supabase = window.supabaseClient;
  }

  /**
   * البحث عن رحلات متاحة تطابق شحنة معينة
   * @param {Object} shipment - بيانات الشحنة
   * @returns {Array} قائمة الرحلات المتطابقة مع نقاط المطابقة
   */
  async findMatchingTrips(shipment) {
    try {
      // البحث عن رحلات نشطة
      const { data: trips, error } = await this.supabase
        .from('trips')
        .select(`
          *,
          carriers (
            id,
            user_id,
            vehicle_type,
            rating
          )
        `)
        .eq('status', 'active')
        .gte('travel_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      const matches = [];

      for (const trip of trips) {
        const matchScore = this.calculateMatchScore(shipment, trip);
        if (matchScore > 0) {
          matches.push({
            trip: trip,
            score: matchScore,
            reasons: this.getMatchReasons(shipment, trip)
          });
        }
      }

      // ترتيب النتائج حسب نقاط المطابقة
      return matches.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('خطأ في البحث عن الرحلات المتطابقة:', error);
      return [];
    }
  }

  /**
   * حساب نقاط المطابقة بين شحنة ورحلة
   * @param {Object} shipment - بيانات الشحنة
   * @param {Object} trip - بيانات الرحلة
   * @returns {number} نقاط المطابقة (0-100)
   */
  calculateMatchScore(shipment, trip) {
    let score = 0;

    // 1. مطابقة الموقع (40 نقطة كحد أقصى)
    const locationScore = this.calculateLocationScore(shipment, trip);
    score += locationScore * 40;

    // 2. مطابقة الوزن والسعة (30 نقطة كحد أقصى)
    const capacityScore = this.calculateCapacityScore(shipment, trip);
    score += capacityScore * 30;

    // 3. مطابقة التاريخ (20 نقطة كحد أقصى)
    const dateScore = this.calculateDateScore(shipment, trip);
    score += dateScore * 20;

    // 4. مطابقة نوع المركبة (10 نقاط كحد أقصى)
    const vehicleScore = this.calculateVehicleScore(shipment, trip);
    score += vehicleScore * 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * حساب مطابقة الموقع
   */
  calculateLocationScore(shipment, trip) {
    const pickupMatch = this.locationSimilarity(shipment.pickup_location, trip.origin);
    const deliveryMatch = this.locationSimilarity(shipment.delivery_location, trip.destination);

    // متوسط المطابقة للموقعين
    return (pickupMatch + deliveryMatch) / 2;
  }

  /**
   * حساب مطابقة السعة والوزن
   */
  calculateCapacityScore(shipment, trip) {
    const shipmentWeight = parseFloat(shipment.weight) || 0;
    const availableCapacity = parseFloat(trip.capacity) || 0;

    if (availableCapacity === 0) return 0;

    const utilization = shipmentWeight / availableCapacity;

    // أفضل مطابقة عندما تكون الشحنة 70-90% من السعة
    if (utilization >= 0.7 && utilization <= 0.9) return 1.0;
    if (utilization >= 0.5 && utilization <= 1.0) return 0.8;
    if (utilization >= 0.3 && utilization <= 1.2) return 0.6;
    if (utilization > 1.2) return 0; // الشحنة أكبر من السعة

    return 0.4; // شحنة صغيرة جداً
  }

  /**
   * حساب مطابقة التاريخ
   */
  calculateDateScore(shipment, trip) {
    const shipmentDate = new Date(shipment.preferred_date);
    const tripDate = new Date(trip.travel_date);

    const diffDays = Math.abs((shipmentDate - tripDate) / (1000 * 60 * 60 * 24));

    // مطابقة مثالية في نفس اليوم
    if (diffDays === 0) return 1.0;
    if (diffDays <= 1) return 0.9;
    if (diffDays <= 3) return 0.7;
    if (diffDays <= 7) return 0.5;
    if (diffDays <= 14) return 0.3;

    return 0; // فارق زمني كبير جداً
  }

  /**
   * حساب مطابقة نوع المركبة مع دعم فئات الناقلين المختلفة
   */
  calculateVehicleScore(shipment, trip) {
    const shipmentType = shipment.vehicle_type_preferred || 'any';
    const vehicleType = trip.vehicle_type || 'any';

    if (shipmentType === 'any' || vehicleType === 'any') return 1.0;
    if (shipmentType === vehicleType) return 1.0;

    // تصنيفات الناقلين وقدراتهم
    const carrierCategories = {
      // المسافرون الأفراد
      'individual': {
        capacity: 20, // كيلو
        types: ['suitcase', 'personal'],
        score: 0.9
      },
      
      // أصحاب السيارات الشخصية
      'car': {
        capacity: 50,
        types: ['car', 'sedan', 'suv'],
        score: 0.8
      },
      
      // سائقو البيك أب
      'pickup': {
        capacity: 200,
        types: ['pickup', 'small_truck'],
        score: 0.9
      },
      
      // سائقو الشاحنات الصغيرة
      'van': {
        capacity: 500,
        types: ['van', 'delivery_truck'],
        score: 0.9
      },
      
      // سائقو الشاحنات الكبيرة
      'truck': {
        capacity: 2000,
        types: ['truck', 'heavy_truck', 'trailer'],
        score: 1.0
      },
      
      // شركات النقل والأساطيل
      'fleet': {
        capacity: 5000,
        types: ['fleet', 'multiple', 'any'],
        score: 1.0
      }
    };

    // مطابقة جزئية حسب الفئات
    const shipmentWeight = parseFloat(shipment.weight) || 0;
    
    for (const [category, config] of Object.entries(carrierCategories)) {
      if (config.types.includes(vehicleType)) {
        // تحقق من قدرة الحمولة
        if (shipmentWeight <= config.capacity) {
          // مطابقة بناءً على نوع الشحنة والمركبة
          if (config.types.includes(shipmentType)) {
            return config.score;
          }
          // مطابقة جزئية إذا كانت المركبة قادرة على النقل
          return config.score * 0.7;
        }
      }
    }

    // مطابقة تقليدية للأنواع المتشابهة
    const similarTypes = {
      'pickup': ['van', 'truck', 'small_truck'],
      'van': ['pickup', 'truck', 'delivery_truck'],
      'truck': ['van', 'pickup', 'heavy_truck'],
      'car': ['suv', 'sedan'],
      'individual': ['personal', 'suitcase']
    };

    if (similarTypes[shipmentType]?.includes(vehicleType)) return 0.6;

    return 0.3; // مطابقة ضعيفة
  }

  /**
   * قياس تشابه الموقع (بسيط - يمكن تحسينه باستخدام Google Maps API)
   */
  locationSimilarity(loc1, loc2) {
    if (!loc1 || !loc2) return 0;

    // تحويل إلى lowercase وإزالة المسافات
    const clean1 = loc1.toLowerCase().trim();
    const clean2 = loc2.toLowerCase().trim();

    // مطابقة تامة
    if (clean1 === clean2) return 1.0;

    // مطابقة جزئية (إذا كان أحدهما يحتوي على الآخر)
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;

    // مطابقة بالكلمات المفتاحية (المدن الرئيسية في السعودية)
    const cities = ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الخبر', 'أبها', 'تبوك', 'حائل', 'القصيم'];
    const city1 = cities.find(city => clean1.includes(city));
    const city2 = cities.find(city => clean2.includes(city));

    if (city1 && city2 && city1 === city2) return 0.9;

    // مطابقة ضعيفة للمناطق الجغرافية العامة
    const regions = {
      'وسط': ['الرياض', 'القصيم', 'حائل'],
      'غرب': ['مكة', 'جدة', 'المدينة'],
      'شرق': ['الدمام', 'الخبر', 'الأحساء'],
      'جنوب': ['أبها', 'جازان', 'نجران'],
      'شمال': ['تبوك', 'الجوف', 'حائل']
    };

    for (const [region, regionCities] of Object.entries(regions)) {
      if (regionCities.some(city => clean1.includes(city)) &&
          regionCities.some(city => clean2.includes(city))) {
        return 0.6;
      }
    }

    return 0.2; // لا مطابقة
  }

  /**
   * الحصول على أسباب المطابقة للعرض للمستخدم
   */
  getMatchReasons(shipment, trip) {
    const reasons = [];

    // أسباب الموقع
    const pickupMatch = this.locationSimilarity(shipment.pickup_location, trip.origin);
    const deliveryMatch = this.locationSimilarity(shipment.delivery_location, trip.destination);

    if (pickupMatch >= 0.8) reasons.push('موقع الاستلام متطابق');
    if (deliveryMatch >= 0.8) reasons.push('موقع التسليم متطابق');

    // أسباب السعة
    const shipmentWeight = parseFloat(shipment.weight) || 0;
    const availableCapacity = parseFloat(trip.capacity) || 0;
    const utilization = shipmentWeight / availableCapacity;

    if (utilization >= 0.7 && utilization <= 0.9) {
      reasons.push('السعة مناسبة تماماً');
    } else if (utilization >= 0.5 && utilization <= 1.0) {
      reasons.push('السعة مناسبة');
    }

    // أسباب التاريخ
    const shipmentDate = new Date(shipment.preferred_date);
    const tripDate = new Date(trip.travel_date);
    const diffDays = Math.abs((shipmentDate - tripDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) reasons.push('التاريخ متطابق تماماً');
    else if (diffDays <= 3) reasons.push(`فارق ${diffDays} أيام فقط`);

    // أسباب نوع المركبة
    const shipmentType = shipment.vehicle_type_preferred || 'any';
    const vehicleType = trip.vehicle_type || 'any';

    if (shipmentType !== 'any' && vehicleType !== 'any' && shipmentType === vehicleType) {
      reasons.push('نوع المركبة متطابق');
    }

    return reasons;
  }

  /**
   * إنشاء تقرير مطابقة شامل
   */
  async generateMatchingReport(shipmentId) {
    try {
      // جلب بيانات الشحنة
      const { data: shipment, error: shipmentError } = await this.supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (shipmentError) throw shipmentError;

      // البحث عن المطابقات
      const matches = await this.findMatchingTrips(shipment);

      // تحليل النتائج
      const report = {
        shipment: shipment,
        totalMatches: matches.length,
        bestMatch: matches[0] || null,
        averageScore: matches.length > 0 
          ? matches.reduce((sum, match) => sum + match.score, 0) / matches.length 
          : 0,
        categoriesFound: {},
        locationCoverage: {},
        recommendations: []
      };

      // تحليل الفئات المتاحة
      matches.forEach(match => {
        const category = this.getCarrierCategory(match.trip.vehicle_type, match.trip.capacity);
        if (!report.categoriesFound[category.category]) {
          report.categoriesFound[category.category] = {
            count: 0,
            bestScore: 0,
            category: category
          };
        }
        report.categoriesFound[category.category].count++;
        report.categoriesFound[category.category].bestScore = Math.max(
          report.categoriesFound[category.category].bestScore,
          match.score
        );
      });

      // تحليل التغطية الجغرافية
      matches.forEach(match => {
        const origin = match.trip.origin;
        if (!report.locationCoverage[origin]) {
          report.locationCoverage[origin] = { count: 0, avgScore: 0 };
        }
        report.locationCoverage[origin].count++;
      });

      // إنشاء توصيات
      report.recommendations = this.generateRecommendations(shipment, matches, report);

      return report;

    } catch (error) {
      console.error('خطأ في إنشاء تقرير المطابقة:', error);
      return null;
    }
  }

  /**
   * إنشاء توصيات ذكية للشاحن
   */
  generateRecommendations(shipment, matches, report) {
    const recommendations = [];

    // توصيات بناءً على النتائج
    if (matches.length === 0) {
      recommendations.push({
        type: 'no_matches',
        title: 'لا توجد مطابقات حالياً',
        message: 'جرب تعديل التاريخ المفضل أو نوع المركبة لزيادة الخيارات',
        action: 'modify_preferences'
      });
    } else if (matches.length < 3) {
      recommendations.push({
        type: 'few_matches',
        title: 'خيارات محدودة',
        message: 'يمكنك توسيع نطاق البحث للحصول على خيارات أكثر',
        action: 'expand_search'
      });
    }

    // توصيات السعر
    const avgPrice = matches.reduce((sum, match) => sum + (match.trip.price_per_kg || 0), 0) / matches.length;
    if (avgPrice > 50) {
      recommendations.push({
        type: 'price',
        title: 'أسعار مرتفعة',
        message: 'جرب تأجيل الشحنة لأيام أخرى للحصول على أسعار أفضل',
        action: 'adjust_timing'
      });
    }

    // توصيات بناءً على الفئات
    const categories = Object.keys(report.categoriesFound);
    if (categories.includes('individual') && parseFloat(shipment.weight) <= 5) {
      recommendations.push({
        type: 'category',
        title: 'خيار اقتصادي',
        message: 'يمكن للمسافرين الأفراد نقل شحنتك بتكلفة أقل',
        action: 'consider_individuals'
      });
    }

    if (categories.includes('fleet') && parseFloat(shipment.weight) >= 100) {
      recommendations.push({
        type: 'category',
        title: 'خدمة احترافية',
        message: 'شركات النقل متاحة لضمان خدمة احترافية لشحنتك الكبيرة',
        action: 'consider_fleet'
      });
    }

    return recommendations;
  }

  /**
   * تحديد فئة الناقل بناءً على نوع المركبة والسعة
   */
  getCarrierCategory(vehicleType, capacity) {
    const numCapacity = parseFloat(capacity) || 0;
    
    // تحديد الفئة بناءً على السعة ونوع المركبة
    if (vehicleType === 'individual' || vehicleType === 'personal' || numCapacity <= 20) {
      return {
        category: 'individual',
        name: 'مسافر فردي',
        icon: 'fas fa-user',
        color: 'blue',
        description: 'مسافرون يحملون الأشياء الصغيرة في حقائبهم'
      };
    }
    
    if (vehicleType === 'car' || vehicleType === 'sedan' || vehicleType === 'suv' || 
        (numCapacity > 20 && numCapacity <= 50)) {
      return {
        category: 'car',
        name: 'سيارة شخصية',
        icon: 'fas fa-car',
        color: 'green',
        description: 'أصحاب السيارات الشخصية'
      };
    }
    
    if (vehicleType === 'pickup' || vehicleType === 'small_truck' || 
        (numCapacity > 50 && numCapacity <= 200)) {
      return {
        category: 'pickup',
        name: 'بيك أب',
        icon: 'fas fa-truck-pickup',
        color: 'orange',
        description: 'سائقو البيك أب والشاحنات الصغيرة'
      };
    }
    
    if (vehicleType === 'van' || vehicleType === 'delivery_truck' || 
        (numCapacity > 200 && numCapacity <= 500)) {
      return {
        category: 'van',
        name: 'شاحنة صغيرة',
        icon: 'fas fa-shipping-fast',
        color: 'purple',
        description: 'شاحنات التوصيل والفانات'
      };
    }
    
    if (vehicleType === 'truck' || vehicleType === 'heavy_truck' || vehicleType === 'trailer' || 
        (numCapacity > 500 && numCapacity <= 2000)) {
      return {
        category: 'truck',
        name: 'شاحنة كبيرة',
        icon: 'fas fa-truck',
        color: 'red',
        description: 'شاحنات النقل الثقيل'
      };
    }
    
    if (vehicleType === 'fleet' || vehicleType === 'multiple' || numCapacity > 2000) {
      return {
        category: 'fleet',
        name: 'أسطول نقل',
        icon: 'fas fa-industry',
        color: 'indigo',
        description: 'شركات النقل والأساطيل'
      };
    }
    
    // افتراضي
    return {
      category: 'general',
      name: 'ناقل عام',
      icon: 'fas fa-route',
      color: 'gray',
      description: 'ناقل متعدد الأغراض'
    };
  }

  /**
   * البحث عن ناقلين حسب الفئة والموقع
   */
  async findCarriersByCategory(category, location, maxResults = 10) {
    try {
      let query = this.supabase
        .from('trips')
        .select(`
          *,
          carriers (
            id,
            user_id,
            vehicle_type,
            rating,
            total_trips
          )
        `)
        .eq('status', 'active')
        .gte('travel_date', new Date().toISOString().split('T')[0])
        .limit(maxResults);

      // تصفية حسب الفئة
      if (category !== 'any') {
        const categoryTypes = this.getCategoryVehicleTypes(category);
        query = query.in('vehicle_type', categoryTypes);
      }

      // تصفية حسب الموقع إذا تم تحديده
      if (location && location !== 'any') {
        query = query.or(`origin.ilike.%${location}%,destination.ilike.%${location}%`);
      }

      const { data: trips, error } = await query;
      
      if (error) throw error;

      // إضافة معلومات الفئة لكل رحلة
      return trips.map(trip => ({
        ...trip,
        carrierCategory: this.getCarrierCategory(trip.vehicle_type, trip.capacity)
      }));

    } catch (error) {
      console.error('خطأ في البحث عن الناقلين:', error);
      return [];
    }
  }

  /**
   * الحصول على أنواع المركبات لفئة معينة
   */
  getCategoryVehicleTypes(category) {
    const categoryTypes = {
      'individual': ['individual', 'personal', 'suitcase'],
      'car': ['car', 'sedan', 'suv'],
      'pickup': ['pickup', 'small_truck'],
      'van': ['van', 'delivery_truck'],
      'truck': ['truck', 'heavy_truck', 'trailer'],
      'fleet': ['fleet', 'multiple', 'any']
    };
    
    return categoryTypes[category] || ['any'];
  }

  /**
   * إرسال طلب تواصل لناقل
   */
  async sendContactRequest(shipmentId, tripId, message) {
    try {
      // Get current user (shipper)
      const user = window.sessionManager.getCurrentUser();
      if (!user) {
        throw new Error('User not logged in');
      }

      // Get shipper ID
      const { data: shipper, error: shipperError } = await this.supabase
        .from('shippers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (shipperError) throw shipperError;

      // Get trip details to get carrier ID
      const { data: trip, error: tripError } = await this.supabase
        .from('trips')
        .select('carrier_id')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;

      const { data, error } = await this.supabase
        .from('contact_requests')
        .insert({
          shipper_id: shipper.id,
          carrier_id: trip.carrier_id,
          shipment_id: shipmentId,
          trip_id: tripId,
          message: message,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('خطأ في إرسال طلب التواصل:', error);
      return { success: false, error: error.message };
    }
  }
}

// إنشاء instance عام
window.fastShipMatcher = new FastShipMatcher();