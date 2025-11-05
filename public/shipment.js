class ShipmentManager {
    constructor() {
        this.shipments = this.loadShipments();
        this.travelers = this.loadTravelers();
    }

    // نظام تصنيف الشحنات
    classifyShipment(weight, dimensions) {
        if (weight <= 20) return 'small';      // مسافر عادي
        if (weight <= 1500) return 'medium';   // صاحب سيارة
        if (weight <= 50000) return 'large';   // صاحب شاحنة
        return 'x-large';                      // أساطيل
    }

    // نظام تصنيف الموصلين
    classifyTraveler(capacity, vehicleType) {
        const types = {
            'taxi': 'small', 'bus': 'small', 'plane': 'small', 'train': 'small',
            'car': 'medium', 'suv': 'medium', 'pickup': 'medium',
            'truck': 'large', 'van': 'large', 'trailer': 'large',
            'fleet': 'x-large', 'airline': 'x-large', 'shipping': 'x-large'
        };
        return types[vehicleType] || 'medium';
    }

    // خوارزمية المطابقة الذكية
    findMatchingTravelers(shipment) {
        const shipmentType = this.classifyShipment(shipment.weight, shipment.dimensions);
        
        return this.travelers.filter(traveler => {
            const travelerType = this.classifyTraveler(traveler.capacity, traveler.vehicleType);
            
            // المطابقة حسب النوع
            const typeMatch = 
                (shipmentType === 'small' && travelerType === 'small') ||
                (shipmentType === 'medium' && travelerType === 'medium') ||
                (shipmentType === 'large' && travelerType === 'large') ||
                (shipmentType === 'x-large' && travelerType === 'x-large');

            // المطابقة حسب المسار
            const routeMatch = 
                traveler.fromCity === shipment.fromCity &&
                traveler.toCity === shipment.toCity;

            // المطابقة حسب التوقيت
            const timeMatch = 
                new Date(traveler.departureTime) >= new Date(shipment.preferredDate);

            return typeMatch && routeMatch && timeMatch;
        });
    }

    // إنشاء شحنة جديدة مع الربط التلقائي
    createShipment(shipmentData) {
        const shipment = {
            id: Date.now().toString(),
            ...shipmentData,
            type: this.classifyShipment(shipmentData.weight, shipmentData.dimensions),
            status: 'pending',
            createdAt: new Date().toISOString(),
            trackingNumber: 'SH' + Date.now().toString().slice(-6)
        };

        // البحث عن موصلين متطابقين
        const matchingTravelers = this.findMatchingTravelers(shipment);
        shipment.matchingTravelers = matchingTravelers;

        this.shipments.push(shipment);
        this.saveShipments();
        
        return {
            shipment,
            matchingTravelers,
            message: `تم العثور على ${matchingTravelers.length} موصل متطابق`
        };
    }

    // إنشاء رحلة موصل جديدة
    createTraveler(travelerData) {
        const traveler = {
            id: Date.now().toString(),
            ...travelerData,
            type: this.classifyTraveler(travelerData.capacity, travelerData.vehicleType),
            status: 'available',
            createdAt: new Date().toISOString()
        };

        // البحث عن شحنات متطابقة
        const matchingShipments = this.findMatchingShipments(traveler);
        traveler.matchingShipments = matchingShipments;

        this.travelers.push(traveler);
        this.saveTravelers();
        
        return {
            traveler,
            matchingShipments,
            message: `تم العثور على ${matchingShipments.length} شحنة متطابقة`
        };
    }

    loadShipments() {
        return JSON.parse(localStorage.getItem('fastship_shipments') || '[]');
    }

    saveShipments() {
        localStorage.setItem('fastship_shipments', JSON.stringify(this.shipments));
    }

    loadTravelers() {
        return JSON.parse(localStorage.getItem('fastship_travelers') || '[]');
    }

    saveTravelers() {
        localStorage.setItem('fastship_travelers', JSON.stringify(this.travelers));
    }
}

// جعل النظام متاحاً globally
window.shipmentManager = new ShipmentManager();