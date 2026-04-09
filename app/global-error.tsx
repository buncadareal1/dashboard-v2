"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <html lang="vi">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          backgroundColor: "#fafafa",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
            border: "1px dashed #ddd",
            borderRadius: 12,
            padding: "2rem",
            backgroundColor: "white",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: 8 }}>
            Đã có lỗi xảy ra
          </h1>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: 24 }}>
            {isDev
              ? error.message
              : "Hệ thống gặp sự cố nghiêm trọng. Vui lòng thử lại sau."}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#111",
                color: "white",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Thử lại
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid #ddd",
                color: "#111",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Về trang chủ
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
