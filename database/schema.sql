-- ========================================================
-- Smart Food Delivery + IoT + ML Monitoring System
-- Production Database Schema for MySQL / MariaDB
-- ========================================================

CREATE DATABASE IF NOT EXISTS `smart_food_delivery` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `smart_food_delivery`;

-- Disable foreign key checks during table setup
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- 1. Table: users
-- Roles: admin, sender, driver
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(30) DEFAULT NULL,
  `role` ENUM('admin', 'sender', 'driver') NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `first_login` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_is_active` (`is_active`),
  INDEX `idx_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Table: password_setup_tokens
-- For secure onboarding / first login verification
-- --------------------------------------------------------
DROP TABLE IF EXISTS `password_setup_tokens`;
CREATE TABLE `password_setup_tokens` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL UNIQUE,
  `expires_at` TIMESTAMP NOT NULL,
  `used_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pst_user_id` (`user_id`),
  INDEX `idx_pst_expires` (`expires_at`),
  CONSTRAINT `fk_pst_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Table: sensor_modules
-- Hardware devices deployed in food transport containers
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sensor_modules`;
CREATE TABLE `sensor_modules` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `device_id` VARCHAR(50) NOT NULL UNIQUE,
  `device_name` VARCHAR(100) NOT NULL,
  `api_key_hash` VARCHAR(255) NOT NULL,
  `hardware_model` VARCHAR(50) DEFAULT 'SFM-ESP32-V1',
  `firmware_version` VARCHAR(30) DEFAULT '1.0.0',
  `driver_id` INT UNSIGNED NULL DEFAULT NULL,
  `status` ENUM('available', 'assigned', 'offline', 'removed') NOT NULL DEFAULT 'available',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_seen_at` TIMESTAMP NULL DEFAULT NULL,
  `registered_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sm_device_id` (`device_id`),
  INDEX `idx_sm_driver` (`driver_id`),
  INDEX `idx_sm_status` (`status`),
  INDEX `idx_sm_is_active` (`is_active`),
  INDEX `idx_sm_last_seen` (`last_seen_at`),
  CONSTRAINT `fk_sm_registered_by` FOREIGN KEY (`registered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sm_driver` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Table: deliveries
-- Core delivery entities and lifecycle
-- --------------------------------------------------------
DROP TABLE IF EXISTS `deliveries`;
CREATE TABLE `deliveries` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `delivery_code` VARCHAR(50) NOT NULL UNIQUE,
  `sender_id` INT UNSIGNED NOT NULL,
  `driver_id` INT UNSIGNED NULL DEFAULT NULL,
  `sensor_module_id` INT UNSIGNED NULL DEFAULT NULL,
  `food_name` VARCHAR(150) NOT NULL,
  `source_location` VARCHAR(255) NOT NULL,
  `destination_location` VARCHAR(255) NOT NULL,
  `start_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('pending', 'assigned', 'accepted', 'in_transit', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `assigned_at` TIMESTAMP NULL DEFAULT NULL,
  `accepted_at` TIMESTAMP NULL DEFAULT NULL,
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `route_risk_data` LONGTEXT NULL DEFAULT NULL,
  INDEX `idx_deliv_code` (`delivery_code`),
  INDEX `idx_deliv_sender` (`sender_id`),
  INDEX `idx_deliv_driver` (`driver_id`),
  INDEX `idx_deliv_sensor` (`sensor_module_id`),
  INDEX `idx_deliv_status` (`status`),
  INDEX `idx_deliv_start_time` (`start_time`),
  INDEX `idx_deliv_created` (`created_at`),
  CONSTRAINT `fk_deliv_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_deliv_driver` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deliv_sensor` FOREIGN KEY (`sensor_module_id`) REFERENCES `sensor_modules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Table: delivery_sensor_assignments
-- Historical sensor assignment audit and tracking
-- --------------------------------------------------------
DROP TABLE IF EXISTS `delivery_sensor_assignments`;
CREATE TABLE `delivery_sensor_assignments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `delivery_id` INT UNSIGNED NOT NULL,
  `sensor_module_id` INT UNSIGNED NOT NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unassigned_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_dsa_delivery` (`delivery_id`),
  INDEX `idx_dsa_sensor` (`sensor_module_id`),
  INDEX `idx_dsa_active` (`sensor_module_id`, `unassigned_at`),
  CONSTRAINT `fk_dsa_delivery` FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dsa_sensor` FOREIGN KEY (`sensor_module_id`) REFERENCES `sensor_modules` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Table: sensor_logs
-- High-frequency telemetry readings from physical sensors
-- --------------------------------------------------------
DROP TABLE IF EXISTS `sensor_logs`;
CREATE TABLE `sensor_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `delivery_id` INT UNSIGNED NOT NULL,
  `sensor_module_id` INT UNSIGNED NOT NULL,
  `temperature` DECIMAL(5, 2) NOT NULL,
  `humidity` DECIMAL(5, 2) NOT NULL,
  `methane` DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
  `co2` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `storage_hours` DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
  `storage_days` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `score` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(50) NOT NULL DEFAULT 'LOW',
  `risk_level` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN') NOT NULL DEFAULT 'LOW',
  `spoil_in` DECIMAL(7, 2) NULL DEFAULT NULL,
  `device_recorded_at` TIMESTAMP NULL DEFAULT NULL,
  `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sl_delivery` (`delivery_id`),
  INDEX `idx_sl_sensor` (`sensor_module_id`),
  INDEX `idx_sl_recorded` (`recorded_at`),
  INDEX `idx_sl_deliv_rec` (`delivery_id`, `recorded_at`),
  CONSTRAINT `fk_sl_delivery` FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_sensor` FOREIGN KEY (`sensor_module_id`) REFERENCES `sensor_modules` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. Table: model_predictions
-- Machine learning spoilage inference outputs
-- --------------------------------------------------------
DROP TABLE IF EXISTS `model_predictions`;
CREATE TABLE `model_predictions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `delivery_id` INT UNSIGNED NOT NULL,
  `sensor_log_id` BIGINT UNSIGNED NOT NULL,
  `model_version` VARCHAR(50) NOT NULL DEFAULT 'v1.0.0-spoilage-rf',
  `score` DECIMAL(5, 2) NOT NULL,
  `risk_level` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN') NOT NULL,
  `spoil_in` DECIMAL(7, 2) NULL DEFAULT NULL,
  `prediction_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mp_delivery` (`delivery_id`),
  INDEX `idx_mp_sensor_log` (`sensor_log_id`),
  INDEX `idx_mp_timestamp` (`prediction_timestamp`),
  CONSTRAINT `fk_mp_delivery` FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mp_sensor_log` FOREIGN KEY (`sensor_log_id`) REFERENCES `sensor_logs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. Table: notifications
-- In-app alerts, threshold warnings, and lifecycle notifications
-- --------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'INFO',
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `data_json` JSON DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notif_user` (`user_id`),
  INDEX `idx_notif_read` (`is_read`),
  INDEX `idx_notif_created` (`created_at`),
  INDEX `idx_notif_user_read` (`user_id`, `is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 9. Table: security_logs
-- Complete audit trail for security-critical actions
-- --------------------------------------------------------
DROP TABLE IF EXISTS `security_logs`;
CREATE TABLE `security_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL DEFAULT NULL,
  `email` VARCHAR(191) NULL DEFAULT NULL,
  `event_type` VARCHAR(60) NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `details_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sec_user` (`user_id`),
  INDEX `idx_sec_event` (`event_type`),
  INDEX `idx_sec_created` (`created_at`),
  CONSTRAINT `fk_sec_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. Table: driver_locations
-- Real-time GPS coordinates stream from Driver's mobile browser
-- --------------------------------------------------------
DROP TABLE IF EXISTS `driver_locations`;
CREATE TABLE `driver_locations` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `driver_id` INT UNSIGNED NOT NULL,
  `delivery_id` INT UNSIGNED NOT NULL,
  `latitude` DECIMAL(10, 7) NOT NULL,
  `longitude` DECIMAL(10, 7) NOT NULL,
  `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dl_driver` (`driver_id`),
  INDEX `idx_dl_delivery` (`delivery_id`),
  INDEX `idx_dl_recorded` (`recorded_at`),
  INDEX `idx_dl_deliv_rec` (`delivery_id`, `recorded_at`),
  CONSTRAINT `fk_dl_driver` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dl_delivery` FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 11. Table: system_settings
-- System-wide configurable thresholds, cooldowns, and ML parameters
-- --------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sys_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- System Settings Seeding (Configurable Thresholds)
-- --------------------------------------------------------
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`) VALUES
('temp_threshold_warning', '10.0', 'Temperature warning threshold in Celsius'),
('temp_threshold_critical', '15.0', 'Temperature critical threshold in Celsius'),
('humidity_threshold_warning', '80.0', 'Humidity percentage warning threshold'),
('methane_threshold_critical', '0.05', 'Methane gas critical threshold in ppm/vol%'),
('co2_threshold_critical', '1000.0', 'CO2 critical threshold in ppm'),
('sensor_offline_seconds', '60', 'Seconds without telemetry before sensor is deemed offline'),
('alert_cooldown_seconds', '300', 'Cooldown period in seconds before repeating non-escalating risk alerts')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- --------------------------------------------------------
-- Initial Seed Users
-- Admin: admin@smartdelivery.com (AdminPassword123!)
-- Sender: sender@agrofarms.com (Sender@123)
-- Driver: driver@fastlogistics.com (Driver@123)
-- Driver 2: driver2@coldchain.com (Driver@123)
-- New User: newuser@transport.com (Welcome@123)
-- --------------------------------------------------------
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone_number`, `role`, `is_active`, `first_login`, `created_at`) VALUES
(1, 'admin@smartdelivery.com', 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d', 'System Administrator', '+91 98450 11223', 'admin', 1, 0, NOW()),
(2, 'sender@agrofarms.com', 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d', 'Sunita Rao (Agro Fresh Farms)', '+91 97410 44556', 'sender', 1, 0, NOW()),
(3, 'driver@fastlogistics.com', 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d', 'Venkatesh Reddy (Van 04)', '+91 94401 88990', 'driver', 1, 0, NOW()),
(4, 'driver2@coldchain.com', 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d', 'Anil Sharma (Truck AP-02)', '+91 91234 56789', 'driver', 1, 0, NOW()),
(5, 'newuser@transport.com', 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d', 'New Driver Onboarding', '+91 99887 76655', 'driver', 1, 1, NOW())
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- --------------------------------------------------------
-- Initial Sensor Modules (Assigned to Drivers)
-- --------------------------------------------------------
INSERT INTO `sensor_modules` (`id`, `device_id`, `device_name`, `api_key_hash`, `hardware_model`, `firmware_version`, `driver_id`, `status`, `is_active`, `registered_by`, `last_seen_at`) VALUES
(1, 'SFM-7C81A19D', 'Cold-Sense IoT Alpha', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SFM-ESP32-V1', '1.2.0', 3, 'assigned', 1, 1, NOW()),
(2, 'SFM-99214F8A', 'Bio-Respiration Sensor Beta', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SFM-ESP32-PRO', '1.2.0', 4, 'assigned', 1, 1, NOW()),
(3, 'SFM-44102B19', 'Agri-Tracker Unit Gamma (Spare)', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SFM-ESP32-V1', '1.0.0', NULL, 'available', 1, 1, NULL)
ON DUPLICATE KEY UPDATE `device_name` = VALUES(`device_name`);

-- --------------------------------------------------------
-- Initial Deliveries
-- --------------------------------------------------------
INSERT INTO `deliveries` (`id`, `delivery_code`, `sender_id`, `driver_id`, `sensor_module_id`, `food_name`, `source_location`, `destination_location`, `start_time`, `status`, `started_at`, `created_at`) VALUES
(1, 'DEL-2026-8841', 2, 3, 1, 'Fresh Cow Milk (Pasteurized 500L)', 'Anantapur, Andhra Pradesh, India', 'Hyderabad, Telangana, India', NOW() - INTERVAL 7 HOUR, 'in_transit', NOW() - INTERVAL 7 HOUR, NOW() - INTERVAL 8 HOUR),
(2, 'DEL-2026-9932', 2, 4, 2, 'Organic Ripe Tomatoes (1200 kg)', 'Madanapalle, Andhra Pradesh, India', 'Bengaluru, Karnataka, India', NOW() - INTERVAL 5 HOUR, 'in_transit', NOW() - INTERVAL 5 HOUR, NOW() - INTERVAL 6 HOUR),
(3, 'DEL-2026-4411', 2, NULL, NULL, 'Fresh Farm Strawberries (300 kg)', 'Mahabaleshwar, Maharashtra, India', 'Pune, Maharashtra, India', NOW() + INTERVAL 4 HOUR, 'pending', NULL, NOW() - INTERVAL 2 HOUR),
(4, 'DEL-2026-1029', 2, 3, 1, 'Fresh Paneer & Butter Crates (400 kg)', 'Guntur, Andhra Pradesh, India', 'Vijayawada, Andhra Pradesh, India', NOW() - INTERVAL 28 HOUR, 'completed', NOW() - INTERVAL 28 HOUR, NOW() - INTERVAL 29 HOUR)
ON DUPLICATE KEY UPDATE `food_name` = VALUES(`food_name`);

