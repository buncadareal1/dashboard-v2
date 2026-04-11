/**
 * Adapter interfaces — normalize input từ các nguồn khác nhau
 * (CSV Facebook, CSV Bitrix, Webhook) thành format thống nhất.
 */

export type FacebookLeadInput = {
  source: "csv_facebook" | "webhook_facebook";
  fullName: string;
  fullNameNormalized: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  fbLeadId: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
  formName: string | null;
  fbCreatedAt: Date | null;
  amountSpent?: number | null;
  rawStage?: string | null;
  formAnswers: Record<string, string>;
};

export type BitrixUpdateInput = {
  source: "csv_bitrix" | "webhook_bitrix";
  fullName: string;
  fullNameNormalized: string;
  rawStage: string | null;
  employeeName: string | null;
  employeeNameNormalized: string | null;
  employeeTeam: string | null;
  bitrixUpdatedAt: Date | null;
  comment: string | null;
};
