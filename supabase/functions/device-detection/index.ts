import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DetectionPayload {
  device_serial: string;
  device_nickname?: string;
  detections: {
    face_descriptor?: number[];
    confidence?: number;
    is_facing_camera?: boolean;
    detected_at?: string;
    metadata?: Record<string, unknown>;
    // Novos campos para analytics
    age?: number;
    age_group?: string;
    gender?: string;
    emotion?: string;
    emotion_confidence?: number;
    attention_duration?: number;
    content_id?: string;
    content_name?: string;
    playlist_id?: string;
  }[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "POST") {
      const payload: DetectionPayload = await req.json();

      console.log("Recebendo detecções do dispositivo:", payload.device_serial);

      // Validar dados obrigatórios
      if (!payload.device_serial) {
        return new Response(
          JSON.stringify({ error: "device_serial é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!payload.detections || !Array.isArray(payload.detections) || payload.detections.length === 0) {
        return new Response(
          JSON.stringify({ error: "detections deve ser um array não vazio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- INPUT VALIDATION ---
      if (payload.detections.length > 100) {
        return new Response(
          JSON.stringify({ error: "Máximo de 100 detecções por requisição" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (payload.device_serial.length > 200) {
        return new Response(
          JSON.stringify({ error: "device_serial muito longo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validGenders = ["male", "female", "unknown"];
      const validEmotions = ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral", "unknown"];
      const validAgeGroups = ["child", "teen", "young_adult", "adult", "senior", "unknown"];
      // --- END INPUT VALIDATION ---

      // Buscar dispositivo pelo serial (device_code)
      const { data: device } = await supabase
        .from("devices")
        .select("id")
        .eq("device_code", payload.device_serial)
        .single();

      // Preparar registros para inserção com novos campos
      const detectionLogs = payload.detections.map((detection) => {
        // Validate face_descriptor size
        const faceDescriptor = Array.isArray(detection.face_descriptor) && detection.face_descriptor.length <= 128
          ? detection.face_descriptor
          : null;

        // Validate metadata size (max 10KB serialized)
        let metadata = detection.metadata || {};
        try {
          if (JSON.stringify(metadata).length > 10240) {
            metadata = {};
          }
        } catch {
          metadata = {};
        }

        // Sanitize enum fields
        const gender = detection.gender && validGenders.includes(detection.gender) ? detection.gender : null;
        const emotion = detection.emotion && validEmotions.includes(detection.emotion) ? detection.emotion : null;
        const ageGroup = detection.age_group && validAgeGroups.includes(detection.age_group) ? detection.age_group : null;

        // Validate string lengths
        const contentName = detection.content_name ? String(detection.content_name).slice(0, 500) : null;
        const deviceNickname = payload.device_nickname ? String(payload.device_nickname).slice(0, 200) : null;

        return {
          device_id: device?.id || null,
          device_serial: payload.device_serial,
          device_nickname: deviceNickname,
          face_descriptor: faceDescriptor,
          confidence: typeof detection.confidence === "number" ? Math.min(Math.max(detection.confidence, 0), 1) : null,
          is_facing_camera: detection.is_facing_camera ?? true,
          detected_at: detection.detected_at || new Date().toISOString(),
          metadata,
          age: typeof detection.age === "number" ? Math.min(Math.max(Math.round(detection.age), 0), 120) : null,
          age_group: ageGroup,
          gender,
          emotion,
          emotion_confidence: typeof detection.emotion_confidence === "number" ? Math.min(Math.max(detection.emotion_confidence, 0), 1) : null,
          attention_duration: typeof detection.attention_duration === "number" ? Math.min(Math.max(detection.attention_duration, 0), 3600) : null,
          content_id: detection.content_id || null,
          content_name: contentName,
          playlist_id: detection.playlist_id || null,
        };
      });

      // Inserir registros
      const { data, error } = await supabase
        .from("device_detection_logs")
        .insert(detectionLogs)
        .select("id");

      if (error) {
        console.error("Erro ao inserir detecções:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao salvar detecções", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Inseridos ${data.length} registros de detecção para ${payload.device_serial}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `${data.length} detecções registradas`,
          device_found: !!device,
          inserted_ids: data.map((d) => d.id),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET - Listar detecções de um dispositivo
    if (req.method === "GET") {
      const url = new URL(req.url);
      const deviceSerial = url.searchParams.get("device_serial");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      if (!deviceSerial) {
        return new Response(
          JSON.stringify({ error: "device_serial é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("device_detection_logs")
        .select("*")
        .eq("device_serial", deviceSerial)
        .order("detected_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Erro ao buscar detecções:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar detecções", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, detections: data, count: data.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
 } catch (error: unknown) {
    console.error("Erro no endpoint:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
});
