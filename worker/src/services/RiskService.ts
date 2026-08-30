import { RiskLevel, EnvBindings } from '../types';
import { executeQuery } from '../db/connection';
import { RowDataPacket } from 'mysql2/promise';

export interface RiskEvaluationResult {
  score: number; // 0 to 100
  risk_percentage: number; // 0 to 100%
  risk_level: RiskLevel;
  risk_status: string;
  status: string;
  spoil_in: number; // Hours remaining before spoilage (e.g. 18.5)
  estimated_travel_time_hours?: number; // Travel time with 20% delay buffer
  violations: string[];
  recommendations: string[];
}

export class RiskService {
  /**
   * Evaluates food spoilage risk by calling the external ML Model API (http://4.213.226.122:5000/api/predict)
   * with the required payload structure (Food_Name, Batch_ID, History array) and falls back to rule-based engine if offline.
   * Also integrates planned travel time (+20% delay buffer) into the spoilage prediction risk.
   */
  static async evaluateRisk(
    data: {
      delivery_id?: number | string;
      delivery_code?: string;
      batch_id?: string;
      food_name?: string;
      temperature: number;
      humidity: number;
      methane: number;
      co2: number;
      days_stored?: number;
      storage_days?: number;
      storage_hours?: number;
      estimated_travel_time_minutes?: number; // Base travel time from route API
      estimated_travel_time_hours?: number;   // Buffer calculation with +20% for traffic/transit delays
      spoil_in?: number;
    },
    env?: EnvBindings
  ): Promise<RiskEvaluationResult> {
    const rawFood = (data.food_name || 'Chicken').trim();
    // Map food name to the 15 trained models in the ML engine
    let foodName = 'Chicken';
    const foodLower = rawFood.toLowerCase();
    if (foodLower.includes('chicken') || foodLower.includes('poultry')) foodName = 'Chicken';
    else if (foodLower.includes('fish') || foodLower.includes('seafood') || foodLower.includes('salmon')) foodName = 'Fish';
    else if (foodLower.includes('beef') || foodLower.includes('meat') || foodLower.includes('mutton') || foodLower.includes('pork')) foodName = 'Beef';
    else if (foodLower.includes('egg')) foodName = 'Eggs';
    else if (foodLower.includes('milk') || foodLower.includes('dairy')) foodName = 'Milk';
    else if (foodLower.includes('cheese') || foodLower.includes('paneer') || foodLower.includes('butter')) foodName = 'Cheese';
    else if (foodLower.includes('yogurt') || foodLower.includes('curd')) foodName = 'Yogurt';
    else if (foodLower.includes('tomato')) foodName = 'Tomato';
    else if (foodLower.includes('strawberry') || foodLower.includes('berries') || foodLower.includes('berry')) foodName = 'Strawberry';
    else if (foodLower.includes('apple')) foodName = 'Apple';
    else if (foodLower.includes('orange') || foodLower.includes('citrus')) foodName = 'Orange';
    else if (foodLower.includes('potato')) foodName = 'Potato';
    else if (foodLower.includes('spinach') || foodLower.includes('veg') || foodLower.includes('vegetable') || foodLower.includes('greens')) foodName = 'Spinach';
    else if (foodLower.includes('mushroom')) foodName = 'Mushroom';
    else if (foodLower.includes('bread') || foodLower.includes('bakery')) foodName = 'Bread';
    else {
      // Check if title case matches one of the 15 trained foods
      const titleCased = rawFood.charAt(0).toUpperCase() + rawFood.slice(1).toLowerCase();
      const validFoods = ['Apple', 'Beef', 'Bread', 'Cheese', 'Chicken', 'Eggs', 'Fish', 'Milk', 'Mushroom', 'Orange', 'Potato', 'Spinach', 'Strawberry', 'Tomato', 'Yogurt'];
      foodName = validFoods.includes(titleCased) ? titleCased : 'Chicken';
    }

    // Set Batch_ID as Delivery ID / Code
    const batchId = String(data.batch_id || data.delivery_id || data.delivery_code || `${foodName.toUpperCase()}_001`);

    // Convert storage_hours to storage_days (or vice versa)
    const days = data.storage_days !== undefined
      ? data.storage_days
      : (data.days_stored !== undefined ? data.days_stored : (data.storage_hours !== undefined ? data.storage_hours / 24 : 0.04));
    const hours = data.storage_hours !== undefined
      ? data.storage_hours
      : (days * 24);

    // Calculate estimated travel time with 20% delay buffer (Time to Travel + 20% extra for delays)
    let estimatedTravelHoursWithDelay = 0;
    if (data.estimated_travel_time_hours !== undefined && data.estimated_travel_time_hours > 0) {
      estimatedTravelHoursWithDelay = Number(data.estimated_travel_time_hours.toFixed(2));
    } else if (data.estimated_travel_time_minutes !== undefined && data.estimated_travel_time_minutes > 0) {
      // Add 20% extra time for transit delays: (minutes * 1.20) / 60
      estimatedTravelHoursWithDelay = Number(((data.estimated_travel_time_minutes * 1.20) / 60).toFixed(2));
    } else {
      // Default standard regional delivery trip buffer (4.5 hours with traffic)
      estimatedTravelHoursWithDelay = 4.5;
    }

    const mlModelUrl = env?.ML_MODEL_URL || 'http://127.0.0.1:8001/api/predict';

    // 1. Try calling the external ML Model endpoint with the exact requested format
    try {
      const mlPayload = {
        Food_Name: foodName,
        Batch_ID: batchId,
        Estimated_Travel_Hours_With_Delay: estimatedTravelHoursWithDelay,
        History: [
          {
            Timestamp_Hours: Number(hours.toFixed(2)),
            Temperature: Number(data.temperature.toFixed(2)),
            Humidity: Number(data.humidity.toFixed(2)),
            Methane: Number(data.methane.toFixed(4)),
            CO2: Number(data.co2.toFixed(2)),
            Storage_Days: Number(days.toFixed(4))
          }
        ]
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

      const response = await fetch(mlModelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(mlPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const mlRes = (await response.json()) as any;
        console.log(`[ML_MODEL_SUCCESS] Response from ${mlModelUrl}:`, mlRes);

        // Extract score / risk percentage (Model returns Risk_Score)
        let mlScore = 0;
        if (typeof mlRes.Risk_Score === 'number') mlScore = mlRes.Risk_Score;
        else if (typeof mlRes.risk_percentage === 'number') mlScore = mlRes.risk_percentage;
        else if (typeof mlRes.score === 'number') mlScore = mlRes.score;
        else if (typeof mlRes.risk_score === 'number') mlScore = mlRes.risk_score;
        else if (typeof mlRes.spoilage_risk === 'number') mlScore = mlRes.spoilage_risk;

        mlScore = Math.min(100, Math.max(0, Math.round(mlScore * 10) / 10));

        // Extract spoil_in (Model returns RUL_Days -> Remaining Useful Life in Days)
        let mlSpoilIn = 0;
        if (data.spoil_in !== undefined && !isNaN(data.spoil_in)) {
          mlSpoilIn = data.spoil_in;
        } else if (typeof mlRes.RUL_Days === 'number') {
          mlSpoilIn = Math.max(0, Math.round(mlRes.RUL_Days * 24 * 10) / 10);
        } else if (typeof mlRes.spoil_in === 'number') {
          mlSpoilIn = mlRes.spoil_in;
        } else if (typeof mlRes.spoil_in_hours === 'number') {
          mlSpoilIn = mlRes.spoil_in_hours;
        } else if (typeof mlRes.hours_remaining === 'number') {
          mlSpoilIn = mlRes.hours_remaining;
        } else {
          mlSpoilIn = mlScore >= 70 ? 0.0 : Math.max(0, Math.round(((100 - mlScore) / 100) * 72 - hours) * 10) / 10;
        }

        // Map Category (Model returns Risk_Category: LOW, MODERATE, HIGH, CRITICAL)
        const catUpper = String(mlRes.Risk_Category || mlRes.risk_status || '').toUpperCase();
        let riskLevel: RiskLevel = 'LOW';
        let status = 'SAFE';
        let riskStatus = 'OPTIMAL';

        if (catUpper.includes('CRITICAL') || mlScore >= 70) {
          riskLevel = 'CRITICAL';
          status = 'CRITICAL SPOILAGE';
          riskStatus = 'CRITICAL';
        } else if (catUpper.includes('HIGH') || mlScore >= 45) {
          riskLevel = 'HIGH';
          status = 'HIGH RISK';
          riskStatus = 'HIGH_RISK';
        } else if (catUpper.includes('MODERATE') || catUpper.includes('MEDIUM') || mlScore >= 20) {
          riskLevel = 'MEDIUM';
          status = 'MODERATE RISK';
          riskStatus = 'MODERATE_RISK';
        } else {
          riskLevel = 'LOW';
          status = 'OPTIMAL';
          riskStatus = 'SAFE';
        }

        const violations: string[] = Array.isArray(mlRes.violations)
          ? mlRes.violations
          : Array.isArray(mlRes.Risk_Reasons)
            ? mlRes.Risk_Reasons
            : [];

        // Check if projected travel time exceeds remaining shelf-life
        if (mlSpoilIn > 0 && estimatedTravelHoursWithDelay > 0 && mlSpoilIn <= estimatedTravelHoursWithDelay) {
          violations.push(`Projected travel time with +20% delay buffer (${estimatedTravelHoursWithDelay.toFixed(1)}h) exceeds remaining shelf life (${mlSpoilIn.toFixed(1)}h)`);
          if (riskLevel === 'LOW' || riskLevel === 'MEDIUM') {
            riskLevel = 'HIGH';
            status = 'HIGH RISK - EXPEDITE ARRIVAL';
          }
        }

        // Recommendations & Reasons from model
        let recs: string[] = [];
        if (Array.isArray(mlRes.Risk_Reasons) && mlRes.Risk_Reasons.length > 0) {
          recs = mlRes.Risk_Reasons;
        } else if (Array.isArray(mlRes.recommendations) && mlRes.recommendations.length > 0) {
          recs = mlRes.recommendations;
        } else if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
          recs.push('Engage refrigeration unit immediately', 'Inspect cargo upon arrival for temperature deviation');
        } else {
          recs.push('Environmental parameters optimal. Safe for continued transit.');
        }

        return {
          score: mlScore,
          risk_percentage: mlScore,
          risk_level: riskLevel,
          risk_status: riskStatus,
          status,
          spoil_in: Math.max(0, Math.round(mlSpoilIn * 10) / 10),
          estimated_travel_time_hours: estimatedTravelHoursWithDelay,
          violations,
          recommendations: recs
        };
      } else {
        console.warn(`[ML_MODEL_WARN] ${mlModelUrl} returned status ${response.status}. Falling back to internal engine.`);
      }
    } catch (err: any) {
      console.warn(`[ML_MODEL_FALLBACK] Could not reach ${mlModelUrl} (${err.message}). Using local rule engine.`);
    }

    // 2. Local Fallback Rule Engine (Runs when remote ML server is unreachable or timeout occurs)
    let score = 0;
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Temperature evaluation (Ideal chilled food: 0°C to 4°C, safe up to 8°C)
    if (data.temperature > 15) {
      score += 45;
      violations.push(`Critical temperature breach (${data.temperature}°C)`);
      recommendations.push('Immediate cooling intervention required: Lower refrigeration unit to 2°C - 4°C');
    } else if (data.temperature > 10) {
      score += 30;
      violations.push(`Elevated temperature (${data.temperature}°C)`);
      recommendations.push('Check vehicle refrigeration cooling system and seal compartment doors');
    } else if (data.temperature > 6) {
      score += 15;
      violations.push(`Mild temperature elevation (${data.temperature}°C)`);
      recommendations.push('Maintain chilled temperature below 6°C to preserve freshness');
    }

    // Humidity evaluation (High moisture > 85% accelerates bacterial growth)
    if (data.humidity > 88) {
      score += 20;
      violations.push(`Excessive humidity (${data.humidity}%)`);
      recommendations.push('High moisture detected: Engage dehumidification or air circulation');
    } else if (data.humidity > 78) {
      score += 10;
      recommendations.push('Monitor relative humidity to prevent condensation on food packages');
    }

    // Methane gas evaluation (Decomposition marker)
    // Supports real MQ-4 sensor PPM (>25 elevated, >45 high decomposition) and normalized ranges
    if (data.methane > 45 || (data.methane > 0.05 && data.methane < 1.0)) {
      score += 35;
      violations.push(`High decomposition gas detection (${data.methane} ppm CH4)`);
      recommendations.push('High volatile gas accumulation: Check cargo for packaging ruptures or early spoilage');
    } else if (data.methane > 25 || (data.methane > 0.02 && data.methane < 1.0)) {
      score += 20;
      violations.push(`Trace methane gas detected (${data.methane} ppm CH4)`);
    }

    // CO2 evaluation (Respiration / bacterial activity)
    if (data.co2 > 1200) {
      score += 25;
      violations.push(`High CO2 accumulation (${data.co2} ppm)`);
      recommendations.push('Ventilate storage space to dissipate respiration gases');
    } else if (data.co2 > 800) {
      score += 10;
    }

    // Storage days / transit duration factor
    if (days > 4) {
      score += 25;
      violations.push(`Extended transit/storage elapsed (${days.toFixed(2)} days / ${hours.toFixed(1)} hrs)`);
      recommendations.push('Expedite delivery handover: Cargo nearing maximum safe shelf life');
    } else if (days > 2) {
      score += 10;
      violations.push(`Moderate transit elapsed (${days.toFixed(2)} days / ${hours.toFixed(1)} hrs)`);
    }

    // Food-specific adjustments
    if (foodLower.includes('fish') || foodLower.includes('meat') || foodLower.includes('seafood') || foodLower.includes('chicken')) {
      if (data.temperature > 5) {
        score += 10;
        violations.push(`Perishable meat/seafood sensitive to >5°C thermal exposure`);
      }
    }

    score = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

    let risk_level: RiskLevel = 'LOW';
    let status = 'SAFE';
    let risk_status = 'OPTIMAL';

    if (score >= 70) {
      risk_level = 'CRITICAL';
      status = 'CRITICAL SPOILAGE';
      risk_status = 'CRITICAL';
      if (recommendations.length === 0) {
        recommendations.push('Reject shipment inspection recommended due to thermal/gas breach');
      }
    } else if (score >= 45) {
      risk_level = 'HIGH';
      status = 'HIGH RISK';
      risk_status = 'HIGH_RISK';
    } else if (score >= 20) {
      risk_level = 'MEDIUM';
      status = 'MODERATE RISK';
      risk_status = 'MODERATE_RISK';
    } else {
      risk_level = 'LOW';
      status = 'OPTIMAL';
      risk_status = 'SAFE';
      recommendations.push('Environmental parameters optimal. Safe for continued transit.');
    }

    // Compute estimated remaining shelf-life (spoil_in in hours)
    let calculatedSpoilIn = 0;
    if (data.spoil_in !== undefined && typeof data.spoil_in === 'number' && !isNaN(data.spoil_in)) {
      calculatedSpoilIn = Math.max(0, Math.round(data.spoil_in * 10) / 10);
    } else if (score >= 70) {
      calculatedSpoilIn = 0.0;
    } else {
      let baseShelfLife = 72.0;
      if (foodLower.includes('fish') || foodLower.includes('seafood')) baseShelfLife = 48.0;
      else if (foodLower.includes('meat') || foodLower.includes('chicken') || foodLower.includes('dairy') || foodLower.includes('milk')) baseShelfLife = 60.0;
      else if (foodLower.includes('produce') || foodLower.includes('fruit') || foodLower.includes('vegetable')) baseShelfLife = 96.0;

      let degradation = 1.0;
      if (data.temperature > 15) degradation += 4.0;
      else if (data.temperature > 10) degradation += 2.2;
      else if (data.temperature > 6) degradation += 1.2;

      if (data.humidity > 88) degradation += 1.0;
      else if (data.humidity > 78) degradation += 0.4;

      if (data.methane > 45 || (data.methane > 0.05 && data.methane < 1.0)) degradation += 3.5;
      else if (data.methane > 25 || (data.methane > 0.02 && data.methane < 1.0)) degradation += 1.8;

      if (data.co2 > 1200) degradation += 1.5;
      else if (data.co2 > 800) degradation += 0.6;

      const remainingHours = Math.max(0, (baseShelfLife / degradation) - hours);
      calculatedSpoilIn = Math.round(remainingHours * 10) / 10;
    }

    // Check if remaining shelf life is less than the projected transit duration (+20% delay buffer)
    if (calculatedSpoilIn > 0 && estimatedTravelHoursWithDelay > 0 && calculatedSpoilIn <= estimatedTravelHoursWithDelay) {
      violations.push(`Projected travel time with +20% delay buffer (${estimatedTravelHoursWithDelay.toFixed(1)}h) exceeds remaining shelf life (${calculatedSpoilIn.toFixed(1)}h)`);
      if (risk_level === 'LOW' || risk_level === 'MEDIUM') {
        risk_level = 'HIGH';
        status = 'HIGH RISK - EXPEDITE ARRIVAL';
        score = Math.max(score, 55);
      }
    }

    return {
      score,
      risk_percentage: score,
      risk_level,
      risk_status,
      status,
      spoil_in: calculatedSpoilIn,
      estimated_travel_time_hours: estimatedTravelHoursWithDelay,
      violations,
      recommendations
    };
  }

  /**
   * Checks if an alert notification should be triggered (deduplication & escalation check).
   */
  static async shouldTriggerAlert(
    deliveryId: number,
    newRiskLevel: RiskLevel,
    env?: EnvBindings
  ): Promise<boolean> {
    if (newRiskLevel === 'LOW') return false;

    // Check latest notification for this delivery in database
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, data_json, created_at 
       FROM notifications 
       WHERE type = 'SPOILAGE_ALERT' AND JSON_EXTRACT(data_json, '$.deliveryId') = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [deliveryId],
      env
    );

    if (rows.length === 0) return true;

    const lastNotif = rows[0];
    const lastTime = new Date(lastNotif.created_at).getTime();
    const elapsedMinutes = (Date.now() - lastTime) / (1000 * 60);

    // If more than 15 minutes have passed since last alert, allow new alert
    if (elapsedMinutes > 15) return true;

    // If risk level escalated to CRITICAL, alert immediately
    let lastLevel = 'LOW';
    if (lastNotif.data_json) {
      const data = typeof lastNotif.data_json === 'string' ? JSON.parse(lastNotif.data_json) : lastNotif.data_json;
      lastLevel = data.riskLevel || 'LOW';
    }

    if (newRiskLevel === 'CRITICAL' && lastLevel !== 'CRITICAL') {
      return true;
    }

    return false;
  }
}
