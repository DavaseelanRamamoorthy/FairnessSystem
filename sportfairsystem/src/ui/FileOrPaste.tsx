"use client";

import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";

/**
 * Upload the JSON file Claude wrote (or a PDF, when allowed), or paste JSON.
 * Hands back text for JSON and base64 for PDFs.
 */
export function FileOrPaste({
  label,
  acceptPdf,
  onText,
  onPdf
}: {
  label: string;
  acceptPdf?: boolean;
  onText: (text: string) => void;
  onPdf?: (base64: string) => void;
}) {
  const [pasted, setPasted] = useState("");

  const readFile = async (file: File) => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      onPdf?.(btoa(binary));
    } else {
      onText(await file.text());
    }
  };

  return (
    <Stack spacing={1.5}>
      <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />} sx={{ alignSelf: "flex-start" }}>
        {label}
        <input
          hidden
          type="file"
          accept={acceptPdf ? ".json,application/json,.pdf,application/pdf" : ".json,application/json"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
      </Button>
      <TextField
        multiline
        minRows={3}
        maxRows={8}
        size="small"
        label="…or paste the JSON here"
        value={pasted}
        onChange={(event) => setPasted(event.target.value)}
      />
      <Button size="small" disabled={!pasted.trim()} sx={{ alignSelf: "flex-start" }} onClick={() => onText(pasted)}>
        Use pasted JSON
      </Button>
    </Stack>
  );
}

/** Parses JSON and validates it, returning a readable problem list on failure. */
export function parseJson<T>(text: string, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } }) {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false as const, problems: ["That isn't valid JSON."] };
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true as const, data: result.data };
  return {
    ok: false as const,
    problems: result.error.issues.slice(0, 8).map((issue) => `${issue.path.map(String).join(".") || "file"}: ${issue.message}`)
  };
}
