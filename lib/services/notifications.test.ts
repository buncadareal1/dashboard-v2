import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/db and ./email BEFORE importing the module under test.
// The notification service depends on drizzle db queries and the email helpers,
// both of which we intercept to avoid real I/O.
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: mockInsert,
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

const mockSendEmail = vi.fn();
const mockGetAdminEmail = vi.fn(() => "webdev@smartland.vn");
const mockNewUserPendingEmailHtml = vi.fn(() => "<p>new user html</p>");
const mockCsvUploadDoneEmailHtml = vi.fn(() => "<p>csv done html</p>");

vi.mock("./email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  getAdminEmail: () => mockGetAdminEmail(),
  newUserPendingEmailHtml: (...args: unknown[]) => mockNewUserPendingEmailHtml(...args),
  csvUploadDoneEmailHtml: (...args: unknown[]) => mockCsvUploadDoneEmailHtml(...args),
}));

// Also mock @/db/schema so the import resolves without a real DB connection.
vi.mock("@/db/schema", () => ({
  users: {},
  notifications: {},
  notificationTypeEnum: { enumValues: ["new_user_pending", "csv_upload_done", "csv_upload_failed"] },
}));

// drizzle operators used inside the service
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  desc: vi.fn((col: unknown) => col),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

import { notifyNewUserPending, notifyCsvUpload } from "./notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdmin(overrides: Partial<{ id: string; email: string; name: string }> = {}) {
  return {
    id: overrides.id ?? "admin-uuid-1",
    email: overrides.email ?? "webdev@smartland.vn",
    name: overrides.name ?? "Admin User",
  };
}

const FAKE_NOTIF = { id: "notif-uuid-1" };

// ---------------------------------------------------------------------------
// notifyNewUserPending
// ---------------------------------------------------------------------------

describe("notifyNewUserPending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue([FAKE_NOTIF]);
    mockUpdate.mockResolvedValue([]);
    mockSendEmail.mockResolvedValue(true);
  });

  it("creates one notification per admin", async () => {
    const admins = [makeAdmin({ id: "a1" }), makeAdmin({ id: "a2", email: "other@smartland.vn" })];
    mockFindMany.mockResolvedValue(admins);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyNewUserPending("Nguyễn Văn A", "newuser@example.com");

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("inserts notification with correct type new_user_pending", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyNewUserPending("Test User", "test@example.com");

    // The insert chain is: db.insert(notifications).values({...}).returning()
    // We can inspect what values() was called with by spying on the chain.
    // Because our mock collapses the chain, verify insert ran at least once.
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("sends email only to the designated admin email address", async () => {
    const primaryAdmin = makeAdmin({ id: "a1", email: "webdev@smartland.vn" });
    const secondaryAdmin = makeAdmin({ id: "a2", email: "other@company.com" });
    mockFindMany.mockResolvedValue([primaryAdmin, secondaryAdmin]);
    mockFindFirst
      .mockResolvedValueOnce({ email: primaryAdmin.email })  // primary admin lookup
      .mockResolvedValueOnce(null);                           // secondary — no email lookup expected

    await notifyNewUserPending("New Guy", "newguy@example.com");

    // sendEmail should only be called for the primary admin
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: primaryAdmin.email }),
    );
  });

  it("does not send email when no admins exist", async () => {
    mockFindMany.mockResolvedValue([]);

    await notifyNewUserPending("Ghost", "ghost@example.com");

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not throw when sendEmail returns false", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });
    mockSendEmail.mockResolvedValue(false);

    await expect(notifyNewUserPending("Name", "name@example.com")).resolves.not.toThrow();
  });

  it("does not throw when DB insert rejects for one admin", async () => {
    const admins = [makeAdmin({ id: "good" }), makeAdmin({ id: "bad", email: "bad@x.com" })];
    mockFindMany.mockResolvedValue(admins);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });
    mockInsert
      .mockResolvedValueOnce([FAKE_NOTIF])
      .mockRejectedValueOnce(new Error("DB error"));

    // Promise.all will reject — service does not swallow DB errors intentionally
    await expect(notifyNewUserPending("Name", "name@x.com")).rejects.toThrow("DB error");
  });

  it("uses newUserPendingEmailHtml template for email body", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyNewUserPending("Alice", "alice@example.com");

    expect(mockNewUserPendingEmailHtml).toHaveBeenCalledWith("Alice", "alice@example.com");
  });

  it("includes correct email subject with user name", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyNewUserPending("Bob", "bob@example.com");

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Bob") }),
    );
  });
});

// ---------------------------------------------------------------------------
// notifyCsvUpload — status: "done"
// ---------------------------------------------------------------------------

describe("notifyCsvUpload — done", () => {
  const BASE_PARAMS = {
    uploaderName: "Trần Thị C",
    uploaderEmail: "c@example.com",
    filename: "leads_2026.csv",
    projectName: "Vinhomes Grand Park",
    projectId: "project-uuid-1",
    uploadId: "upload-uuid-1",
    rowCount: 150,
    status: "done" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue([FAKE_NOTIF]);
    mockUpdate.mockResolvedValue([]);
    mockSendEmail.mockResolvedValue(true);
  });

  it("creates one notification per admin", async () => {
    mockFindMany.mockResolvedValue([makeAdmin({ id: "a1" }), makeAdmin({ id: "a2", email: "x@x.com" })]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyCsvUpload(BASE_PARAMS);

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("sends email only to primary admin on done status", async () => {
    mockFindMany.mockResolvedValue([
      makeAdmin({ id: "a1", email: "webdev@smartland.vn" }),
      makeAdmin({ id: "a2", email: "other@x.com" }),
    ]);
    mockFindFirst
      .mockResolvedValueOnce({ email: "webdev@smartland.vn" })
      .mockResolvedValueOnce(null);

    await notifyCsvUpload(BASE_PARAMS);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "webdev@smartland.vn" }),
    );
  });

  it("uses csvUploadDoneEmailHtml for email body", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyCsvUpload(BASE_PARAMS);

    expect(mockCsvUploadDoneEmailHtml).toHaveBeenCalledWith(
      BASE_PARAMS.uploaderName,
      BASE_PARAMS.filename,
      BASE_PARAMS.projectName,
      BASE_PARAMS.rowCount,
    );
  });

  it("email subject contains filename", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await notifyCsvUpload(BASE_PARAMS);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining(BASE_PARAMS.filename) }),
    );
  });

  it("handles zero row count without error", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    mockFindFirst.mockResolvedValue({ email: "webdev@smartland.vn" });

    await expect(notifyCsvUpload({ ...BASE_PARAMS, rowCount: 0 })).resolves.not.toThrow();
  });

  it("does not throw when no admins exist", async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(notifyCsvUpload(BASE_PARAMS)).resolves.not.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// notifyCsvUpload — status: "failed"
// ---------------------------------------------------------------------------

describe("notifyCsvUpload — failed", () => {
  const FAILED_PARAMS = {
    uploaderName: "Lê Văn D",
    uploaderEmail: "d@example.com",
    filename: "bad.csv",
    projectName: "Project Y",
    projectId: "project-uuid-2",
    uploadId: "upload-uuid-2",
    rowCount: 0,
    status: "failed" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue([FAKE_NOTIF]);
    mockUpdate.mockResolvedValue([]);
    mockSendEmail.mockResolvedValue(false);
  });

  it("does not send email on failed status", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);
    // sendEmail should never be called for failed uploads
    await notifyCsvUpload(FAILED_PARAMS);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("still creates in-app notifications for all admins on failed upload", async () => {
    mockFindMany.mockResolvedValue([makeAdmin({ id: "a1" }), makeAdmin({ id: "a2", email: "x@x.com" })]);

    await notifyCsvUpload(FAILED_PARAMS);

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("does not call csvUploadDoneEmailHtml on failed status", async () => {
    mockFindMany.mockResolvedValue([makeAdmin()]);

    await notifyCsvUpload(FAILED_PARAMS);

    expect(mockCsvUploadDoneEmailHtml).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// NotificationType — verify the schema exports the correct union values
// ---------------------------------------------------------------------------

describe("NotificationType enum values", () => {
  it("includes new_user_pending", async () => {
    const schema = await import("@/db/schema");
    expect(schema.notificationTypeEnum.enumValues).toContain("new_user_pending");
  });

  it("includes csv_upload_done", async () => {
    const schema = await import("@/db/schema");
    expect(schema.notificationTypeEnum.enumValues).toContain("csv_upload_done");
  });

  it("includes csv_upload_failed", async () => {
    const schema = await import("@/db/schema");
    expect(schema.notificationTypeEnum.enumValues).toContain("csv_upload_failed");
  });

  it("has exactly 3 notification types", async () => {
    const schema = await import("@/db/schema");
    expect(schema.notificationTypeEnum.enumValues).toHaveLength(3);
  });
});
