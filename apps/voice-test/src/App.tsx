import { useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";

/**
 * Harnais de test jetable pour valider le pipeline vocal (ElevenLabs -> voice-llm-proxy -> Claude)
 * dans un navigateur, sans dépendre d'un build mobile. Pas destiné à devenir le vrai dashboard web
 * (voir docs/plan.md : apps/web sera un Next.js séparé pour le dashboard manager).
 */
const API_URL = "https://prospector-production-882f.up.railway.app";
const AGENT_ID = "agent_2801kzrj2sd9ey0aqfze08svsh99";

interface Item {
  id: string;
  label?: string;
  name?: string;
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sectors, setSectors] = useState<Item[]>([]);
  const [personas, setPersonas] = useState<Item[]>([]);
  const [objectionLevels, setObjectionLevels] = useState<Item[]>([]);
  const [callFormats, setCallFormats] = useState<Item[]>([]);

  const [sectorId, setSectorId] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [objectionLevelId, setObjectionLevelId] = useState("");
  const [callFormatId, setCallFormatId] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<unknown>(null);
  const [log, setLog] = useState<string[]>([]);

  const conversation = useConversation({
    onConnect: () => addLog("Connecté à l'agent ElevenLabs"),
    onDisconnect: () => addLog("Déconnecté"),
    onMessage: (msg: unknown) => addLog(`Message: ${JSON.stringify(msg)}`),
    onError: (err: unknown) => addLog(`Erreur: ${JSON.stringify(err)}`),
  });

  function addLog(line: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  }

  useEffect(() => {
    fetch(`${API_URL}/catalog/test-user`).then((r) => r.json()).then((u) => setUserId(u.id));
    fetch(`${API_URL}/catalog/sectors`).then((r) => r.json()).then(setSectors);
    fetch(`${API_URL}/catalog/objection-levels`).then((r) => r.json()).then(setObjectionLevels);
    fetch(`${API_URL}/catalog/call-formats`).then((r) => r.json()).then(setCallFormats);
  }, []);

  useEffect(() => {
    if (!sectorId) return;
    fetch(`${API_URL}/catalog/sectors/${sectorId}/personas`).then((r) => r.json()).then(setPersonas);
  }, [sectorId]);

  const canCreateSession = userId && sectorId && personaId && objectionLevelId && callFormatId;

  async function createSession() {
    const res = await fetch(`${API_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sectorId, personaId, objectionLevelId, callFormatId }),
    });
    const session = await res.json();
    setSessionId(session.id);
    addLog(`Session créée: ${session.id}`);
  }

  async function startCall() {
    if (!sessionId) return;
    addLog("Demande de permission micro...");
    await navigator.mediaDevices.getUserMedia({ audio: true });
    addLog("Démarrage de la session ElevenLabs...");
    await conversation.startSession({
      agentId: AGENT_ID,
      dynamicVariables: { secret__sessionId: sessionId },
    });
  }

  async function endCall() {
    if (!sessionId) return;
    await conversation.endSession();
    addLog("Appel terminé, fin de session côté backend...");
    await fetch(`${API_URL}/sessions/${sessionId}/end`, { method: "POST" });
    addLog("Génération du débrief...");
    await fetch(`${API_URL}/sessions/${sessionId}/debrief`, { method: "POST" });
    const res = await fetch(`${API_URL}/sessions/${sessionId}/debrief`);
    const data = await res.json();
    setDebrief(data);
    addLog("Débrief reçu.");
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 700, margin: "40px auto", padding: 16 }}>
      <h1>Prospector — test vocal (web)</h1>

      {!sessionId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Secteur:{" "}
            <select value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
              <option value="">--</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Persona:{" "}
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">--</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Niveau d'objection:{" "}
            <select value={objectionLevelId} onChange={(e) => setObjectionLevelId(e.target.value)}>
              <option value="">--</option>
              {objectionLevels.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format:{" "}
            <select value={callFormatId} onChange={(e) => setCallFormatId(e.target.value)}>
              <option value="">--</option>
              {callFormats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!canCreateSession} onClick={createSession}>
            Créer la session
          </button>
        </div>
      )}

      {sessionId && !debrief && (
        <div>
          <p>Session: {sessionId}</p>
          <p>Statut: {conversation.status}</p>
          {conversation.status !== "connected" ? (
            <button onClick={startCall}>Démarrer l'appel</button>
          ) : (
            <button onClick={endCall}>Terminer l'appel</button>
          )}
        </div>
      )}

      {debrief != null && (
        <div>
          <h2>Débrief</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f0f0f0", padding: 12 }}>
            {JSON.stringify(debrief, null, 2)}
          </pre>
        </div>
      )}

      <h3>Log</h3>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#0f0", padding: 12, maxHeight: 300, overflow: "auto" }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}
