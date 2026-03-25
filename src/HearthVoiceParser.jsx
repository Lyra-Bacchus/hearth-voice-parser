import { useState, useRef, useCallback } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SPEAKER_COLORS = [
  { bg: "#2D1B2E", text: "#E8B4CB", accent: "#C77DA3", label: "Plum" },
  { bg: "#1B2E2D", text: "#B4E8D4", accent: "#5BB89A", label: "Sage" },
  { bg: "#2E2A1B", text: "#E8D4B4", accent: "#C4944A", label: "Amber" },
  { bg: "#1B1E2E", text: "#B4C8E8", accent: "#5B7EC4", label: "Slate" },
];

const DEFAULT_SPEAKERS = [
  { name: "", examples: "" },
  { name: "", examples: "" },
];

// ── Parsing utilities ──────────────────────────────────────────────

function chunkMessages(messages, chunkSize = 40) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }
  return chunks;
}

function buildSystemPrompt(speakers) {
  const speakerDescriptions = speakers
    .filter((s) => s.name.trim())
    .map((s, i) => {
      const exampleBlock = s.examples.trim()
        ? `\nExample messages from ${s.name}:\n${s.examples.trim()}`
        : "";
      return `Speaker ${i + 1}: "${s.name}"${exampleBlock}`;
    })
    .join("\n\n");

  return `You are a conversation classifier. You will receive a block of chat messages and must label each one with the speaker's name.

The speakers in this conversation are:

${speakerDescriptions}

RULES:
- Return ONLY a JSON array of objects, each with "index" (the message number starting from 0), "speaker" (exact name from the list above), and "confidence" (number 0-1).
- Use voice patterns, vocabulary, tone, sentence structure, and context to determine who is speaking.
- If a message is ambiguous, still make your best guess but reflect it in a lower confidence score.
- Do NOT include any text outside the JSON array. No preamble, no markdown fences, no explanation.`;
}

function buildUserPrompt(messages, offset = 0) {
  return `Classify each message below. Return a JSON array with one entry per message.

${messages.map((m, i) => `[${offset + i}] ${m}`).join("\n")}`;
}

// ── Components ─────────────────────────────────────────────────────

function SpeakerSetup({ speakers, setSpeakers, onStart }) {
  const addSpeaker = () => {
    if (speakers.length < 4) {
      setSpeakers([...speakers, { name: "", examples: "" }]);
    }
  };

  const removeSpeaker = (idx) => {
    if (speakers.length > 2) {
      setSpeakers(speakers.filter((_, i) => i !== idx));
    }
  };

  const update = (idx, field, value) => {
    const next = [...speakers];
    next[idx] = { ...next[idx], [field]: value };
    setSpeakers(next);
  };

  const canStart = speakers.filter((s) => s.name.trim()).length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "22px",
            fontWeight: 600,
            color: "#E8D4C0",
            margin: 0,
          }}
        >
          Who lives in this conversation?
        </h2>
        {speakers.length < 4 && (
          <button
            onClick={addSpeaker}
            style={{
              background: "rgba(196, 148, 74, 0.15)",
              border: "1px solid rgba(196, 148, 74, 0.3)",
              borderRadius: "8px",
              color: "#C4944A",
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.target.style.background = "rgba(196, 148, 74, 0.25)")
            }
            onMouseLeave={(e) =>
              (e.target.style.background = "rgba(196, 148, 74, 0.15)")
            }
          >
            + Add speaker
          </button>
        )}
      </div>

      {speakers.map((speaker, idx) => (
        <div
          key={idx}
          style={{
            background: `${SPEAKER_COLORS[idx].bg}88`,
            border: `1px solid ${SPEAKER_COLORS[idx].accent}33`,
            borderRadius: "12px",
            padding: "16px",
            position: "relative",
          }}
        >
          {speakers.length > 2 && (
            <button
              onClick={() => removeSpeaker(idx)}
              style={{
                position: "absolute",
                top: "10px",
                right: "12px",
                background: "none",
                border: "none",
                color: "#665",
                cursor: "pointer",
                fontSize: "18px",
                lineHeight: 1,
                padding: "2px 6px",
              }}
            >
              ×
            </button>
          )}
          <div style={{ marginBottom: "10px" }}>
            <label
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: SPEAKER_COLORS[idx].accent,
                marginBottom: "6px",
                display: "block",
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={speaker.name}
              onChange={(e) => update(idx, "name", e.target.value)}
              placeholder={
                idx === 0
                  ? "e.g. Genie"
                  : idx === 1
                    ? "e.g. Sullivan"
                    : "e.g. Enzo"
              }
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${SPEAKER_COLORS[idx].accent}44`,
                borderRadius: "8px",
                padding: "10px 12px",
                color: SPEAKER_COLORS[idx].text,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: SPEAKER_COLORS[idx].accent,
                marginBottom: "6px",
                display: "block",
              }}
            >
              Example messages{" "}
              <span style={{ opacity: 0.5, textTransform: "none" }}>
                (one per line — helps the AI learn their voice)
              </span>
            </label>
            <textarea
              value={speaker.examples}
              onChange={(e) => update(idx, "examples", e.target.value)}
              placeholder={`Paste 3-5 example messages from ${speaker.name || "this speaker"}...`}
              rows={3}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${SPEAKER_COLORS[idx].accent}44`,
                borderRadius: "8px",
                padding: "10px 12px",
                color: SPEAKER_COLORS[idx].text,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      ))}

      <button
        onClick={onStart}
        disabled={!canStart}
        style={{
          background: canStart
            ? "linear-gradient(135deg, #C4944A, #8B6914)"
            : "rgba(100,100,80,0.2)",
          border: "none",
          borderRadius: "10px",
          color: canStart ? "#1A1614" : "#665",
          padding: "14px 24px",
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "17px",
          fontWeight: 700,
          cursor: canStart ? "pointer" : "not-allowed",
          letterSpacing: "0.5px",
          transition: "all 0.3s",
        }}
      >
        Continue →
      </button>
    </div>
  );
}

function ChatInput({ onSubmit }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setText(ev.target.result);
      reader.readAsText(f);
    }
  };

  const canSubmit = text.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "22px",
          fontWeight: 600,
          color: "#E8D4C0",
          margin: 0,
        }}
      >
        Paste the conversation
      </h2>
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px",
          color: "#998877",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Raw text, JSON export, or any messy format — one message per line works
        best. The AI will figure out the structure.
      </p>

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            background: "rgba(196, 148, 74, 0.1)",
            border: "1px dashed rgba(196, 148, 74, 0.3)",
            borderRadius: "8px",
            color: "#C4944A",
            padding: "8px 16px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
          }}
        >
          {file ? `📎 ${file.name}` : "Upload file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.json,.csv,.md"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            color: "#665",
          }}
        >
          .txt, .json, .csv, .md
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste conversation here...\n\nFormats that work:\n- Plain text (one message per line)\n- "Speaker: message" format\n- Raw JSON exports\n- Messy copy-paste — we'll sort it out`}
        rows={12}
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(196, 148, 74, 0.2)",
          borderRadius: "12px",
          padding: "16px",
          color: "#E8D4C0",
          fontFamily: "'DM Mono', monospace",
          fontSize: "13px",
          lineHeight: 1.6,
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => onSubmit(text)}
          disabled={!canSubmit}
          style={{
            flex: 1,
            background: canSubmit
              ? "linear-gradient(135deg, #C4944A, #8B6914)"
              : "rgba(100,100,80,0.2)",
            border: "none",
            borderRadius: "10px",
            color: canSubmit ? "#1A1614" : "#665",
            padding: "14px",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "17px",
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "all 0.3s",
          }}
        >
          Parse conversation
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ current, total, status }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px",
          color: "#998877",
        }}
      >
        <span>{status}</span>
        <span>
          {current}/{total} messages
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: "6px",
          background: "rgba(196, 148, 74, 0.1)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #C4944A, #E8D4C0)",
            borderRadius: "3px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function ResultsView({ results, speakers, onReset, onEditSpeaker }) {
  const [view, setView] = useState("transcript");
  const [editIdx, setEditIdx] = useState(null);

  const speakerMap = {};
  speakers.forEach((s, i) => {
    if (s.name.trim()) speakerMap[s.name.trim().toLowerCase()] = i;
  });

  const getColor = (speakerName) => {
    const idx = speakerMap[speakerName?.toLowerCase()] ?? 0;
    return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
  };

  const stats = {};
  results.forEach((r) => {
    if (!stats[r.speaker]) stats[r.speaker] = { count: 0, lowConf: 0 };
    stats[r.speaker].count++;
    if (r.confidence < 0.7) stats[r.speaker].lowConf++;
  });

  const jsonOutput = JSON.stringify(
    results.map((r) => ({
      speaker: r.speaker,
      message: r.message,
      confidence: r.confidence,
    })),
    null,
    2
  );

  const hearthJson = JSON.stringify(
    {
      format: "hearth-memory-seed",
      version: 1,
      speakers: speakers.filter((s) => s.name.trim()).map((s) => s.name.trim()),
      messages: results.map((r, i) => ({
        index: i,
        speaker: r.speaker,
        content: r.message,
        confidence: r.confidence,
      })),
    },
    null,
    2
  );

  const downloadFile = (content, filename, type = "application/json") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "22px",
            fontWeight: 600,
            color: "#E8D4C0",
            margin: 0,
          }}
        >
          Parsed — {results.length} messages
        </h2>
        <button
          onClick={onReset}
          style={{
            background: "rgba(196, 148, 74, 0.1)",
            border: "1px solid rgba(196, 148, 74, 0.2)",
            borderRadius: "8px",
            color: "#C4944A",
            padding: "6px 14px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
          }}
        >
          ← New parse
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {Object.entries(stats).map(([name, s]) => {
          const color = getColor(name);
          return (
            <div
              key={name}
              style={{
                background: `${color.bg}cc`,
                border: `1px solid ${color.accent}44`,
                borderRadius: "10px",
                padding: "10px 16px",
                flex: "1 1 120px",
                minWidth: "120px",
              }}
            >
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: color.text,
                }}
              >
                {name}
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: color.accent,
                  marginTop: "2px",
                }}
              >
                {s.count} messages
                {s.lowConf > 0 && ` · ${s.lowConf} uncertain`}
              </div>
            </div>
          );
        })}
      </div>

      {/* View Toggle */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "10px",
          padding: "4px",
          alignSelf: "flex-start",
        }}
      >
        {["transcript", "json", "hearth"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              background:
                view === v ? "rgba(196, 148, 74, 0.2)" : "transparent",
              border: "none",
              borderRadius: "8px",
              color: view === v ? "#E8D4C0" : "#776655",
              padding: "8px 16px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: view === v ? 600 : 400,
              transition: "all 0.2s",
            }}
          >
            {v === "transcript"
              ? "Transcript"
              : v === "json"
                ? "Raw JSON"
                : "Hearth Seed"}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === "transcript" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            maxHeight: "500px",
            overflowY: "auto",
            padding: "4px",
          }}
        >
          {results.map((r, i) => {
            const color = getColor(r.speaker);
            const isEditing = editIdx === i;
            return (
              <div
                key={i}
                onClick={() => setEditIdx(isEditing ? null : i)}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: isEditing
                    ? "rgba(196, 148, 74, 0.08)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: color.accent,
                    minWidth: "80px",
                    flexShrink: 0,
                    paddingTop: "2px",
                  }}
                >
                  {r.speaker}
                  {r.confidence < 0.7 && (
                    <span
                      style={{
                        display: "inline-block",
                        marginLeft: "4px",
                        fontSize: "10px",
                        opacity: 0.6,
                      }}
                      title={`Confidence: ${Math.round(r.confidence * 100)}%`}
                    >
                      ?
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "14px",
                    color: "#D4C4B0",
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {r.message}
                </span>
                {isEditing && (
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      flexShrink: 0,
                    }}
                  >
                    {speakers
                      .filter((s) => s.name.trim())
                      .map((s) => {
                        const sc = getColor(s.name.trim());
                        return (
                          <button
                            key={s.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSpeaker(i, s.name.trim());
                              setEditIdx(null);
                            }}
                            style={{
                              background:
                                r.speaker === s.name.trim()
                                  ? sc.accent
                                  : `${sc.bg}`,
                              border: `1px solid ${sc.accent}66`,
                              borderRadius: "6px",
                              color:
                                r.speaker === s.name.trim()
                                  ? "#1A1614"
                                  : sc.text,
                              padding: "4px 10px",
                              cursor: "pointer",
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            {s.name.trim()}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "json" && (
        <pre
          style={{
            background: "rgba(0,0,0,0.4)",
            borderRadius: "12px",
            padding: "16px",
            color: "#B4C8A0",
            fontFamily: "'DM Mono', monospace",
            fontSize: "12px",
            lineHeight: 1.5,
            maxHeight: "400px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {jsonOutput}
        </pre>
      )}

      {view === "hearth" && (
        <pre
          style={{
            background: "rgba(0,0,0,0.4)",
            borderRadius: "12px",
            padding: "16px",
            color: "#B4C8A0",
            fontFamily: "'DM Mono', monospace",
            fontSize: "12px",
            lineHeight: 1.5,
            maxHeight: "400px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {hearthJson}
        </pre>
      )}

      {/* Download buttons */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            const transcript = results
              .map((r) => `${r.speaker}: ${r.message}`)
              .join("\n");
            downloadFile(transcript, "parsed-transcript.txt", "text/plain");
          }}
          style={{
            flex: 1,
            background: "rgba(196, 148, 74, 0.12)",
            border: "1px solid rgba(196, 148, 74, 0.25)",
            borderRadius: "10px",
            color: "#C4944A",
            padding: "12px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            minWidth: "140px",
          }}
        >
          ↓ Transcript (.txt)
        </button>
        <button
          onClick={() => downloadFile(jsonOutput, "parsed-raw.json")}
          style={{
            flex: 1,
            background: "rgba(196, 148, 74, 0.12)",
            border: "1px solid rgba(196, 148, 74, 0.25)",
            borderRadius: "10px",
            color: "#C4944A",
            padding: "12px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            minWidth: "140px",
          }}
        >
          ↓ Raw JSON
        </button>
        <button
          onClick={() => downloadFile(hearthJson, "hearth-seed.json")}
          style={{
            flex: 1,
            background:
              "linear-gradient(135deg, rgba(196,148,74,0.2), rgba(139,105,20,0.2))",
            border: "1px solid rgba(196, 148, 74, 0.35)",
            borderRadius: "10px",
            color: "#E8D4C0",
            padding: "12px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            minWidth: "140px",
          }}
        >
          ↓ Hearth Seed
        </button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────

export default function HearthVoiceParser() {
  const [step, setStep] = useState("speakers"); // speakers | input | parsing | results
  const [speakers, setSpeakers] = useState(DEFAULT_SPEAKERS);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    status: "",
  });
  const [error, setError] = useState(null);

  const parseConversation = useCallback(
    async (rawText) => {
      setStep("parsing");
      setError(null);

      const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setError("No messages found in the input.");
        setStep("input");
        return;
      }

      const chunks = chunkMessages(lines, 40);
      const allResults = [];
      setProgress({
        current: 0,
        total: lines.length,
        status: "Classifying...",
      });

      const systemPrompt = buildSystemPrompt(speakers);

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const offset = ci * 40;
        const userPrompt = buildUserPrompt(chunk, offset);

        try {
          const response = await fetch(
            `${SUPABASE_URL}/functions/v1/voice-parser-classify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                system: systemPrompt,
                userPrompt,
              }),
            }
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
              errData.error || `API error: ${response.status}`
            );
          }

          const data = await response.json();
          const parsed = data.results;

          parsed.forEach((entry) => {
            const localIdx = entry.index - offset;
            if (localIdx >= 0 && localIdx < chunk.length) {
              allResults.push({
                speaker: entry.speaker,
                message: chunk[localIdx],
                confidence: entry.confidence ?? 0.8,
              });
            }
          });
        } catch (err) {
          console.error("Chunk error:", err);
          chunk.forEach((msg) => {
            allResults.push({
              speaker: "Unknown",
              message: msg,
              confidence: 0,
            });
          });
        }

        setProgress({
          current: Math.min(offset + chunk.length, lines.length),
          total: lines.length,
          status:
            ci < chunks.length - 1
              ? `Processing batch ${ci + 2} of ${chunks.length}...`
              : "Finishing up...",
        });
      }

      setResults(allResults);
      setStep("results");
    },
    [speakers]
  );

  const handleEditSpeaker = (idx, newSpeaker) => {
    setResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], speaker: newSpeaker, confidence: 1 };
      return next;
    });
  };

  const reset = () => {
    setStep("speakers");
    setResults([]);
    setError(null);
    setSpeakers(DEFAULT_SPEAKERS);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #1A1614 0%, #0D0B0A 50%, #141210 100%)",
        display: "flex",
        justifyContent: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: "12px" }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "32px",
              fontWeight: 400,
              color: "#E8D4C0",
              margin: 0,
              letterSpacing: "2px",
            }}
          >
            Voice Parser
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              color: "#776655",
              marginTop: "6px",
              letterSpacing: "0.5px",
            }}
          >
            Sort out who said what
          </p>
        </div>

        {/* Steps indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            alignItems: "center",
          }}
        >
          {["speakers", "input", "results"].map((s, i) => (
            <div
              key={s}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background:
                    step === s || (step === "parsing" && s === "input")
                      ? "#C4944A"
                      : ["speakers", "input", "parsing", "results"].indexOf(
                            step
                          ) >
                          ["speakers", "input", "results"].indexOf(s)
                        ? "#C4944A66"
                        : "#332E28",
                  transition: "all 0.3s",
                }}
              />
              {i < 2 && (
                <div
                  style={{
                    width: "40px",
                    height: "1px",
                    background: "#332E28",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div
          style={{
            background: "rgba(26, 22, 20, 0.6)",
            border: "1px solid rgba(196, 148, 74, 0.1)",
            borderRadius: "16px",
            padding: "24px",
            backdropFilter: "blur(8px)",
          }}
        >
          {step === "speakers" && (
            <SpeakerSetup
              speakers={speakers}
              setSpeakers={setSpeakers}
              onStart={() => setStep("input")}
            />
          )}

          {step === "input" && (
            <ChatInput onSubmit={parseConversation} speakers={speakers} />
          )}

          {step === "parsing" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                alignItems: "center",
                padding: "32px 0",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "3px solid rgba(196, 148, 74, 0.2)",
                  borderTopColor: "#C4944A",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: "100%" }}>
                <ProgressBar {...progress} />
              </div>
              {error && (
                <p
                  style={{
                    color: "#E88B8B",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "14px",
                  }}
                >
                  {error}
                </p>
              )}
            </div>
          )}

          {step === "results" && (
            <ResultsView
              results={results}
              speakers={speakers}
              onReset={reset}
              onEditSpeaker={handleEditSpeaker}
            />
          )}
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            color: "#443E38",
            letterSpacing: "1px",
          }}
        >
          A HEARTH TOOL
        </p>
      </div>
    </div>
  );
}
