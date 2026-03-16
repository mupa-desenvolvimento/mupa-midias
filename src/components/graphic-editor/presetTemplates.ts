/**
 * Preset campaign templates for the Mupa graphic editor.
 * Each template is a Fabric.js JSON canvas with pre-positioned objects.
 */

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  width: number;
  height: number;
  bgColor: string;
  gradient?: string;
  canvas: any; // fabric.toJSON() compatible
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function bgRect(w: number, h: number, fill: string) {
  return {
    type: "rect",
    left: 0, top: 0, width: w, height: h,
    fill, selectable: false, evented: false,
    hasControls: false, hasBorders: false,
    data: { isBackground: true, layerId: "__background__", layerName: "Fundo" },
  };
}

function textObj(text: string, opts: Record<string, any>) {
  return {
    type: "i-text",
    text,
    fontSize: 48,
    fontFamily: "Inter",
    fill: "#ffffff",
    textAlign: "center",
    originX: "center",
    originY: "center",
    ...opts,
    data: { layerId: makeId(), layerName: opts.layerName || text.slice(0, 20) },
  };
}

function rectObj(opts: Record<string, any>) {
  return {
    type: "rect",
    fill: "#ffffff",
    rx: 16, ry: 16,
    ...opts,
    data: { layerId: makeId(), layerName: opts.layerName || "Retângulo" },
  };
}

function qrPlaceholder(x: number, y: number, size: number, label = "QR Code") {
  return [
    {
      type: "rect",
      left: x - size / 2, top: y - size / 2,
      width: size, height: size,
      fill: "#ffffff", rx: 12, ry: 12,
      stroke: "#e0e0e0", strokeWidth: 2,
      data: { layerId: makeId(), layerName: "QR Background" },
    },
    {
      type: "i-text",
      text: "QR",
      left: x, top: y,
      fontSize: size * 0.35,
      fontFamily: "Inter",
      fontWeight: "bold",
      fill: "#333333",
      textAlign: "center",
      originX: "center",
      originY: "center",
      data: { layerId: makeId(), layerName: label },
    },
  ];
}

function wrap(w: number, h: number, bgColor: string, objects: any[]) {
  return {
    version: "6.0.0",
    objects: [bgRect(w, h, bgColor), ...objects],
  };
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "qrcode-motivacional",
    name: "QRCode + Fundo Motivacional",
    description: "QR grande no centro com frase inspiradora e fundo sunrise",
    icon: "🌅",
    category: "QR Code",
    width: 1080, height: 1920,
    bgColor: "#1a0533",
    canvas: wrap(1080, 1920, "#1a0533", [
      rectObj({ left: 0, top: 0, width: 1080, height: 1920, fill: "rgba(0,0,0,0.3)", layerName: "Overlay" }),
      textObj("Escaneie e\nSurpreenda-se!", { left: 540, top: 320, fontSize: 64, fontWeight: "bold", fill: "#ffffff", layerName: "Título" }),
      ...qrPlaceholder(540, 900, 380),
      textObj("Aponte a câmera do celular", { left: 540, top: 1200, fontSize: 32, fill: "#ffffff99", layerName: "Instrução" }),
      textObj('"O sucesso é a soma de pequenos esforços"', { left: 540, top: 1500, fontSize: 28, fontStyle: "italic", fill: "#ffffffcc", layerName: "Frase" }),
      textObj("— Robert Collier", { left: 540, top: 1580, fontSize: 22, fill: "#ffffff88", layerName: "Autor" }),
    ]),
  },
  {
    id: "cupom-instantaneo",
    name: "Cupom Instantâneo Vertical",
    description: "Desconto em destaque com QR abaixo, visual neon",
    icon: "🎟️",
    category: "Promoção",
    width: 1080, height: 1920,
    bgColor: "#0f0f0f",
    canvas: wrap(1080, 1920, "#0f0f0f", [
      rectObj({ left: 90, top: 200, width: 900, height: 600, fill: "#dc2626", rx: 24, ry: 24, layerName: "Card Vermelho" }),
      textObj("CUPOM", { left: 540, top: 340, fontSize: 48, fontWeight: "bold", fill: "#ffffff", layerName: "Label Cupom" }),
      textObj("30% OFF", { left: 540, top: 500, fontSize: 120, fontWeight: "bold", fill: "#ffffff", layerName: "Desconto" }),
      textObj("Válido por 15 minutos!", { left: 540, top: 640, fontSize: 28, fill: "#ffcccc", layerName: "Validade" }),
      ...qrPlaceholder(540, 1100, 350),
      textObj("Escaneie para resgatar", { left: 540, top: 1380, fontSize: 32, fill: "#00d4ff", layerName: "CTA" }),
      textObj("Termos e condições se aplicam", { left: 540, top: 1700, fontSize: 18, fill: "#666666", layerName: "Termos" }),
    ]),
  },
  {
    id: "pesquisa-satisfacao",
    name: "Pesquisa de Satisfação",
    description: "Pergunta simples + QR, fundo clean azul",
    icon: "📋",
    category: "Pesquisa",
    width: 1080, height: 1920,
    bgColor: "#0c1e3a",
    canvas: wrap(1080, 1920, "#0c1e3a", [
      textObj("Sua opinião\nimporta!", { left: 540, top: 350, fontSize: 72, fontWeight: "bold", fill: "#ffffff", layerName: "Título" }),
      textObj("Como foi sua experiência hoje?", { left: 540, top: 580, fontSize: 32, fill: "#94b8db", layerName: "Pergunta" }),
      rectObj({ left: 140, top: 700, width: 800, height: 4, fill: "#00d4ff44", rx: 2, ry: 2, layerName: "Divider" }),
      ...qrPlaceholder(540, 1000, 380),
      textObj("Escaneie e avalie em 30s", { left: 540, top: 1300, fontSize: 30, fill: "#00d4ff", layerName: "CTA" }),
      textObj("⭐⭐⭐⭐⭐", { left: 540, top: 1500, fontSize: 60, layerName: "Estrelas" }),
    ]),
  },
  {
    id: "produto-destaque",
    name: "Produto em Destaque",
    description: "Espaço para imagem de produto + preço + QR para folder",
    icon: "🛒",
    category: "Produto",
    width: 1080, height: 1920,
    bgColor: "#111111",
    canvas: wrap(1080, 1920, "#111111", [
      rectObj({ left: 90, top: 150, width: 900, height: 700, fill: "#1a1a2e", rx: 20, ry: 20, layerName: "Card Produto" }),
      textObj("📦", { left: 540, top: 440, fontSize: 120, layerName: "Ícone Produto" }),
      textObj("NOME DO PRODUTO", { left: 540, top: 620, fontSize: 36, fontWeight: "bold", fill: "#ffffff", layerName: "Nome Produto" }),
      textObj("R$ 29,90", { left: 540, top: 1000, fontSize: 80, fontWeight: "bold", fill: "#00ff88", layerName: "Preço" }),
      textObj("antes R$ 49,90", { left: 540, top: 1100, fontSize: 28, fill: "#ff6666", layerName: "Preço Antigo" }),
      ...qrPlaceholder(540, 1400, 320),
      textObj("Veja o folder completo", { left: 540, top: 1650, fontSize: 28, fill: "#00d4ff", layerName: "CTA" }),
    ]),
  },
  {
    id: "frase-inspiradora-tv",
    name: "Frase Inspiradora TV",
    description: "Texto grande central com autor, fundo elegante",
    icon: "✨",
    category: "Motivacional",
    width: 1920, height: 1080,
    bgColor: "#0a0a1a",
    canvas: wrap(1920, 1080, "#0a0a1a", [
      rectObj({ left: 0, top: 0, width: 1920, height: 1080, fill: "rgba(0,212,255,0.03)", layerName: "Overlay" }),
      textObj('"A persistência é o caminho\ndo êxito."', { left: 960, top: 440, fontSize: 64, fontWeight: "bold", fill: "#ffffff", lineHeight: 1.4, layerName: "Frase" }),
      textObj("— Charles Chaplin", { left: 960, top: 680, fontSize: 32, fill: "#00d4ff", layerName: "Autor" }),
      rectObj({ left: 860, top: 350, width: 200, height: 4, fill: "#00d4ff", rx: 2, ry: 2, layerName: "Divider Top" }),
      rectObj({ left: 860, top: 740, width: 200, height: 4, fill: "#00d4ff44", rx: 2, ry: 2, layerName: "Divider Bottom" }),
    ]),
  },
  {
    id: "sorteio-semanal",
    name: "Sorteio Semanal",
    description: "Campanha de sorteio com countdown e QR para participar",
    icon: "🎰",
    category: "Sorteio",
    width: 1080, height: 1920,
    bgColor: "#0d0d1a",
    canvas: wrap(1080, 1920, "#0d0d1a", [
      textObj("🎉 SORTEIO 🎉", { left: 540, top: 250, fontSize: 56, fontWeight: "bold", fill: "#ffd700", layerName: "Título" }),
      textObj("SEMANAL", { left: 540, top: 360, fontSize: 40, fill: "#ffd700aa", layerName: "Subtítulo" }),
      rectObj({ left: 140, top: 500, width: 800, height: 300, fill: "#1a1a3e", rx: 20, ry: 20, layerName: "Card Prêmio" }),
      textObj("🏆 Prêmio", { left: 540, top: 580, fontSize: 36, fill: "#ffd700", layerName: "Label Prêmio" }),
      textObj("Vale Compras R$ 200", { left: 540, top: 680, fontSize: 42, fontWeight: "bold", fill: "#ffffff", layerName: "Prêmio" }),
      ...qrPlaceholder(540, 1100, 350),
      textObj("Escaneie para participar!", { left: 540, top: 1400, fontSize: 32, fill: "#00d4ff", layerName: "CTA" }),
      textObj("Resultado toda sexta-feira", { left: 540, top: 1600, fontSize: 24, fill: "#888888", layerName: "Info" }),
    ]),
  },
  {
    id: "whatsapp-direto",
    name: "Chat WhatsApp Direto",
    description: "Ícone WhatsApp + QR para iniciar conversa",
    icon: "💬",
    category: "Contato",
    width: 1080, height: 1920,
    bgColor: "#0a1a0a",
    canvas: wrap(1080, 1920, "#0a1a0a", [
      textObj("💬", { left: 540, top: 350, fontSize: 160, layerName: "Ícone WhatsApp" }),
      textObj("Fale Conosco!", { left: 540, top: 600, fontSize: 56, fontWeight: "bold", fill: "#25d366", layerName: "Título" }),
      textObj("Tire suas dúvidas,\nfaça pedidos ou\nentre em contato", { left: 540, top: 800, fontSize: 30, fill: "#ffffffcc", lineHeight: 1.5, layerName: "Descrição" }),
      ...qrPlaceholder(540, 1150, 350),
      textObj("Escaneie e converse pelo WhatsApp", { left: 540, top: 1440, fontSize: 26, fill: "#25d366", layerName: "CTA" }),
    ]),
  },
  {
    id: "catalogo-digital",
    name: "Catálogo Digital",
    description: "Convite para acessar catálogo completo via QR",
    icon: "📱",
    category: "Catálogo",
    width: 1080, height: 1920,
    bgColor: "#0f0f1a",
    canvas: wrap(1080, 1920, "#0f0f1a", [
      textObj("📱 Catálogo\nDigital", { left: 540, top: 350, fontSize: 64, fontWeight: "bold", fill: "#ffffff", layerName: "Título" }),
      rectObj({ left: 140, top: 550, width: 800, height: 4, fill: "#00d4ff33", rx: 2, ry: 2, layerName: "Divider" }),
      textObj("Confira todas as ofertas\nno seu celular!", { left: 540, top: 680, fontSize: 32, fill: "#ffffffaa", lineHeight: 1.5, layerName: "Descrição" }),
      ...qrPlaceholder(540, 1050, 380),
      textObj("Escaneie e navegue", { left: 540, top: 1350, fontSize: 30, fill: "#00d4ff", layerName: "CTA" }),
      textObj("+ de 500 produtos", { left: 540, top: 1550, fontSize: 40, fontWeight: "bold", fill: "#00ff88", layerName: "Destaque" }),
    ]),
  },
  {
    id: "indique-ganhe",
    name: "Indique e Ganhe",
    description: "Programa de indicação com QR de cadastro",
    icon: "🤝",
    category: "Fidelidade",
    width: 1080, height: 1920,
    bgColor: "#1a0a2e",
    canvas: wrap(1080, 1920, "#1a0a2e", [
      textObj("🤝", { left: 540, top: 280, fontSize: 120, layerName: "Ícone" }),
      textObj("INDIQUE\ne GANHE!", { left: 540, top: 500, fontSize: 64, fontWeight: "bold", fill: "#ffffff", layerName: "Título" }),
      rectObj({ left: 140, top: 680, width: 800, height: 250, fill: "#ffffff0d", rx: 16, ry: 16, layerName: "Card Info" }),
      textObj("Indique um amigo e ganhe\n10% de desconto na próxima compra", { left: 540, top: 780, fontSize: 26, fill: "#ffffffcc", lineHeight: 1.5, layerName: "Regra" }),
      ...qrPlaceholder(540, 1150, 350),
      textObj("Cadastre-se agora!", { left: 540, top: 1430, fontSize: 32, fill: "#00d4ff", layerName: "CTA" }),
    ]),
  },
  {
    id: "acessibilidade",
    name: "Acessibilidade",
    description: "Informações em Libras ou texto ampliado via QR",
    icon: "♿",
    category: "Acessibilidade",
    width: 1080, height: 1920,
    bgColor: "#0a1a2e",
    canvas: wrap(1080, 1920, "#0a1a2e", [
      textObj("♿", { left: 540, top: 300, fontSize: 140, layerName: "Ícone Acessibilidade" }),
      textObj("Acessibilidade", { left: 540, top: 530, fontSize: 56, fontWeight: "bold", fill: "#ffffff", layerName: "Título" }),
      textObj("Acesse informações em\nLibras ou texto ampliado", { left: 540, top: 700, fontSize: 32, fill: "#ffffffaa", lineHeight: 1.5, layerName: "Descrição" }),
      ...qrPlaceholder(540, 1050, 380),
      textObj("Escaneie para acessar", { left: 540, top: 1350, fontSize: 30, fill: "#00d4ff", layerName: "CTA" }),
      textObj("🤟 Inclusão é para todos", { left: 540, top: 1600, fontSize: 28, fill: "#ffffffcc", layerName: "Slogan" }),
    ]),
  },
];
