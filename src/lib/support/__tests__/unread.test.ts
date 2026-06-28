import { describe, it, expect } from "vitest";
import { computeHasUnread } from "../unread";

const ownerMsg = (createdAt: Date) => ({
  authorId: "owner-1",
  authorRole: "OWNER" as const,
  createdAt,
});

const adminMsg = (createdAt: Date) => ({
  authorId: "admin-1",
  authorRole: "SUPER_ADMIN" as const,
  createdAt,
});

describe("computeHasUnread", () => {
  describe("empty state", () => {
    it("returns false when there are no messages", () => {
      const result = computeHasUnread([], { role: "OWNER" }, undefined);
      expect(result).toBe(false);
    });
  });

  describe("owner viewer", () => {
    it("returns true when admin message exists and there is no read record", () => {
      const result = computeHasUnread(
        [adminMsg(new Date("2026-06-01"))],
        { role: "OWNER" },
        undefined,
      );
      expect(result).toBe(true);
    });

    it("returns false when only owner-authored messages exist", () => {
      const result = computeHasUnread(
        [ownerMsg(new Date("2026-06-01"))],
        { role: "OWNER" },
        undefined,
      );
      expect(result).toBe(false);
    });

    it("returns false when admin message was already read", () => {
      const result = computeHasUnread(
        [adminMsg(new Date("2026-06-01"))],
        { role: "OWNER" },
        new Date("2026-06-02"),
      );
      expect(result).toBe(false);
    });

    it("returns true when admin message is newer than last read", () => {
      const result = computeHasUnread(
        [adminMsg(new Date("2026-06-03"))],
        { role: "OWNER" },
        new Date("2026-06-02"),
      );
      expect(result).toBe(true);
    });

    it("treats lastReadAt equal to message.createdAt as already read (strict >)", () => {
      const ts = new Date("2026-06-02T10:00:00Z");
      const result = computeHasUnread(
        [adminMsg(ts)],
        { role: "OWNER" },
        ts,
      );
      expect(result).toBe(false);
    });

    it("returns true when last message is owner-authored but an earlier admin message is unread", () => {
      const result = computeHasUnread(
        [
          adminMsg(new Date("2026-06-03")),
          ownerMsg(new Date("2026-06-04")),
        ],
        { role: "OWNER" },
        new Date("2026-06-02"),
      );
      expect(result).toBe(true);
    });
  });

  describe("admin viewer", () => {
    it("returns true when owner message exists and there is no read record", () => {
      const result = computeHasUnread(
        [ownerMsg(new Date("2026-06-01"))],
        { role: "SUPER_ADMIN" },
        undefined,
      );
      expect(result).toBe(true);
    });

    it("returns false when only admin-authored messages exist", () => {
      const result = computeHasUnread(
        [adminMsg(new Date("2026-06-01"))],
        { role: "SUPER_ADMIN" },
        undefined,
      );
      expect(result).toBe(false);
    });

    it("returns false when owner message was already read", () => {
      const result = computeHasUnread(
        [ownerMsg(new Date("2026-06-01"))],
        { role: "SUPER_ADMIN" },
        new Date("2026-06-02"),
      );
      expect(result).toBe(false);
    });

    it("returns true when owner message is newer than last read", () => {
      const result = computeHasUnread(
        [ownerMsg(new Date("2026-06-03"))],
        { role: "SUPER_ADMIN" },
        new Date("2026-06-02"),
      );
      expect(result).toBe(true);
    });
  });

  describe("multiple messages", () => {
    it("returns true if any other-side message is unread", () => {
      const result = computeHasUnread(
        [
          ownerMsg(new Date("2026-06-01")),
          adminMsg(new Date("2026-06-03")),
          ownerMsg(new Date("2026-06-04")),
        ],
        { role: "OWNER" },
        new Date("2026-06-02"),
      );
      expect(result).toBe(true);
    });

    it("returns false when all other-side messages are older than last read", () => {
      const result = computeHasUnread(
        [
          adminMsg(new Date("2026-06-01")),
          ownerMsg(new Date("2026-06-02")),
          adminMsg(new Date("2026-06-02")),
        ],
        { role: "OWNER" },
        new Date("2026-06-03"),
      );
      expect(result).toBe(false);
    });
  });
});
