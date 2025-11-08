# Task Templates for All Business Types

This document contains task workflow templates (node blocks) for all business types in the universal commerce system.

## 📋 How Task Templates Work

Each business type has a predefined task workflow template that gets instantiated when an order is created. Tasks can be:
- **Automatic:** System executes automatically
- **Manual:** Requires human action
- **Conditional:** Depends on order parameters
- **Parallel:** Multiple tasks execute simultaneously
- **Sequential:** Must wait for dependencies

---

## 🛍️ COMMERCE & RETAIL

### 1. Grocery Store / Supermarket

```json
{
  "businessType": "grocery_store",
  "workflow": "standard_retail_order",
  "tasks": [
    {
      "id": "receive_order",
      "name": "Receive Order",
      "type": "automatic",
      "assignTo": "store_node",
      "duration": 1,
      "actions": ["validate_items", "check_availability", "reserve_inventory"]
    },
    {
      "id": "pick_items",
      "name": "Pick Items from Shelves",
      "type": "manual",
      "assignTo": "store_staff",
      "dependencies": ["receive_order"],
      "duration": 15,
      "checklist": [
        "Scan barcode for each item",
        "Check expiry dates",
        "Handle fragile items carefully",
        "Place in shopping bag"
      ]
    },
    {
      "id": "quality_check",
      "name": "Quality Check",
      "type": "manual",
      "assignTo": "quality_checker",
      "dependencies": ["pick_items"],
      "duration": 5,
      "checklist": [
        "Verify all items picked",
        "Check product quality",
        "Ensure proper packaging"
      ]
    },
    {
      "id": "billing",
      "name": "Generate Bill",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["quality_check"],
      "duration": 1,
      "actions": ["calculate_total", "apply_discounts", "generate_invoice"]
    },
    {
      "id": "handover",
      "name": "Handover to Delivery/Customer",
      "type": "manual",
      "assignTo": "store_staff",
      "dependencies": ["billing"],
      "duration": 5,
      "verification": {
        "type": "photo",
        "required": true
      }
    }
  ]
}
```

### 2. Clothing & Fashion Store

```json
{
  "businessType": "clothing_store",
  "workflow": "retail_with_trial",
  "tasks": [
    {
      "id": "receive_order",
      "name": "Receive Order",
      "type": "automatic",
      "assignTo": "store_node",
      "duration": 1
    },
    {
      "id": "locate_items",
      "name": "Locate Items in Store",
      "type": "manual",
      "assignTo": "store_staff",
      "dependencies": ["receive_order"],
      "duration": 10,
      "checklist": [
        "Find size and color",
        "Check inventory",
        "Prepare trial room if needed"
      ]
    },
    {
      "id": "customer_trial",
      "name": "Customer Trial (Optional)",
      "type": "conditional",
      "assignTo": "store_staff",
      "dependencies": ["locate_items"],
      "duration": 15,
      "condition": "customer_present && wants_trial"
    },
    {
      "id": "alterations",
      "name": "Alterations (If Required)",
      "type": "conditional",
      "assignTo": "tailor_node",
      "dependencies": ["customer_trial"],
      "duration": 120,
      "condition": "requires_alterations"
    },
    {
      "id": "billing_packaging",
      "name": "Billing & Packaging",
      "type": "manual",
      "assignTo": "cashier",
      "dependencies": ["locate_items"],
      "duration": 10
    },
    {
      "id": "handover",
      "name": "Handover to Customer",
      "type": "manual",
      "assignTo": "store_staff",
      "dependencies": ["billing_packaging"],
      "duration": 5
    }
  ]
}
```

### 3. Electronics Shop

```json
{
  "businessType": "electronics_shop",
  "workflow": "retail_with_demo",
  "tasks": [
    {
      "id": "receive_order",
      "name": "Receive Order",
      "type": "automatic",
      "assignTo": "store_node",
      "duration": 1
    },
    {
      "id": "product_demo",
      "name": "Product Demo (Optional)",
      "type": "conditional",
      "assignTo": "sales_staff",
      "dependencies": ["receive_order"],
      "duration": 20,
      "condition": "customer_wants_demo"
    },
    {
      "id": "prepare_product",
      "name": "Prepare Product",
      "type": "manual",
      "assignTo": "store_staff",
      "dependencies": ["receive_order"],
      "duration": 10,
      "checklist": [
        "Check serial number",
        "Verify warranty card",
        "Test product functionality",
        "Pack all accessories"
      ]
    },
    {
      "id": "register_warranty",
      "name": "Register Warranty",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["prepare_product"],
      "duration": 5
    },
    {
      "id": "billing",
      "name": "Generate Invoice",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["register_warranty"],
      "duration": 2
    },
    {
      "id": "handover",
      "name": "Handover with Instructions",
      "type": "manual",
      "assignTo": "sales_staff",
      "dependencies": ["billing"],
      "duration": 10,
      "checklist": [
        "Explain usage",
        "Share warranty details",
        "Provide contact for support"
      ]
    }
  ]
}
```

### 4. Second-Hand Seller

```json
{
  "businessType": "second_hand_seller",
  "workflow": "used_goods_sale",
  "tasks": [
    {
      "id": "receive_order",
      "name": "Receive Order",
      "type": "automatic",
      "assignTo": "seller_node",
      "duration": 1
    },
    {
      "id": "verify_condition",
      "name": "Verify Product Condition",
      "type": "manual",
      "assignTo": "seller",
      "dependencies": ["receive_order"],
      "duration": 15,
      "checklist": [
        "Check physical condition",
        "Test functionality",
        "Document any defects",
        "Take photos"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "clean_sanitize",
      "name": "Clean & Sanitize",
      "type": "manual",
      "assignTo": "seller",
      "dependencies": ["verify_condition"],
      "duration": 30
    },
    {
      "id": "packaging",
      "name": "Secure Packaging",
      "type": "manual",
      "assignTo": "seller",
      "dependencies": ["clean_sanitize"],
      "duration": 15
    },
    {
      "id": "handover",
      "name": "Handover to Customer",
      "type": "manual",
      "assignTo": "seller",
      "dependencies": ["packaging"],
      "duration": 5,
      "verification": {
        "type": "signature",
        "required": true
      }
    }
  ]
}
```

---

## 🚖 TRANSPORTATION & TRAVEL

### 5. Taxi Driver

```json
{
  "businessType": "taxi_service",
  "workflow": "ride_hailing",
  "tasks": [
    {
      "id": "request_received",
      "name": "Ride Request Received",
      "type": "automatic",
      "assignTo": "system",
      "duration": 1,
      "actions": ["calculate_fare", "find_nearest_driver"]
    },
    {
      "id": "accept_ride",
      "name": "Accept Ride",
      "type": "manual",
      "assignTo": "driver",
      "dependencies": ["request_received"],
      "duration": 1,
      "timeout": 30,
      "actions": ["notify_customer", "share_driver_details"]
    },
    {
      "id": "navigate_to_pickup",
      "name": "Navigate to Pickup Location",
      "type": "manual",
      "assignTo": "driver",
      "dependencies": ["accept_ride"],
      "duration": 10,
      "location": {
        "tracking": true,
        "target": "pickup_location"
      },
      "actions": ["share_live_location", "update_eta"]
    },
    {
      "id": "pickup_customer",
      "name": "Pick Up Customer",
      "type": "manual",
      "assignTo": "driver",
      "dependencies": ["navigate_to_pickup"],
      "duration": 2,
      "verification": {
        "type": "code",
        "method": "otp",
        "required": true
      },
      "actions": ["start_ride", "start_meter"]
    },
    {
      "id": "navigate_to_destination",
      "name": "Navigate to Destination",
      "type": "manual",
      "assignTo": "driver",
      "dependencies": ["pickup_customer"],
      "duration": 30,
      "location": {
        "tracking": true,
        "target": "drop_location",
        "recordRoute": true
      },
      "actions": ["share_live_location", "update_eta"]
    },
    {
      "id": "drop_customer",
      "name": "Drop Customer",
      "type": "manual",
      "assignTo": "driver",
      "dependencies": ["navigate_to_destination"],
      "duration": 2,
      "verification": {
        "type": "code",
        "method": "otp",
        "required": true
      },
      "actions": ["end_ride", "calculate_final_fare"]
    },
    {
      "id": "collect_payment",
      "name": "Collect Payment",
      "type": "manual",
      "assignTo": "driver",
      "dependencies": ["drop_customer"],
      "duration": 2,
      "actions": ["process_payment", "generate_receipt"]
    },
    {
      "id": "request_feedback",
      "name": "Request Feedback",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["collect_payment"],
      "duration": 1,
      "actions": ["send_rating_prompt"]
    }
  ]
}
```

### 6. Car Rental Provider

```json
{
  "businessType": "car_rental",
  "workflow": "vehicle_rental",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Booking",
      "type": "automatic",
      "assignTo": "rental_company",
      "duration": 1,
      "actions": ["verify_license", "block_vehicle", "calculate_charges"]
    },
    {
      "id": "prepare_vehicle",
      "name": "Prepare Vehicle",
      "type": "manual",
      "assignTo": "rental_staff",
      "dependencies": ["confirm_booking"],
      "duration": 30,
      "checklist": [
        "Clean vehicle interior/exterior",
        "Check fuel level",
        "Inspect for damages",
        "Verify insurance papers",
        "Check tire pressure",
        "Test all features"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "document_verification",
      "name": "Verify Customer Documents",
      "type": "manual",
      "assignTo": "rental_staff",
      "dependencies": ["prepare_vehicle"],
      "duration": 10,
      "checklist": [
        "Check driving license",
        "Verify ID proof",
        "Confirm address proof",
        "Collect security deposit"
      ]
    },
    {
      "id": "vehicle_inspection_handover",
      "name": "Vehicle Inspection & Handover",
      "type": "manual",
      "assignTo": "rental_staff",
      "dependencies": ["document_verification"],
      "duration": 15,
      "checklist": [
        "Walk around vehicle with customer",
        "Document existing damages",
        "Note odometer reading",
        "Hand over keys and documents",
        "Explain vehicle features"
      ],
      "verification": {
        "type": "signature",
        "required": true
      }
    },
    {
      "id": "rental_period",
      "name": "Rental Period",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["vehicle_inspection_handover"],
      "duration": "variable",
      "actions": ["track_duration", "send_reminders", "monitor_return_date"]
    },
    {
      "id": "return_inspection",
      "name": "Return Inspection",
      "type": "manual",
      "assignTo": "rental_staff",
      "dependencies": ["rental_period"],
      "duration": 20,
      "checklist": [
        "Inspect for new damages",
        "Check odometer reading",
        "Verify fuel level",
        "Check for cleanliness",
        "Collect keys and documents"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "calculate_final_charges",
      "name": "Calculate Final Charges",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["return_inspection"],
      "duration": 2,
      "actions": [
        "calculate_rental_days",
        "add_extra_km_charges",
        "add_damage_charges",
        "deduct_deposit"
      ]
    },
    {
      "id": "settle_payment",
      "name": "Settle Final Payment",
      "type": "manual",
      "assignTo": "rental_staff",
      "dependencies": ["calculate_final_charges"],
      "duration": 5,
      "actions": ["process_payment", "refund_deposit"]
    }
  ]
}
```

### 7. Courier / Logistics Agent

```json
{
  "businessType": "courier_service",
  "workflow": "package_delivery",
  "tasks": [
    {
      "id": "receive_shipment_request",
      "name": "Receive Shipment Request",
      "type": "automatic",
      "assignTo": "system",
      "duration": 1,
      "actions": ["calculate_shipping_cost", "generate_tracking_id"]
    },
    {
      "id": "pickup_package",
      "name": "Pick Up Package from Sender",
      "type": "manual",
      "assignTo": "pickup_agent",
      "dependencies": ["receive_shipment_request"],
      "duration": 30,
      "location": {
        "tracking": true,
        "target": "pickup_location"
      },
      "checklist": [
        "Verify sender details",
        "Inspect package condition",
        "Weigh and measure package",
        "Take photos",
        "Get sender signature"
      ],
      "verification": {
        "type": "signature",
        "required": true
      }
    },
    {
      "id": "process_at_hub",
      "name": "Process at Hub",
      "type": "manual",
      "assignTo": "hub_staff",
      "dependencies": ["pickup_package"],
      "duration": 60,
      "checklist": [
        "Scan package",
        "Sort by destination",
        "Load onto vehicle"
      ]
    },
    {
      "id": "in_transit",
      "name": "In Transit to Destination",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["process_at_hub"],
      "duration": "variable",
      "actions": ["track_location", "update_status", "notify_recipient"]
    },
    {
      "id": "out_for_delivery",
      "name": "Out for Delivery",
      "type": "manual",
      "assignTo": "delivery_agent",
      "dependencies": ["in_transit"],
      "duration": 120,
      "location": {
        "tracking": true,
        "target": "delivery_location"
      },
      "actions": ["share_live_location", "call_recipient"]
    },
    {
      "id": "deliver_package",
      "name": "Deliver Package",
      "type": "manual",
      "assignTo": "delivery_agent",
      "dependencies": ["out_for_delivery"],
      "duration": 5,
      "verification": {
        "type": "signature",
        "required": true
      },
      "actions": ["take_delivery_proof", "mark_delivered"]
    },
    {
      "id": "collect_payment",
      "name": "Collect Payment (COD)",
      "type": "conditional",
      "assignTo": "delivery_agent",
      "dependencies": ["deliver_package"],
      "duration": 2,
      "condition": "payment_method == 'cod'"
    }
  ]
}
```

---

## 🍽️ FOOD & BEVERAGES

### 8. Restaurant

```json
{
  "businessType": "restaurant",
  "workflow": "food_preparation_delivery",
  "tasks": [
    {
      "id": "receive_order",
      "name": "Receive Order",
      "type": "automatic",
      "assignTo": "restaurant",
      "duration": 1,
      "actions": ["validate_order", "check_availability", "estimate_time"]
    },
    {
      "id": "accept_order",
      "name": "Accept Order",
      "type": "manual",
      "assignTo": "restaurant_manager",
      "dependencies": ["receive_order"],
      "duration": 2,
      "timeout": 60,
      "actions": ["confirm_to_customer", "notify_kitchen"]
    },
    {
      "id": "prepare_ingredients",
      "name": "Prepare Ingredients",
      "type": "manual",
      "assignTo": "kitchen_staff",
      "dependencies": ["accept_order"],
      "duration": 10,
      "checklist": [
        "Gather ingredients",
        "Prep vegetables",
        "Marinate if required"
      ]
    },
    {
      "id": "cook_food",
      "name": "Cook Food",
      "type": "manual",
      "assignTo": "chef",
      "dependencies": ["prepare_ingredients"],
      "duration": 25,
      "checklist": [
        "Follow recipe",
        "Check temperature",
        "Taste test",
        "Plate presentation"
      ]
    },
    {
      "id": "quality_check",
      "name": "Quality Check",
      "type": "manual",
      "assignTo": "head_chef",
      "dependencies": ["cook_food"],
      "duration": 3,
      "checklist": [
        "Verify taste",
        "Check temperature",
        "Inspect presentation",
        "Verify order items"
      ]
    },
    {
      "id": "packaging",
      "name": "Package Food",
      "type": "manual",
      "assignTo": "packing_staff",
      "dependencies": ["quality_check"],
      "duration": 5,
      "checklist": [
        "Use appropriate containers",
        "Seal properly",
        "Add cutlery/napkins",
        "Attach order label",
        "Add invoice"
      ]
    },
    {
      "id": "assign_delivery",
      "name": "Assign Delivery Partner",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["packaging"],
      "duration": 2,
      "actions": ["find_available_driver", "notify_driver"]
    },
    {
      "id": "pickup_by_driver",
      "name": "Pickup by Delivery Partner",
      "type": "manual",
      "assignTo": "delivery_partner",
      "dependencies": ["assign_delivery"],
      "duration": 10,
      "location": {
        "tracking": true,
        "target": "restaurant_location"
      },
      "verification": {
        "type": "code",
        "required": true
      }
    },
    {
      "id": "deliver_to_customer",
      "name": "Deliver to Customer",
      "type": "manual",
      "assignTo": "delivery_partner",
      "dependencies": ["pickup_by_driver"],
      "duration": 30,
      "location": {
        "tracking": true,
        "target": "customer_location"
      },
      "verification": {
        "type": "code",
        "required": true
      }
    },
    {
      "id": "collect_payment",
      "name": "Collect Payment (if COD)",
      "type": "conditional",
      "assignTo": "delivery_partner",
      "dependencies": ["deliver_to_customer"],
      "duration": 2,
      "condition": "payment_method == 'cod'"
    }
  ]
}
```

### 9. Cloud Kitchen

```json
{
  "businessType": "cloud_kitchen",
  "workflow": "delivery_only_food",
  "tasks": [
    {
      "id": "receive_order",
      "name": "Receive Order",
      "type": "automatic",
      "assignTo": "cloud_kitchen",
      "duration": 1
    },
    {
      "id": "auto_accept",
      "name": "Auto Accept Order",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["receive_order"],
      "duration": 1,
      "actions": ["notify_kitchen_display", "start_timer"]
    },
    {
      "id": "parallel_prep_cook",
      "name": "Prepare & Cook (Parallel)",
      "type": "manual",
      "assignTo": "kitchen_team",
      "dependencies": ["auto_accept"],
      "duration": 20,
      "parallel": true,
      "checklist": [
        "Station 1: Starters",
        "Station 2: Main course",
        "Station 3: Drinks/Sides"
      ]
    },
    {
      "id": "assembly_packaging",
      "name": "Assembly & Packaging",
      "type": "manual",
      "assignTo": "packing_staff",
      "dependencies": ["parallel_prep_cook"],
      "duration": 5
    },
    {
      "id": "auto_assign_delivery",
      "name": "Auto Assign Delivery",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["assembly_packaging"],
      "duration": 1
    },
    {
      "id": "pickup_deliver",
      "name": "Pickup & Deliver",
      "type": "manual",
      "assignTo": "delivery_partner",
      "dependencies": ["auto_assign_delivery"],
      "duration": 40,
      "location": {
        "tracking": true
      }
    }
  ]
}
```

### 10. Catering Service

```json
{
  "businessType": "catering_service",
  "workflow": "event_catering",
  "tasks": [
    {
      "id": "receive_inquiry",
      "name": "Receive Catering Inquiry",
      "type": "automatic",
      "assignTo": "catering_company",
      "duration": 1
    },
    {
      "id": "menu_consultation",
      "name": "Menu Consultation",
      "type": "manual",
      "assignTo": "catering_manager",
      "dependencies": ["receive_inquiry"],
      "duration": 60,
      "checklist": [
        "Discuss event details",
        "Understand guest count",
        "Dietary restrictions",
        "Budget discussion",
        "Propose menu options"
      ]
    },
    {
      "id": "send_quotation",
      "name": "Send Quotation",
      "type": "manual",
      "assignTo": "catering_manager",
      "dependencies": ["menu_consultation"],
      "duration": 120
    },
    {
      "id": "confirm_booking",
      "name": "Confirm Booking",
      "type": "manual",
      "assignTo": "customer",
      "dependencies": ["send_quotation"],
      "duration": "variable",
      "actions": ["collect_advance_payment"]
    },
    {
      "id": "procurement_planning",
      "name": "Procurement Planning",
      "type": "manual",
      "assignTo": "catering_manager",
      "dependencies": ["confirm_booking"],
      "duration": 180,
      "scheduledBefore": "event_day - 3_days",
      "checklist": [
        "Calculate ingredient quantities",
        "Order raw materials",
        "Arrange serving equipment",
        "Book staff"
      ]
    },
    {
      "id": "food_preparation",
      "name": "Food Preparation",
      "type": "manual",
      "assignTo": "catering_team",
      "dependencies": ["procurement_planning"],
      "duration": 480,
      "scheduledBefore": "event_time - 6_hours",
      "checklist": [
        "Prep all ingredients",
        "Cook menu items",
        "Quality check",
        "Pack for transport"
      ]
    },
    {
      "id": "setup_at_venue",
      "name": "Setup at Venue",
      "type": "manual",
      "assignTo": "service_team",
      "dependencies": ["food_preparation"],
      "duration": 120,
      "location": {
        "tracking": true,
        "target": "event_venue"
      },
      "checklist": [
        "Transport food",
        "Setup serving stations",
        "Arrange equipment",
        "Food warming setup"
      ]
    },
    {
      "id": "event_service",
      "name": "Event Service",
      "type": "manual",
      "assignTo": "service_team",
      "dependencies": ["setup_at_venue"],
      "duration": "variable",
      "checklist": [
        "Serve guests",
        "Maintain food quality",
        "Handle requests",
        "Monitor quantities"
      ]
    },
    {
      "id": "cleanup_teardown",
      "name": "Cleanup & Teardown",
      "type": "manual",
      "assignTo": "service_team",
      "dependencies": ["event_service"],
      "duration": 90,
      "checklist": [
        "Pack equipment",
        "Clean venue area",
        "Dispose waste",
        "Transport equipment back"
      ]
    },
    {
      "id": "settle_payment",
      "name": "Settle Final Payment",
      "type": "manual",
      "assignTo": "catering_manager",
      "dependencies": ["cleanup_teardown"],
      "duration": 10
    }
  ]
}
```

---

## 🏨 HOSPITALITY & LEISURE

### 11. Hotel

```json
{
  "businessType": "hotel",
  "workflow": "hotel_booking",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Booking",
      "type": "automatic",
      "assignTo": "hotel",
      "duration": 1,
      "actions": ["block_room", "send_confirmation", "collect_advance"]
    },
    {
      "id": "pre_arrival_prep",
      "name": "Pre-Arrival Preparation",
      "type": "manual",
      "assignTo": "housekeeping",
      "dependencies": ["confirm_booking"],
      "duration": 60,
      "scheduledBefore": "checkin_time - 4_hours",
      "checklist": [
        "Clean room thoroughly",
        "Check amenities",
        "Restock minibar",
        "Test AC/TV/WiFi",
        "Arrange welcome kit",
        "Fresh linens and towels"
      ]
    },
    {
      "id": "quality_inspection",
      "name": "Room Quality Inspection",
      "type": "manual",
      "assignTo": "housekeeping_manager",
      "dependencies": ["pre_arrival_prep"],
      "duration": 15,
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "guest_checkin",
      "name": "Guest Check-In",
      "type": "manual",
      "assignTo": "front_desk",
      "dependencies": ["quality_inspection"],
      "duration": 10,
      "checklist": [
        "Verify ID and booking",
        "Collect payment/deposit",
        "Explain hotel facilities",
        "Provide room key",
        "Offer luggage assistance"
      ]
    },
    {
      "id": "stay_period",
      "name": "Guest Stay Period",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["guest_checkin"],
      "duration": "variable",
      "parallelTasks": [
        {
          "id": "daily_housekeeping",
          "name": "Daily Housekeeping",
          "type": "manual",
          "assignTo": "housekeeping",
          "recurring": "daily",
          "duration": 30
        },
        {
          "id": "guest_requests",
          "name": "Handle Guest Requests",
          "type": "manual",
          "assignTo": "concierge",
          "onDemand": true
        }
      ]
    },
    {
      "id": "pre_checkout_billing",
      "name": "Prepare Checkout Bill",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["stay_period"],
      "scheduledBefore": "checkout_time - 2_hours",
      "actions": [
        "calculate_room_charges",
        "add_minibar_charges",
        "add_service_charges",
        "apply_discounts"
      ]
    },
    {
      "id": "guest_checkout",
      "name": "Guest Check-Out",
      "type": "manual",
      "assignTo": "front_desk",
      "dependencies": ["pre_checkout_billing"],
      "duration": 10,
      "checklist": [
        "Present final bill",
        "Collect payment",
        "Collect room key",
        "Verify minibar usage",
        "Thank guest"
      ]
    },
    {
      "id": "post_checkout_inspection",
      "name": "Post Check-Out Inspection",
      "type": "manual",
      "assignTo": "housekeeping",
      "dependencies": ["guest_checkout"],
      "duration": 15,
      "checklist": [
        "Check for damages",
        "Verify items in room",
        "Document any issues"
      ]
    },
    {
      "id": "room_turnover",
      "name": "Room Turnover Cleaning",
      "type": "manual",
      "assignTo": "housekeeping",
      "dependencies": ["post_checkout_inspection"],
      "duration": 60,
      "checklist": [
        "Deep clean room",
        "Replace all linens",
        "Restock amenities",
        "Reset room for next guest"
      ]
    },
    {
      "id": "request_feedback",
      "name": "Request Guest Feedback",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["guest_checkout"],
      "duration": 1
    }
  ]
}
```

---

## 🧑‍⚕️ HEALTH & WELLNESS

### 12. Doctor (General Physician)

```json
{
  "businessType": "doctor_clinic",
  "workflow": "medical_consultation",
  "tasks": [
    {
      "id": "confirm_appointment",
      "name": "Confirm Appointment",
      "type": "automatic",
      "assignTo": "clinic",
      "duration": 1,
      "actions": ["block_time_slot", "send_confirmation", "collect_advance"]
    },
    {
      "id": "send_reminder",
      "name": "Send Appointment Reminder",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["confirm_appointment"],
      "scheduledBefore": "appointment_time - 2_hours",
      "actions": ["send_sms", "send_email"]
    },
    {
      "id": "patient_checkin",
      "name": "Patient Check-In",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["send_reminder"],
      "duration": 5,
      "checklist": [
        "Verify patient identity",
        "Collect patient history form",
        "Record vitals (BP, temp, weight)",
        "Create/update patient file"
      ]
    },
    {
      "id": "waiting_room",
      "name": "Waiting Room",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["patient_checkin"],
      "duration": "variable",
      "actions": ["notify_doctor", "update_queue_position"]
    },
    {
      "id": "consultation",
      "name": "Medical Consultation",
      "type": "manual",
      "assignTo": "doctor",
      "dependencies": ["waiting_room"],
      "duration": 30,
      "checklist": [
        "Review patient history",
        "Conduct examination",
        "Diagnose condition",
        "Discuss treatment options",
        "Record notes in system"
      ]
    },
    {
      "id": "prescribe_medication",
      "name": "Prescribe Medication",
      "type": "manual",
      "assignTo": "doctor",
      "dependencies": ["consultation"],
      "duration": 5,
      "actions": ["generate_prescription", "send_to_pharmacy"]
    },
    {
      "id": "order_tests",
      "name": "Order Diagnostic Tests (Optional)",
      "type": "conditional",
      "assignTo": "doctor",
      "dependencies": ["consultation"],
      "duration": 5,
      "condition": "requires_tests",
      "actions": ["generate_test_orders", "schedule_tests"]
    },
    {
      "id": "billing",
      "name": "Generate Bill",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["prescribe_medication"],
      "duration": 2
    },
    {
      "id": "checkout",
      "name": "Patient Checkout",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["billing"],
      "duration": 5,
      "checklist": [
        "Collect payment",
        "Print prescription",
        "Provide medical certificate if needed",
        "Schedule follow-up if required"
      ]
    },
    {
      "id": "follow_up_reminder",
      "name": "Follow-Up Reminder",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["checkout"],
      "scheduledAfter": "7_days",
      "condition": "requires_follow_up"
    }
  ]
}
```

### 13. Diagnostic Lab

```json
{
  "businessType": "diagnostic_lab",
  "workflow": "lab_test",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Test Booking",
      "type": "automatic",
      "assignTo": "lab",
      "duration": 1,
      "actions": ["verify_tests", "estimate_cost", "schedule_slot"]
    },
    {
      "id": "pre_test_instructions",
      "name": "Send Pre-Test Instructions",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["confirm_booking"],
      "duration": 1,
      "actions": ["send_fasting_instructions", "send_preparation_guide"]
    },
    {
      "id": "patient_registration",
      "name": "Patient Registration",
      "type": "manual",
      "assignTo": "lab_reception",
      "dependencies": ["pre_test_instructions"],
      "duration": 5,
      "checklist": [
        "Verify identity",
        "Collect test orders",
        "Confirm payment",
        "Provide token number"
      ]
    },
    {
      "id": "sample_collection",
      "name": "Sample Collection",
      "type": "manual",
      "assignTo": "phlebotomist",
      "dependencies": ["patient_registration"],
      "duration": 15,
      "checklist": [
        "Verify patient identity",
        "Collect blood/urine samples",
        "Label samples correctly",
        "Update system"
      ]
    },
    {
      "id": "sample_processing",
      "name": "Sample Processing",
      "type": "manual",
      "assignTo": "lab_technician",
      "dependencies": ["sample_collection"],
      "duration": 180,
      "checklist": [
        "Prepare samples",
        "Run tests",
        "Record readings",
        "Quality check"
      ]
    },
    {
      "id": "report_generation",
      "name": "Generate Report",
      "type": "manual",
      "assignTo": "lab_technician",
      "dependencies": ["sample_processing"],
      "duration": 30,
      "checklist": [
        "Compile results",
        "Add reference ranges",
        "Flag abnormal values",
        "Generate PDF report"
      ]
    },
    {
      "id": "pathologist_verification",
      "name": "Pathologist Verification",
      "type": "manual",
      "assignTo": "pathologist",
      "dependencies": ["report_generation"],
      "duration": 15,
      "checklist": [
        "Review results",
        "Verify accuracy",
        "Add comments if needed",
        "Sign report"
      ]
    },
    {
      "id": "report_delivery",
      "name": "Deliver Report",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["pathologist_verification"],
      "duration": 5,
      "actions": [
        "send_email",
        "send_sms_notification",
        "make_available_for_download"
      ]
    }
  ]
}
```

### 14. Physiotherapist

```json
{
  "businessType": "physiotherapy",
  "workflow": "physio_session",
  "tasks": [
    {
      "id": "confirm_appointment",
      "name": "Confirm Appointment",
      "type": "automatic",
      "assignTo": "clinic",
      "duration": 1
    },
    {
      "id": "patient_assessment",
      "name": "Initial Assessment (First Visit Only)",
      "type": "conditional",
      "assignTo": "physiotherapist",
      "dependencies": ["confirm_appointment"],
      "duration": 30,
      "condition": "is_first_visit",
      "checklist": [
        "Take patient history",
        "Understand injury/condition",
        "Assess mobility",
        "Create treatment plan",
        "Set goals"
      ]
    },
    {
      "id": "therapy_session",
      "name": "Therapy Session",
      "type": "manual",
      "assignTo": "physiotherapist",
      "dependencies": ["patient_assessment"],
      "duration": 45,
      "checklist": [
        "Manual therapy",
        "Exercise therapy",
        "Electrotherapy (if needed)",
        "Hot/cold therapy",
        "Record progress"
      ]
    },
    {
      "id": "home_exercise_plan",
      "name": "Provide Home Exercise Plan",
      "type": "manual",
      "assignTo": "physiotherapist",
      "dependencies": ["therapy_session"],
      "duration": 10,
      "actions": ["print_exercise_sheet", "demonstrate_exercises"]
    },
    {
      "id": "schedule_next_session",
      "name": "Schedule Next Session",
      "type": "manual",
      "assignTo": "physiotherapist",
      "dependencies": ["home_exercise_plan"],
      "duration": 5,
      "condition": "requires_more_sessions"
    },
    {
      "id": "billing_checkout",
      "name": "Billing & Checkout",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["schedule_next_session"],
      "duration": 5
    }
  ]
}
```

---

## 🧰 HOME & REPAIR SERVICES

### 15. Electrician

```json
{
  "businessType": "electrician_service",
  "workflow": "electrical_repair",
  "tasks": [
    {
      "id": "receive_request",
      "name": "Receive Service Request",
      "type": "automatic",
      "assignTo": "service_provider",
      "duration": 1,
      "actions": ["log_complaint", "estimate_visit_charges"]
    },
    {
      "id": "pre_visit_call",
      "name": "Pre-Visit Call",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["receive_request"],
      "duration": 5,
      "checklist": [
        "Understand problem",
        "Ask about symptoms",
        "Provide time estimate",
        "Share location"
      ]
    },
    {
      "id": "travel_to_location",
      "name": "Travel to Customer Location",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["pre_visit_call"],
      "duration": 30,
      "location": {
        "tracking": true,
        "target": "customer_location"
      }
    },
    {
      "id": "inspection_diagnosis",
      "name": "Inspection & Diagnosis",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["travel_to_location"],
      "duration": 20,
      "checklist": [
        "Inspect electrical issue",
        "Test with equipment",
        "Identify root cause",
        "Estimate cost and time"
      ]
    },
    {
      "id": "customer_approval",
      "name": "Get Customer Approval",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["inspection_diagnosis"],
      "duration": 5,
      "checklist": [
        "Explain problem",
        "Share cost estimate",
        "Get approval to proceed"
      ]
    },
    {
      "id": "repair_work",
      "name": "Perform Repair Work",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["customer_approval"],
      "duration": 60,
      "checklist": [
        "Turn off main power",
        "Replace/repair faulty components",
        "Test circuits",
        "Ensure safety",
        "Clean work area"
      ]
    },
    {
      "id": "testing_verification",
      "name": "Testing & Verification",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["repair_work"],
      "duration": 10,
      "checklist": [
        "Test all connections",
        "Verify voltage",
        "Check for leaks",
        "Demonstrate to customer"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "billing",
      "name": "Generate Bill",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["testing_verification"],
      "duration": 5,
      "actions": [
        "calculate_labor_charges",
        "add_parts_cost",
        "add_visit_charges"
      ]
    },
    {
      "id": "collect_payment",
      "name": "Collect Payment",
      "type": "manual",
      "assignTo": "electrician",
      "dependencies": ["billing"],
      "duration": 5,
      "verification": {
        "type": "signature",
        "required": true
      }
    },
    {
      "id": "warranty_registration",
      "name": "Register Warranty",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["collect_payment"],
      "duration": 1,
      "actions": ["create_service_record", "set_warranty_period"]
    }
  ]
}
```

### 16. Plumber

```json
{
  "businessType": "plumber_service",
  "workflow": "plumbing_repair",
  "tasks": [
    {
      "id": "receive_request",
      "name": "Receive Service Request",
      "type": "automatic",
      "assignTo": "service_provider",
      "duration": 1
    },
    {
      "id": "emergency_check",
      "name": "Check if Emergency",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["receive_request"],
      "duration": 1,
      "actions": ["assess_urgency", "prioritize_queue"]
    },
    {
      "id": "dispatch_plumber",
      "name": "Dispatch Plumber",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["emergency_check"],
      "duration": 2,
      "actions": ["find_nearest_plumber", "assign_job"]
    },
    {
      "id": "travel_to_site",
      "name": "Travel to Site",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["dispatch_plumber"],
      "duration": 30,
      "location": {
        "tracking": true
      }
    },
    {
      "id": "assess_problem",
      "name": "Assess Problem",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["travel_to_site"],
      "duration": 15,
      "checklist": [
        "Locate leak/blockage",
        "Check pipe condition",
        "Identify required parts",
        "Estimate work"
      ]
    },
    {
      "id": "get_approval",
      "name": "Get Customer Approval",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["assess_problem"],
      "duration": 5
    },
    {
      "id": "procure_parts",
      "name": "Procure Parts (if needed)",
      "type": "conditional",
      "assignTo": "plumber",
      "dependencies": ["get_approval"],
      "duration": 60,
      "condition": "requires_parts"
    },
    {
      "id": "repair_work",
      "name": "Perform Repair",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["get_approval"],
      "duration": 90,
      "checklist": [
        "Turn off water supply",
        "Remove faulty parts",
        "Install new parts",
        "Seal connections",
        "Turn on water supply"
      ]
    },
    {
      "id": "test_system",
      "name": "Test System",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["repair_work"],
      "duration": 15,
      "checklist": [
        "Check for leaks",
        "Test water pressure",
        "Verify drainage",
        "Monitor for 10 minutes"
      ]
    },
    {
      "id": "cleanup",
      "name": "Cleanup Work Area",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["test_system"],
      "duration": 10
    },
    {
      "id": "collect_payment",
      "name": "Collect Payment",
      "type": "manual",
      "assignTo": "plumber",
      "dependencies": ["cleanup"],
      "duration": 5
    }
  ]
}
```

### 17. Home Cleaner / Maid

```json
{
  "businessType": "home_cleaning",
  "workflow": "cleaning_service",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Booking",
      "type": "automatic",
      "assignTo": "cleaning_company",
      "duration": 1,
      "actions": ["assign_cleaner", "send_confirmation"]
    },
    {
      "id": "cleaner_arrives",
      "name": "Cleaner Arrives",
      "type": "manual",
      "assignTo": "cleaner",
      "dependencies": ["confirm_booking"],
      "duration": 30,
      "location": {
        "tracking": true,
        "target": "customer_home"
      },
      "verification": {
        "type": "code",
        "required": true
      }
    },
    {
      "id": "pre_cleaning_walk",
      "name": "Pre-Cleaning Walkthrough",
      "type": "manual",
      "assignTo": "cleaner",
      "dependencies": ["cleaner_arrives"],
      "duration": 10,
      "checklist": [
        "Understand customer requirements",
        "Note areas to focus",
        "Identify restricted areas",
        "Take before photos"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "cleaning_tasks",
      "name": "Perform Cleaning",
      "type": "manual",
      "assignTo": "cleaner",
      "dependencies": ["pre_cleaning_walk"],
      "duration": 180,
      "checklist": [
        "Dust all surfaces",
        "Vacuum/mop floors",
        "Clean bathrooms",
        "Clean kitchen",
        "Organize items",
        "Take out trash"
      ]
    },
    {
      "id": "quality_check",
      "name": "Quality Check",
      "type": "manual",
      "assignTo": "cleaner",
      "dependencies": ["cleaning_tasks"],
      "duration": 15,
      "checklist": [
        "Inspect all rooms",
        "Touch up if needed",
        "Take after photos"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "customer_verification",
      "name": "Customer Verification",
      "type": "manual",
      "assignTo": "customer",
      "dependencies": ["quality_check"],
      "duration": 10,
      "verification": {
        "type": "signature",
        "required": true
      }
    },
    {
      "id": "payment",
      "name": "Collect Payment",
      "type": "manual",
      "assignTo": "cleaner",
      "dependencies": ["customer_verification"],
      "duration": 5
    }
  ]
}
```

---

## 📚 EDUCATION & TRAINING

### 18. Tutor (Private/Online)

```json
{
  "businessType": "private_tutor",
  "workflow": "tutoring_session",
  "tasks": [
    {
      "id": "confirm_session",
      "name": "Confirm Tutoring Session",
      "type": "automatic",
      "assignTo": "tutor",
      "duration": 1,
      "actions": ["block_time_slot", "send_confirmation"]
    },
    {
      "id": "prepare_material",
      "name": "Prepare Teaching Material",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["confirm_session"],
      "duration": 30,
      "scheduledBefore": "session_time - 2_hours",
      "checklist": [
        "Review student progress",
        "Prepare lesson plan",
        "Gather resources",
        "Create practice problems"
      ]
    },
    {
      "id": "session_reminder",
      "name": "Send Session Reminder",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["prepare_material"],
      "scheduledBefore": "session_time - 30_minutes",
      "actions": ["send_sms", "send_meeting_link"]
    },
    {
      "id": "start_session",
      "name": "Start Session",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["session_reminder"],
      "duration": 5,
      "actions": [
        "join_meeting",
        "verify_student_attendance",
        "start_recording"
      ]
    },
    {
      "id": "teaching",
      "name": "Teaching Session",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["start_session"],
      "duration": 60,
      "checklist": [
        "Explain concepts",
        "Solve examples",
        "Clear doubts",
        "Assign homework"
      ]
    },
    {
      "id": "homework_assignment",
      "name": "Assign Homework",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["teaching"],
      "duration": 5,
      "actions": ["share_assignments", "set_deadline"]
    },
    {
      "id": "session_notes",
      "name": "Share Session Notes",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["homework_assignment"],
      "duration": 10,
      "actions": ["upload_notes", "share_recording"]
    },
    {
      "id": "progress_update",
      "name": "Update Student Progress",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["session_notes"],
      "duration": 10,
      "actions": ["log_attendance", "note_performance", "update_parent"]
    },
    {
      "id": "schedule_next",
      "name": "Schedule Next Session",
      "type": "manual",
      "assignTo": "tutor",
      "dependencies": ["progress_update"],
      "duration": 5
    }
  ]
}
```

### 19. Coaching Center / Institute

```json
{
  "businessType": "coaching_center",
  "workflow": "course_enrollment",
  "tasks": [
    {
      "id": "enrollment_request",
      "name": "Receive Enrollment Request",
      "type": "automatic",
      "assignTo": "institute",
      "duration": 1
    },
    {
      "id": "counseling_session",
      "name": "Counseling Session",
      "type": "manual",
      "assignTo": "counselor",
      "dependencies": ["enrollment_request"],
      "duration": 30,
      "checklist": [
        "Understand student goals",
        "Assess current level",
        "Recommend course",
        "Explain fee structure"
      ]
    },
    {
      "id": "enrollment_confirmation",
      "name": "Confirm Enrollment",
      "type": "manual",
      "assignTo": "admin",
      "dependencies": ["counseling_session"],
      "duration": 10,
      "actions": [
        "collect_payment",
        "assign_batch",
        "create_student_id",
        "generate_fee_receipt"
      ]
    },
    {
      "id": "welcome_kit",
      "name": "Provide Welcome Kit",
      "type": "manual",
      "assignTo": "admin",
      "dependencies": ["enrollment_confirmation"],
      "duration": 5,
      "checklist": [
        "ID card",
        "Study material",
        "Batch schedule",
        "Access credentials"
      ]
    },
    {
      "id": "course_delivery",
      "name": "Course Delivery",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["welcome_kit"],
      "duration": "variable",
      "parallelTasks": [
        {
          "id": "attend_classes",
          "name": "Attend Regular Classes",
          "type": "recurring",
          "assignTo": "teacher",
          "recurring": "as_per_schedule"
        },
        {
          "id": "tests_assessments",
          "name": "Tests & Assessments",
          "type": "recurring",
          "assignTo": "teacher",
          "recurring": "weekly"
        },
        {
          "id": "doubt_sessions",
          "name": "Doubt Clearing Sessions",
          "type": "recurring",
          "assignTo": "teacher",
          "recurring": "as_needed"
        }
      ]
    },
    {
      "id": "final_exam",
      "name": "Final Examination",
      "type": "manual",
      "assignTo": "teacher",
      "dependencies": ["course_delivery"],
      "duration": 180
    },
    {
      "id": "result_certificate",
      "name": "Result & Certificate",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["final_exam"],
      "duration": 1440,
      "actions": ["calculate_result", "generate_certificate"]
    }
  ]
}
```

---

## 💇 BEAUTY & PERSONAL CARE

### 20. Salon / Barber Shop

```json
{
  "businessType": "salon",
  "workflow": "salon_appointment",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Booking",
      "type": "automatic",
      "assignTo": "salon",
      "duration": 1,
      "actions": ["block_slot", "assign_stylist"]
    },
    {
      "id": "customer_arrival",
      "name": "Customer Arrival",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["confirm_booking"],
      "duration": 5,
      "checklist": [
        "Greet customer",
        "Offer refreshments",
        "Verify booking",
        "Inform stylist"
      ]
    },
    {
      "id": "consultation",
      "name": "Consultation",
      "type": "manual",
      "assignTo": "stylist",
      "dependencies": ["customer_arrival"],
      "duration": 10,
      "checklist": [
        "Understand requirements",
        "Suggest styles",
        "Discuss products to use",
        "Confirm final look"
      ]
    },
    {
      "id": "service_delivery",
      "name": "Provide Service",
      "type": "manual",
      "assignTo": "stylist",
      "dependencies": ["consultation"],
      "duration": 90,
      "variableByService": true,
      "checklist": [
        "Hair wash",
        "Cut/style/color",
        "Treatment application",
        "Blow dry/styling"
      ]
    },
    {
      "id": "quality_check",
      "name": "Quality Check",
      "type": "manual",
      "assignTo": "salon_manager",
      "dependencies": ["service_delivery"],
      "duration": 5,
      "actions": ["inspect_work", "get_customer_feedback"]
    },
    {
      "id": "product_recommendation",
      "name": "Recommend Products",
      "type": "manual",
      "assignTo": "stylist",
      "dependencies": ["quality_check"],
      "duration": 5,
      "checklist": [
        "Suggest hair care products",
        "Explain usage",
        "Offer purchase"
      ]
    },
    {
      "id": "billing",
      "name": "Billing",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["product_recommendation"],
      "duration": 5,
      "actions": ["calculate_charges", "add_product_cost", "apply_discount"]
    },
    {
      "id": "payment_checkout",
      "name": "Payment & Checkout",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["billing"],
      "duration": 5,
      "checklist": [
        "Collect payment",
        "Schedule next appointment",
        "Thank customer"
      ]
    }
  ]
}
```

### 21. Spa & Massage

```json
{
  "businessType": "spa",
  "workflow": "spa_treatment",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Spa Booking",
      "type": "automatic",
      "assignTo": "spa",
      "duration": 1
    },
    {
      "id": "pre_arrival_prep",
      "name": "Pre-Arrival Preparation",
      "type": "manual",
      "assignTo": "spa_staff",
      "dependencies": ["confirm_booking"],
      "scheduledBefore": "appointment_time - 30_minutes",
      "duration": 20,
      "checklist": [
        "Prepare treatment room",
        "Set ambiance (lights, music)",
        "Warm oils",
        "Prepare towels",
        "Check equipment"
      ]
    },
    {
      "id": "customer_arrival",
      "name": "Customer Arrival",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["pre_arrival_prep"],
      "duration": 10,
      "checklist": [
        "Greet customer",
        "Offer welcome drink",
        "Provide locker key",
        "Share changing room"
      ]
    },
    {
      "id": "consultation",
      "name": "Consultation",
      "type": "manual",
      "assignTo": "therapist",
      "dependencies": ["customer_arrival"],
      "duration": 10,
      "checklist": [
        "Health history",
        "Allergies check",
        "Pressure preference",
        "Problem areas",
        "Treatment customization"
      ]
    },
    {
      "id": "treatment",
      "name": "Spa Treatment",
      "type": "manual",
      "assignTo": "therapist",
      "dependencies": ["consultation"],
      "duration": 90,
      "checklist": [
        "Steam/sauna (if included)",
        "Body scrub (if included)",
        "Massage therapy",
        "Face treatment (if included)",
        "Post-treatment relaxation"
      ]
    },
    {
      "id": "post_treatment",
      "name": "Post-Treatment Care",
      "type": "manual",
      "assignTo": "therapist",
      "dependencies": ["treatment"],
      "duration": 10,
      "checklist": [
        "Provide water",
        "Give post-care instructions",
        "Recommend products",
        "Allow relaxation time"
      ]
    },
    {
      "id": "feedback_checkout",
      "name": "Feedback & Checkout",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["post_treatment"],
      "duration": 10,
      "checklist": [
        "Collect feedback",
        "Process payment",
        "Offer package deals",
        "Schedule next visit"
      ]
    }
  ]
}
```

---

## 🐶 PET & ANIMAL SERVICES

### 22. Pet Clinic / Veterinary

```json
{
  "businessType": "veterinary_clinic",
  "workflow": "vet_consultation",
  "tasks": [
    {
      "id": "confirm_appointment",
      "name": "Confirm Appointment",
      "type": "automatic",
      "assignTo": "clinic",
      "duration": 1
    },
    {
      "id": "pet_registration",
      "name": "Pet Registration & Check-In",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["confirm_appointment"],
      "duration": 10,
      "checklist": [
        "Register pet details",
        "Create medical record",
        "Note symptoms",
        "Vaccination history",
        "Previous treatments"
      ]
    },
    {
      "id": "preliminary_exam",
      "name": "Preliminary Examination",
      "type": "manual",
      "assignTo": "vet_assistant",
      "dependencies": ["pet_registration"],
      "duration": 10,
      "checklist": [
        "Weigh pet",
        "Check temperature",
        "Measure vitals",
        "Note behavioral signs"
      ]
    },
    {
      "id": "vet_consultation",
      "name": "Veterinary Consultation",
      "type": "manual",
      "assignTo": "veterinarian",
      "dependencies": ["preliminary_exam"],
      "duration": 30,
      "checklist": [
        "Examine pet",
        "Review symptoms",
        "Diagnose condition",
        "Discuss treatment"
      ]
    },
    {
      "id": "diagnostic_tests",
      "name": "Diagnostic Tests (if needed)",
      "type": "conditional",
      "assignTo": "vet_technician",
      "dependencies": ["vet_consultation"],
      "duration": 60,
      "condition": "requires_tests",
      "checklist": [
        "Blood test",
        "X-ray",
        "Ultrasound",
        "Lab analysis"
      ]
    },
    {
      "id": "treatment",
      "name": "Treatment / Procedure",
      "type": "conditional",
      "assignTo": "veterinarian",
      "dependencies": ["diagnostic_tests"],
      "duration": 60,
      "condition": "requires_immediate_treatment",
      "checklist": [
        "Administer medication",
        "Perform procedure",
        "Apply bandages",
        "Monitor recovery"
      ]
    },
    {
      "id": "prescription",
      "name": "Prescription & Care Instructions",
      "type": "manual",
      "assignTo": "veterinarian",
      "dependencies": ["treatment"],
      "duration": 10,
      "actions": [
        "prescribe_medication",
        "provide_care_instructions",
        "schedule_follow_up"
      ]
    },
    {
      "id": "billing_checkout",
      "name": "Billing & Checkout",
      "type": "manual",
      "assignTo": "reception",
      "dependencies": ["prescription"],
      "duration": 10,
      "actions": ["calculate_charges", "process_payment", "dispense_medication"]
    },
    {
      "id": "follow_up_call",
      "name": "Follow-Up Call",
      "type": "automatic",
      "assignTo": "system",
      "dependencies": ["billing_checkout"],
      "scheduledAfter": "3_days",
      "actions": ["call_owner", "check_pet_condition"]
    }
  ]
}
```

### 23. Pet Groomer

```json
{
  "businessType": "pet_grooming",
  "workflow": "pet_grooming_session",
  "tasks": [
    {
      "id": "confirm_booking",
      "name": "Confirm Grooming Booking",
      "type": "automatic",
      "assignTo": "grooming_service",
      "duration": 1
    },
    {
      "id": "pet_arrival",
      "name": "Pet Arrival & Assessment",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["confirm_booking"],
      "duration": 10,
      "checklist": [
        "Check pet temperament",
        "Note any health issues",
        "Understand grooming requirements",
        "Take before photos",
        "Check for fleas/ticks"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "bath",
      "name": "Bath & Shampoo",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["pet_arrival"],
      "duration": 20,
      "checklist": [
        "Brush before bath",
        "Use appropriate shampoo",
        "Clean ears",
        "Clean teeth",
        "Rinse thoroughly"
      ]
    },
    {
      "id": "drying",
      "name": "Drying",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["bath"],
      "duration": 20,
      "checklist": [
        "Towel dry",
        "Blow dry",
        "Brush while drying"
      ]
    },
    {
      "id": "haircut_styling",
      "name": "Haircut & Styling",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["drying"],
      "duration": 40,
      "checklist": [
        "Trim/shave as per style",
        "Cut nails",
        "File nails",
        "Trim paw pads",
        "Clean eye area"
      ]
    },
    {
      "id": "finishing_touches",
      "name": "Finishing Touches",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["haircut_styling"],
      "duration": 10,
      "checklist": [
        "Apply cologne/perfume",
        "Tie bow/bandana",
        "Final brush",
        "Take after photos"
      ],
      "verification": {
        "type": "photo",
        "required": true
      }
    },
    {
      "id": "owner_pickup",
      "name": "Owner Pickup",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["finishing_touches"],
      "duration": 10,
      "checklist": [
        "Show before/after photos",
        "Discuss any issues found",
        "Provide care tips",
        "Schedule next grooming"
      ]
    },
    {
      "id": "payment",
      "name": "Payment",
      "type": "manual",
      "assignTo": "groomer",
      "dependencies": ["owner_pickup"],
      "duration": 5
    }
  ]
}
```

---

## 💼 PROFESSIONAL & BUSINESS SERVICES

### 24. Lawyer / Legal Consultant

```json
{
  "businessType": "legal_services",
  "workflow": "legal_consultation",
  "tasks": [
    {
      "id": "initial_inquiry",
      "name": "Receive Legal Inquiry",
      "type": "automatic",
      "assignTo": "law_firm",
      "duration": 1
    },
    {
      "id": "conflict_check",
      "name": "Conflict of Interest Check",
      "type": "manual",
      "assignTo": "admin",
      "dependencies": ["initial_inquiry"],
      "duration": 30,
      "actions": ["check_existing_clients", "verify_no_conflicts"]
    },
    {
      "id": "consultation_appointment",
      "name": "Schedule Consultation",
      "type": "manual",
      "assignTo": "admin",
      "dependencies": ["conflict_check"],
      "duration": 5,
      "actions": ["book_appointment", "send_confirmation"]
    },
    {
      "id": "document_collection",
      "name": "Collect Relevant Documents",
      "type": "manual",
      "assignTo": "client",
      "dependencies": ["consultation_appointment"],
      "duration": "variable",
      "scheduledBefore": "consultation_time - 24_hours"
    },
    {
      "id": "initial_consultation",
      "name": "Initial Consultation",
      "type": "manual",
      "assignTo": "lawyer",
      "dependencies": ["document_collection"],
      "duration": 60,
      "checklist": [
        "Understand case details",
        "Review documents",
        "Assess legal options",
        "Explain process",
        "Discuss fees"
      ]
    },
    {
      "id": "engagement_letter",
      "name": "Send Engagement Letter",
      "type": "manual",
      "assignTo": "lawyer",
      "dependencies": ["initial_consultation"],
      "duration": 60,
      "actions": ["draft_agreement", "outline_scope", "specify_fees"]
    },
    {
      "id": "retainer_payment",
      "name": "Collect Retainer Payment",
      "type": "manual",
      "assignTo": "admin",
      "dependencies": ["engagement_letter"],
      "duration": "variable"
    },
    {
      "id": "case_work",
      "name": "Case Work",
      "type": "manual",
      "assignTo": "lawyer",
      "dependencies": ["retainer_payment"],
      "duration": "variable",
      "parallelTasks": [
        {
          "id": "legal_research",
          "name": "Legal Research",
          "type": "manual"
        },
        {
          "id": "draft_documents",
          "name": "Draft Legal Documents",
          "type": "manual"
        },
        {
          "id": "court_appearances",
          "name": "Court Appearances",
          "type": "manual"
        },
        {
          "id": "client_updates",
          "name": "Regular Client Updates",
          "type": "recurring"
        }
      ]
    },
    {
      "id": "case_resolution",
      "name": "Case Resolution",
      "type": "manual",
      "assignTo": "lawyer",
      "dependencies": ["case_work"],
      "duration": "variable"
    },
    {
      "id": "final_billing",
      "name": "Final Billing & Settlement",
      "type": "manual",
      "assignTo": "admin",
      "dependencies": ["case_resolution"],
      "duration": 30,
      "actions": ["calculate_billable_hours", "deduct_retainer", "send_invoice"]
    }
  ]
}
```

### 25. Accountant / CA

```json
{
  "businessType": "accounting_services",
  "workflow": "tax_filing",
  "tasks": [
    {
      "id": "onboard_client",
      "name": "Client Onboarding",
      "type": "manual",
      "assignTo": "accountant",
      "duration": 30,
      "checklist": [
        "Collect business details",
        "Understand requirements",
        "Explain services",
        "Sign engagement letter"
      ]
    },
    {
      "id": "document_collection",
      "name": "Collect Financial Documents",
      "type": "manual",
      "assignTo": "accountant",
      "dependencies": ["onboard_client"],
      "duration": "variable",
      "checklist": [
        "Income statements",
        "Expense receipts",
        "Bank statements",
        "Investment details",
        "Previous returns"
      ]
    },
    {
      "id": "data_entry",
      "name": "Data Entry & Verification",
      "type": "manual",
      "assignTo": "accountant",
      "dependencies": ["document_collection"],
      "duration": 180,
      "checklist": [
        "Enter all transactions",
        "Categorize expenses",
        "Verify numbers",
        "Reconcile accounts"
      ]
    },
    {
      "id": "computation",
      "name": "Tax Computation",
      "type": "manual",
      "assignTo": "accountant",
      "dependencies": ["data_entry"],
      "duration": 120,
      "checklist": [
        "Calculate income",
        "Apply deductions",
        "Compute tax liability",
        "Identify savings opportunities"
      ]
    },
    {
      "id": "review_with_client",
      "name": "Review with Client",
      "type": "manual",
      "assignTo": "accountant",
      "dependencies": ["computation"],
      "duration": 60,
      "checklist": [
        "Explain calculations",
        "Discuss tax saving strategies",
        "Get client approval",
        "Collect payment"
      ]
    },
    {
      "id": "file_returns",
      "name": "File Tax Returns",
      "type": "manual",
      "assignTo": "accountant",
      "dependencies": ["review_with_client"],
      "duration": 60,
      "actions": ["submit_online", "generate_acknowledgment"]
    },
    {
      "id": "post_filing_services",
      "name": "Post-Filing Services",
      "type": "automatic",
      "assignTo": "accountant",
      "dependencies": ["file_returns"],
      "duration": "variable",
      "checklist": [
        "Share acknowledgment",
        "Track refund status",
        "Respond to notices",
        "Maintain records"
      ]
    }
  ]
}
```

---

## 🎓 SUMMARY

This document contains task workflow templates for 25+ major business types. Each template defines:

1. **Task Flow:** Sequential and parallel tasks
2. **Duration Estimates:** Time required for each task
3. **Dependencies:** Which tasks must complete first
4. **Assignments:** Which node/role handles each task
5. **Checklists:** Sub-steps within each task
6. **Verification:** Required proof (photo, signature, OTP)
7. **Conditions:** When tasks should execute
8. **Scheduling:** When to trigger relative to event time

These templates serve as **blueprints** that the system uses to automatically generate task trees when orders are created. They can be customized per node while maintaining the core workflow structure.

---

## 🔧 Template Usage

When an order is created:
1. System identifies business type from node category
2. Loads appropriate task template
3. Instantiates tasks with order-specific data
4. Assigns tasks to appropriate nodes in hierarchy
5. Sets up dependencies and timing
6. Monitors task completion
7. Updates order status based on task progress

This approach ensures:
- ✅ Consistent workflows across similar businesses
- ✅ Customizable per provider
- ✅ Real-time progress tracking
- ✅ Automatic notifications
- ✅ Complete audit trail
- ✅ No hardcoded status fields

---

## 📝 Adding New Business Types

To add a new business type:
1. Create task template JSON
2. Define task sequence and dependencies
3. Set duration estimates
4. Add checklists and verification requirements
5. Test workflow end-to-end
6. Deploy template to system

No database schema changes required!
