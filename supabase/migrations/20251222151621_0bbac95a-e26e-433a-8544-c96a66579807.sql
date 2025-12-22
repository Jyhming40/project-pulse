-- 1. Create enums for new fields
CREATE TYPE public.installation_type AS ENUM (
  '畜牧舍',
  '農業設施',
  '農棚',
  '地面型',
  '農舍',
  '住宅',
  '廠辦',
  '特目用建物',
  '特登工廠',
  '集合住宅',
  '其他設施',
  '新建物（農業）',
  '新建物（其他）'
);

CREATE TYPE public.grid_connection_type AS ENUM (
  '高壓併低壓側',
  '低壓',
  '併內線－躉售',
  '併內線－自發自用'
);

CREATE TYPE public.power_phase_type AS ENUM (
  '單相三線式',
  '三相三線式',
  '三相四線式'
);

CREATE TYPE public.power_voltage AS ENUM (
  '220V',
  '220V / 380V',
  '380V',
  '440V',
  '480V'
);

CREATE TYPE public.pole_status AS ENUM (
  '已立桿',
  '未立桿',
  '基礎完成',
  '無須',
  '需移桿',
  '亭置式'
);

CREATE TYPE public.construction_status AS ENUM (
  '已開工',
  '尚未開工',
  '已掛錶',
  '待掛錶',
  '暫緩',
  '取消'
);

-- 2. Add new columns to projects table
ALTER TABLE public.projects
  ADD COLUMN installation_type installation_type,
  ADD COLUMN actual_installed_capacity numeric,
  ADD COLUMN taipower_pv_id text,
  ADD COLUMN grid_connection_type grid_connection_type,
  ADD COLUMN power_phase_type power_phase_type,
  ADD COLUMN power_voltage power_voltage,
  ADD COLUMN pole_status pole_status,
  ADD COLUMN construction_status construction_status DEFAULT '尚未開工'::construction_status;