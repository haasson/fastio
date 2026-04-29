-- Migration 189: appointment_settings.resource_mode
--
-- Тип ресурсов в записях: только сотрудники (staff), только объекты (objects)
-- или и то и другое (both). Влияет на UI и доступные вкладки в /appointments.

CREATE TYPE appointment_resource_mode AS ENUM ('staff', 'objects', 'both');

ALTER TABLE appointment_settings
  ADD COLUMN resource_mode appointment_resource_mode NOT NULL DEFAULT 'staff';
