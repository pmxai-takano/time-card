import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseMonthWorkSystems,
  parseWorkSystem,
  type WorkSystem,
} from "@/lib/work-system";

export type WorkSystemDefaults = {
  userDefault: WorkSystem;
  monthWorkSystems: Record<string, WorkSystem>;
};

/**
 * 勤務体系設定を取得。month_work_systems 未マイグレーション時は空マップでフォールバック。
 */
export async function fetchWorkSystemDefaults(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkSystemDefaults> {
  const full = await supabase
    .from("attendance_defaults")
    .select("work_system, month_work_systems")
    .eq("user_id", userId)
    .maybeSingle();

  if (!full.error) {
    return {
      userDefault: parseWorkSystem(full.data?.work_system),
      monthWorkSystems: parseMonthWorkSystems(full.data?.month_work_systems),
    };
  }

  const legacy = await supabase
    .from("attendance_defaults")
    .select("work_system")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    userDefault: parseWorkSystem(legacy.data?.work_system),
    monthWorkSystems: {},
  };
}
