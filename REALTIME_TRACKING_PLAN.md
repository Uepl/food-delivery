# REALTIME TRACKING PLAN

## 1. Dynamic Incentive Feature (โบนัสพิเศษรายพื้นที่)

**Requirement:** ออกแบบฟีเจอร์ Dynamic Incentive เพื่อดึงดูด Rider ในช่วง Rush Hour ที่มีการยกเลิกงานสูงถึง 25%

**Concept:** ระบบจะคำนวณและปรับโบนัสพิเศษแบบ Real-time ให้กับ Rider ในพื้นที่ที่มี Demand สูงกว่า Supply อย่างมีนัยสำคัญ

**Key Considerations:**
*   **Real-time Calculation:** ใช้ Demand/Supply ratio และข้อมูล Rider Availability ในแต่ละ Grid Area เพื่อคำนวณโบนัสอย่างต่อเนื่อง
*   **Targeting:** กำหนด Threshold สำหรับการให้โบนัส และปรับตามช่วงเวลา/ภูมิภาค
*   **Transparency:** แสดงผลโบนัสให้ Rider ทราบล่วงหน้าอย่างชัดเจน

## 2. Data Modeling: Cancellation Log (ประวัติการยกเลิกงาน)

**Requirement:** ออกแบบ Schema เพื่อเก็บประวัติการยกเลิกงาน Rider สำหรับวิเคราะห์พฤติกรรมทุจริต (Fraud Detection)

**Schema Proposal (Conceptual):**

```
CancellationLog
    - `log_id`: UUID (Primary Key)
    - `rider_id`: UUID (Foreign Key to Rider Profile)
    - `order_id`: UUID (Foreign Key to Order Details)
    - `cancellation_timestamp`: TIMESTAMP (เวลาที่ยกเลิก)
    - `reason_code`: INT (รหัสเหตุผลการยกเลิก เช่น Rider-initiated, Customer-initiated, System, etc.)
    - `reason_detail`: TEXT (รายละเอียดเหตุผล, ถ้ามี)
    - `order_value`: DECIMAL (มูลค่าออเดอร์ ณ เวลาที่ยกเลิก)
    - `pickup_location_lat`: DECIMAL (ละติจูดจุดรับงาน)
    - `pickup_location_lon`: DECIMAL (ลองจิจูดจุดรับงาน)
    - `rider_current_location_lat`: DECIMAL (ละติจูดตำแหน่ง Rider ขณะยกเลิก)
    - `rider_current_location_lon`: DECIMAL (ลองจิจูดตำแหน่ง Rider ขณะยกเลิก)
    - `time_to_cancellation_minutes`: INT (ระยะเวลาจาก Accept งานจนถึงยกเลิก)
    - `distance_to_pickup_km`: DECIMAL (ระยะทาง Rider ถึงจุดรับ ณ เวลาที่ยกเลิก)
    - `is_rush_hour`: BOOLEAN (True ถ้าอยู่ในช่วง Rush Hour)
    - `fraud_potential_score`: DECIMAL (คะแนนบ่งชี้ความเสี่ยงทุจริต, คำนวณจาก Rule-based หรือ ML Model)
    - `fraud_detection_flag`: BOOLEAN (Flag ถ้าเข้าข่ายทุจริต)
```

**Key Considerations for Fraud Detection:**
*   **Contextual Data:** การเก็บ `time_to_cancellation_minutes`, `distance_to_pickup_km`, และตำแหน่ง Rider ณ เวลาที่ยกเลิกจะช่วยแยกแยะการยกเลิกที่เป็นเหตุสุดวิสัย (เช่น รถเสีย, ลูกค้ายกเลิกเร็ว) กับการทุจริต (เช่น การจงใจรับงานเพื่อรอโบนัสพื้นที่อื่น)
*   **Behavioral Thresholds:** กำหนด Rule-based หรือใช้ Machine Learning Model เพื่อวิเคราะห์ Pattern การยกเลิกที่เข้าข่ายทุจริต (เช่น ยกเลิกบ่อยในพื้นที่ที่มีโบนัสสูง, ยกเลิกเมื่อรับงานได้ระยะหนึ่งแล้วเพื่อรอ Assignment ใหม่)
*   **Actionable Insights:** ระบบควรแจ้งเตือนเมื่อตรวจพบพฤติกรรมที่น่าสงสัย เพื่อให้ทีม Operations สามารถตรวจสอบและดำเนินการได้ทันท่วงที
