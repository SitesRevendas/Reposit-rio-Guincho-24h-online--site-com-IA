// Guincho 24h Online: recebe os pedidos dos pop-ups (POST /api/lead) e manda por e-mail pelo Resend.
// Roda no mesmo contêiner do Nginx (127.0.0.1:3000), sem dependências (Node 18+).
// Variáveis no Easypanel (app web > Environment):
//   RESEND_API_KEY  chave do Resend (obrigatória; nunca colocar no código)
//   LEAD_TO         e-mail que recebe os leads (vários separados por vírgula)
//   LEAD_FROM       remetente; sem domínio verificado no Resend use "Guincho 24h Online <onboarding@resend.dev>"
// Teste local sem enviar e-mail: LEAD_DRY=1 LEAD_STATIC=../site node lead.mjs  (abre o site em http://localhost:3000)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.LEAD_PORT || 3000); // não usar PORT: o Easypanel define PORT=80 (o do Nginx)
const HOST = process.env.LEAD_STATIC ? '0.0.0.0' : '127.0.0.1';
const KEY = process.env.RESEND_API_KEY || '';
const TO = (process.env.LEAD_TO || '').split(',').map(s => s.trim()).filter(Boolean);
const FROM = process.env.LEAD_FROM || 'Guincho 24h Online <onboarding@resend.dev>';
const DRY = process.env.LEAD_DRY === '1';

const CAMPOS = [
  ['situacao', 'Situação'], ['interesse', 'Interesse'], ['veiculo', 'Veículo'], ['equipamento', 'Equipamento'],
  ['local', 'Onde está o veículo'], ['destino', 'Destino'], ['cidade', 'Cidade da base'],
  ['nome', 'Nome'], ['whatsapp', 'WhatsApp'],
  ['servico', 'Página de'], ['codigo', 'Código da localidade'], ['gatilho', 'Pop-up'], ['pagina', 'Endereço da página'],
  ['titulo', 'Título da página'], ['tempo', 'Segundos na página até enviar'],
];
const GATILHOS = { saida: 'Saída (tentou sair da página)', parada: 'Parada (ficou sem interagir)', rolagem: 'Rolagem (aviso no canto)', botao: 'Botão fixo do pedido' };

// Limite simples por IP: 5 pedidos a cada 10 minutos
const visitas = new Map();
function limitado(ip) {
  const agora = Date.now(), lista = (visitas.get(ip) || []).filter(t => agora - t < 600000);
  lista.push(agora); visitas.set(ip, lista);
  if (visitas.size > 5000) visitas.clear();
  return lista.length > 5;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const limpa = v => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);

function montar(d) {
  const parceiro = d.tipo === 'parceiro';
  const fone = d.whatsapp.replace(/\D/g, '');
  const wa = `https://wa.me/55${fone}`;
  const resumo = parceiro ? (d.interesse || 'Cadastro de parceiro') : (d.situacao || 'Pedido');
  const onde = parceiro ? d.cidade : d.local;
  const assunto = `${d.codigo ? `[${d.codigo}] ` : ''}${parceiro ? 'Novo guincheiro' : 'Novo lead'}: ${resumo}${d.veiculo ? ` · ${d.veiculo}` : ''}${onde ? ` · ${onde}` : ''}`.slice(0, 180);
  const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const linhas = CAMPOS.filter(([k]) => d[k]).map(([k, r]) => {
    let v = k === 'gatilho' ? (GATILHOS[d[k]] || d[k]) : d[k];
    v = k === 'pagina' ? `<a href="https://guincho24honline.com.br${esc(v)}">${esc(v)}</a>` : k === 'whatsapp' ? `<a href="${wa}">${esc(v)}</a>` : esc(v);
    return `<tr><th align="left" style="padding:8px 12px;background:#EEF6F8;color:#0A3B49;font:600 13px Arial;width:190px;vertical-align:top">${r}</th><td style="padding:8px 12px;color:#0A3B49;font:14px Arial">${v}</td></tr>`;
  }).join('');
  const html = `<div style="max-width:640px;font-family:Arial,sans-serif;color:#0A3B49">
<p style="margin:0 0 4px;font:700 12px Arial;letter-spacing:.08em;text-transform:uppercase;color:#14607A">${parceiro ? 'Cadastro de guincheiro' : 'Lead do site'} · ${esc(hora)}</p>
<h1 style="margin:0 0 16px;font:700 22px Arial">${esc(resumo)}${d.veiculo ? ` · ${esc(d.veiculo)}` : ''}</h1>
<p style="margin:0 0 18px"><a href="${wa}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#7CE0D3;color:#0A3B49;font:700 14px Arial;text-decoration:none">Chamar ${esc(d.nome)} no WhatsApp</a></p>
<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #D8E6EA">${linhas}</table>
<p style="margin:16px 0 0;font:12px Arial;color:#5F737B">Enviado pelo pop-up do site guincho24honline.com.br. Registre este lead na planilha da central com o código da localidade.</p></div>`;
  const texto = CAMPOS.filter(([k]) => d[k]).map(([k, r]) => `${r}: ${k === 'gatilho' ? (GATILHOS[d[k]] || d[k]) : d[k]}`).join('\n') + `\n\nWhatsApp: ${wa}`;
  return { assunto, html, texto };
}

async function enviar(d) {
  const m = montar(d);
  if (DRY) { console.log('[lead DRY]', m.assunto, '\n' + m.texto); return true; }
  if (!KEY || !TO.length) { console.error('[lead] RESEND_API_KEY ou LEAD_TO não configurados'); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, subject: m.assunto, html: m.html, text: m.texto }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) console.error('[lead] Resend respondeu', r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

function responder(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
async function estatico(req, res) {
  const raiz = path.resolve(process.env.LEAD_STATIC);
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.resolve(raiz, '.' + p);
  if (!f.startsWith(raiz)) return responder(res, 403, { ok: false });
  try { const b = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('404'); }
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/saude') return responder(res, 200, { ok: true, configurado: Boolean(KEY && TO.length) || DRY });
  if (url !== '/api/lead') return process.env.LEAD_STATIC ? estatico(req, res) : responder(res, 404, { ok: false });
  if (req.method !== 'POST') return responder(res, 405, { ok: false });
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  let corpo = '';
  req.on('data', c => { corpo += c; if (corpo.length > 8000) req.destroy(); });
  req.on('end', async () => {
    let d;
    try { d = JSON.parse(corpo); } catch { return responder(res, 400, { ok: false }); }
    if (d.site) return responder(res, 200, { ok: true });           // robô preencheu o campo escondido
    if (Number(d.tempo) < 3) return responder(res, 200, { ok: true }); // envio rápido demais para ser uma pessoa
    if (limitado(ip)) return responder(res, 429, { ok: false });
    const dados = { tipo: d.tipo === 'parceiro' ? 'parceiro' : 'cliente' };
    for (const [k] of CAMPOS) dados[k] = limpa(d[k]);
    const fone = dados.whatsapp.replace(/\D/g, '');
    if (dados.nome.length < 2 || fone.length < 10 || fone.length > 11 || d.lgpd !== 'on') return responder(res, 422, { ok: false });
    try { const ok = await enviar(dados); responder(res, ok ? 200 : 502, { ok }); }
    catch (e) { console.error('[lead]', e.message); responder(res, 502, { ok: false }); }
  });
}).listen(PORT, HOST, () => console.log(`[lead] ouvindo em ${HOST}:${PORT}${DRY ? ' (teste, sem envio)' : ''}`));
