/* Bantu Beres Guru AI — browser-side GroqCloud client.
 * A customer's key remains in their existing local browser storage and is forwarded
 * only to the same-origin Netlify Function for the specific request.
 */
(function (global) {
  "use strict";
  const PREFERRED = [
    "openai/gpt-oss-120b", "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b", "llama-3.1-8b-instant",
    "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"
  ];
  const MODEL_EXCLUSIONS = /guard|whisper|tts|speech|transcri|audio|embed|vision|image|moderation|safety/i;
  const cache = new Map();
  function validKey(key) { return /^gsk_[A-Za-z0-9_-]{20,}$/.test(String(key || "").trim()); }
  function cleanMessage(error, status) {
    if (status === 401 || status === 403) return "API key GroqCloud ditolak. Buat key baru di GroqCloud Console.";
    if (status === 429) return "Batas pemakaian GroqCloud tercapai. Coba lagi setelah kuota tersedia.";
    if (status === 408 || status >= 500) return "Layanan GroqCloud sementara tidak tersedia. Coba lagi.";
    return String(error || "Permintaan GroqCloud gagal.").slice(0, 260);
  }
  async function send(key, action, data) {
    if (!validKey(key)) throw new Error("Gunakan API key GroqCloud yang diawali gsk_. Key Gemini lama tidak berlaku.");
    let response;
    try {
      response = await fetch("/.netlify/functions/groq-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(52000),
        body: JSON.stringify({ key: key.trim(), action, ...data })
      });
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") throw new Error("Koneksi AI melewati batas waktu.");
      throw new Error("Gagal menjangkau fungsi Netlify AI. Pastikan situs sudah menerbitkan Netlify Function groq-api.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(cleanMessage(payload.error, response.status));
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  async function models(key) {
    if (!validKey(key)) throw new Error("Masukkan API key GroqCloud yang diawali gsk_.");
    const found = cache.get(key);
    if (found && found.expires > Date.now()) return found.list;
    const payload = await send(key, "models", {});
    const ids = (payload.models || []).filter(x => typeof x === "string" && !MODEL_EXCLUSIONS.test(x));
    const unique = [...new Set(ids)];
    const ranked = [
      ...PREFERRED.filter(id => unique.includes(id)),
      ...unique.filter(id => !PREFERRED.includes(id))
    ];
    if (!ranked.length) throw new Error("Key ini tidak mempunyai model percakapan GroqCloud yang tersedia.");
    cache.set(key, { list: ranked, expires: Date.now() + 300000 });
    return ranked;
  }
  async function chat(prompt, key, options = {}) {
    const text = String(prompt || "").trim();
    if (!text) throw new Error("Tulis pertanyaan atau instruksi terlebih dahulu.");
    const allowed = await models(key);
    let lastError;
    for (const model of allowed) {
      try {
        const result = await send(key, "chat", {
          model, messages: [
            { role: "system", content: String(options.system || "Anda adalah asisten profesional bagi guru Indonesia. Jangan mengarang informasi siswa. Guru memeriksa hasil akhir.").slice(0, 18000) },
            { role: "user", content: text.slice(0, 80000) }
          ],
          temperature: Number.isFinite(options.temperature) ? options.temperature : 0.4,
          max_tokens: Number.isInteger(options.maxTokens) ? Math.min(options.maxTokens, 8192) : 4096
        });
        const reply = String(result.reply || "").trim();
        if (!reply) throw new Error("Model tidak menghasilkan teks.");
        return { text: reply, model };
      } catch (e) {
        lastError = e;
        if (e.status === 401 || e.status === 403 || e.status === 429) break;
        if (e.status && ![400, 404, 408, 500, 502, 503, 504].includes(e.status)) break;
      }
    }
    throw lastError || new Error("Tidak ada model GroqCloud yang dapat merespons.");
  }
  async function verify(key) {
    const result = await chat("Balas hanya: TERHUBUNG", key, { maxTokens: 64, temperature: 0 });
    return result.model;
  }
  global.GuruGroq = Object.freeze({ validKey, models, chat, verify, version: "2026-11-08" });
})(window);
