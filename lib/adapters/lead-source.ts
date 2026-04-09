/**
 * LeadSource interface — adapter pattern cho Phase 1 (CSV) + Phase 2 (Webhook).
 *
 * Phase 1 implementation: parser-facebook.ts + parser-bitrix.ts trả về DTO này.
 * Phase 2 implementation: webhook handler chuyển payload Meta/Bitrix → cùng DTO.
 *
 * Upsert service nhận DTO chuẩn này, không quan tâm nguồn từ đâu.
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
  formAnswers: Record<string, string>;
};

export type BitrixUpdateInput = {
  source: "csv_bitrix" | "webhook_bitrix";
  fullName: string;
  fullNameNormalized: string;
  /** Raw stage string từ Bitrix — sẽ resolve qua stage_aliases trong upsert service */
  rawStage: string | null;
  employeeName: string | null;
  employeeNameNormalized: string | null;
  employeeTeam: string | null;
  bitrixUpdatedAt: Date | null;
  comment: string | null;
};

export type LeadInput = FacebookLeadInput | BitrixUpdateInput;
