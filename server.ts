import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { db } from './src/server/db.js';
import { PerfilAcesso, Operador } from './src/types.js';
import { getBrasiliaDateParts, getBrasiliaDateString, getBrasiliaTimeString, getBrasiliaFullString, isSupervisorMatch } from './src/utils/dateUtils.js';

let aiClient: any = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (e) {
    console.warn('[AI] Failed to initialize GoogleGenAI client:', e);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'sinalizacoes_secret_key_2026_super_secure';
const PORT = 3001;

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware to support Vercel and Google Cloud Run cross-origin calls
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Vercel Serverless Function path normalization middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Normalize /api/index prefix if rewrites added it
  if (req.url.startsWith('/api/index')) {
    req.url = req.url.replace('/api/index', '/api');
    if (req.url === '/api' || req.url === '/api/') {
      req.url = '/api/health';
    }
  }
  // If request path is stripped of /api by serverless router, re-attach /api
  if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads') && !req.url.startsWith('/assets')) {
    const isApiRoute =
      req.url.startsWith('/auth') ||
      req.url.startsWith('/sinalizacoes') ||
      req.url.startsWith('/absenteismo') ||
      req.url.startsWith('/dashboard') ||
      req.url.startsWith('/usuarios') ||
      req.url.startsWith('/supervisores') ||
      req.url.startsWith('/operadores') ||
      req.url.startsWith('/produtos') ||
      req.url.startsWith('/motivos') ||
      req.url.startsWith('/configuracao-api') ||
      req.url.startsWith('/config-api') ||
      req.url.startsWith('/diario-bordo') ||
      req.url.startsWith('/ia') ||
      req.url.startsWith('/health');
    if (isApiRoute) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  next();
});

// Health check endpoint
app.get(['/api/health', '/health'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL || !!process.env.VERCEL_ENV,
    timestamp: new Date().toISOString()
  });
});

// Ensure uploads folder exists
const isVercelEnv = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
const uploadsDir = isVercelEnv ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create uploads directory:', e);
}

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Multer storage for evidence uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `evidencia-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ['.jpg', '.jpeg', '.png'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos do tipo JPG, JPEG e PNG são permitidos.'));
    }
  }
});

// Auth Middleware
interface AuthRequest extends Request {
  user?: {
    id: number;
    nome: string;
    login: string;
    perfil: PerfilAcesso;
  };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'Acesso não autorizado. Faça login novamente.' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
      }
      req.user = user;
      next();
    });
  } catch (err: any) {
    return res.status(401).json({ error: 'Falha na verificação da sessão. Faça login novamente.' });
  }
}

function requireRole(roles: PerfilAcesso[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.perfil)) {
      return res.status(403).json({ error: 'Você não possui permissão para realizar esta ação.' });
    }
    next();
  };
}

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    const { login, senha } = body || {};

    if (!login || !senha) {
      return res.status(400).json({ error: 'Informe login e senha.' });
    }

    const user = await db.getUsuarioByLogin(String(login).trim());
    if (!user) {
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }

    if (user.status === 'Inativo') {
      return res.status(403).json({ error: 'Usuário bloqueado/inativo no sistema. Procure o Administrador.' });
    }

    let validPassword = false;
    try {
      if (user.senha && user.senha.startsWith('$2')) {
        validPassword = bcrypt.compareSync(String(senha), user.senha);
      } else {
        validPassword = String(senha) === String(user.senha);
      }
    } catch (e) {
      validPassword = String(senha) === String(user.senha);
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil,
      status: user.status,
      token
    });
  } catch (err: any) {
    console.error('Login route error:', err);
    return res.status(500).json({ error: `Erro ao autenticar: ${err.message || err}` });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.getUsuarioById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil,
      status: user.status,
      produto: user.produto,
      supervisor: user.supervisor
    });
  } catch (err: any) {
    console.error('Auth/me route error:', err);
    return res.status(500).json({ error: 'Erro ao carregar dados do usuário.' });
  }
});

app.put('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { senhaAtual, novaSenha } = req.body || {};

    if (!novaSenha || String(novaSenha).trim().length < 3) {
      return res.status(400).json({ error: 'Informe uma nova senha válida (mínimo 3 caracteres).' });
    }

    const userId = req.user!.id;
    const user = await db.getUsuarioById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (senhaAtual) {
      let validPassword = false;
      try {
        if (user.senha && user.senha.startsWith('$2')) {
          validPassword = bcrypt.compareSync(String(senhaAtual), user.senha);
        } else {
          validPassword = String(senhaAtual) === String(user.senha);
        }
      } catch (e) {
        validPassword = String(senhaAtual) === String(user.senha);
      }

      if (!validPassword) {
        return res.status(400).json({ error: 'Senha atual incorreta.' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(String(novaSenha).trim(), salt);

    const updated = await db.updateUsuario(userId, { senha: hashedPassword });
    if (!updated) {
      return res.status(500).json({ error: 'Erro ao atualizar senha no banco de dados.' });
    }

    return res.json({ message: 'Senha alterada com sucesso!' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: `Erro ao alterar senha: ${err.message || err}` });
  }
});

// --- SINALIZAÇÕES ROUTES ---
app.get('/api/sinalizacoes', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { dataInicial, dataFinal, supervisor, operador, produto, motivo, status, gravidade } = req.query;
  const currentUser = req.user;

  let list = await db.getSinalizacoes();
  if (!Array.isArray(list)) list = [];

  if (currentUser && (currentUser.perfil === 'Supervisor' || currentUser.perfil === 'Operação')) {
    list = list.filter((s) => isSupervisorMatch(currentUser.nome, currentUser.login, s.supervisor));
  }

  if (dataInicial && typeof dataInicial === 'string' && dataInicial.trim() !== '') {
    list = list.filter((s) => s.data >= dataInicial.trim());
  }
  if (dataFinal && typeof dataFinal === 'string' && dataFinal.trim() !== '') {
    list = list.filter((s) => s.data <= dataFinal.trim());
  }
  if (status && typeof status === 'string' && status !== 'Todos' && status.trim() !== '') {
    if (status.toLowerCase().startsWith('pendente')) {
      list = list.filter((s) => !s.confirmado);
    } else if (status.toLowerCase().startsWith('confirmado')) {
      list = list.filter((s) => !!s.confirmado);
    }
  }
  if (supervisor && typeof supervisor === 'string' && supervisor !== 'Todos' && supervisor.trim() !== '') {
    const targetSup = supervisor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/z/g, 's').trim();
    list = list.filter((s) => {
      const itemSup = (s.supervisor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/z/g, 's').trim();
      return itemSup === targetSup;
    });
  }
  if (operador && typeof operador === 'string' && operador !== 'Todos' && operador.trim() !== '') {
    const qOp = operador.toLowerCase().trim();
    const allOps = await db.getOperadores();
    const matchingOpNames = new Set<string>();
    if (Array.isArray(allOps)) {
      for (const o of allOps) {
        if (
          o.nome.toLowerCase().includes(qOp) ||
          (o.intergrall && o.intergrall.toLowerCase().includes(qOp))
        ) {
          matchingOpNames.add(o.nome.toLowerCase().trim());
        }
      }
    }
    list = list.filter((s) => {
      const sOp = (s.operador || '').toLowerCase().trim();
      return sOp.includes(qOp) || matchingOpNames.has(sOp);
    });
  }
  if (produto && typeof produto === 'string' && produto !== 'Todos' && produto.trim() !== '') {
    list = list.filter((s) => s.produto.toLowerCase() === produto.toLowerCase().trim());
  }
  if (motivo && typeof motivo === 'string' && motivo !== 'Todos' && motivo.trim() !== '') {
    list = list.filter((s) => s.motivo.toLowerCase() === motivo.toLowerCase().trim());
  }
  if (gravidade && typeof gravidade === 'string' && gravidade !== 'Todos' && gravidade.trim() !== '') {
    list = list.filter((s) => (s.gravidade || 'Médio').toLowerCase() === gravidade.toLowerCase().trim());
  }

  return res.json(list);
});

app.post(
  '/api/sinalizacoes',
  authenticateToken,
  requireRole(['Administrador', 'Planejamento']),
  upload.single('evidencia'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { operador, supervisor, produto, motivo, gravidade, observacao } = req.body;

      if (!operador || !supervisor || !produto || !motivo) {
        return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios.' });
      }

      const now = new Date();
      const { currentDate, currentTime } = getBrasiliaDateParts(now);

      let nome_evidencia = '';
      let caminho_evidencia = '';

      if (req.file) {
        nome_evidencia = req.file.originalname || 'evidencia.png';
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const mimeType = req.file.mimetype || 'image/png';
          caminho_evidencia = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          caminho_evidencia = `/uploads/${req.file.filename}`;
        }
      }

      const newRecord = await db.addSinalizacao({
        data: currentDate,
        hora: currentTime,
        operador,
        supervisor,
        produto,
        motivo,
        gravidade: gravidade || 'Médio',
        observacao: observacao || '',
        nome_evidencia,
        caminho_evidencia,
        usuario_responsavel: req.user!.nome,
        data_cadastro: now.toISOString()
      });

      return res.status(201).json({
        message: 'Sinalização registrada com sucesso.',
        data: newRecord
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao registrar sinalização.' });
    }
  }
);

app.put(
  '/api/sinalizacoes/:id',
  authenticateToken,
  requireRole(['Administrador', 'Planejamento']),
  upload.single('evidencia'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de sinalização inválido.' });
      }

      const { operador, supervisor, produto, motivo, gravidade, observacao } = req.body;

      const updateData: Partial<any> = {};
      if (operador) updateData.operador = operador;
      if (supervisor) updateData.supervisor = supervisor;
      if (produto) updateData.produto = produto;
      if (motivo) updateData.motivo = motivo;
      if (gravidade) updateData.gravidade = gravidade;
      if (observacao !== undefined) updateData.observacao = observacao;

      if (req.file) {
        updateData.nome_evidencia = req.file.originalname || 'evidencia.png';
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const mimeType = req.file.mimetype || 'image/png';
          updateData.caminho_evidencia = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          updateData.caminho_evidencia = `/uploads/${req.file.filename}`;
        }
      }

      const updated = await db.updateSinalizacao(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Sinalização não encontrada.' });
      }

      return res.json({ message: 'Sinalização atualizada com sucesso.', data: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao atualizar sinalização.' });
    }
  }
);

app.put(
  '/api/sinalizacoes/:id/confirmar',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de sinalização inválido.' });
      }

      const list = await db.getSinalizacoes();
      const sinalizacao = list.find((s) => s.id === id);
      if (!sinalizacao) {
        return res.status(404).json({ error: 'Sinalização não encontrada.' });
      }

      const currentUser = req.user!;
      const isMentionedSupervisor = isSupervisorMatch(currentUser.nome, currentUser.login, sinalizacao.supervisor);
      const isAdminOrPlan = currentUser.perfil === 'Administrador' || currentUser.perfil === 'Planejamento';

      if (!isAdminOrPlan && !isMentionedSupervisor) {
        return res.status(403).json({
          error: `Apenas o supervisor responsável (${sinalizacao.supervisor}) ou Administrador/Planejamento podem confirmar esta sinalização.`
        });
      }

      const updated = await db.confirmarSinalizacao(id, currentUser.nome);
      if (!updated) {
        return res.status(500).json({ error: 'Erro ao confirmar sinalização.' });
      }

      return res.json({
        message: 'Sinalização confirmada com sucesso.',
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao processar confirmação.' });
    }
  }
);

// --- CONTROLE DE ABSENTEÍSMO ENDPOINTS ---

// GET /api/absenteismo - Fetch attendance records
app.get(['/api/absenteismo', '/absenteismo'], authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { data, all } = req.query;
    let records;
    if (all === 'true' || data === 'all') {
      records = await db.getAbsenteismo();
    } else {
      const dataStr = typeof data === 'string' && data ? data : getBrasiliaDateString();
      records = await db.getAbsenteismo(dataStr);
    }
    if (!Array.isArray(records)) {
      records = [];
    }
    const currentUser = req.user;
    if (currentUser && (currentUser.perfil === 'Supervisor' || currentUser.perfil === 'Operação')) {
      records = records.filter((r) => r && isSupervisorMatch(currentUser.nome, currentUser.login, r?.supervisor || ''));
    }
    return res.json(records);
  } catch (err: any) {
    console.error('Erro ao buscar absenteísmo:', err);
    return res.json([]);
  }
});

// POST /api/absenteismo/batch - Batch save attendance records
app.post(['/api/absenteismo/batch', '/absenteismo/batch'], authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    const records = Array.isArray(body) ? body : (body?.records || body?.data);
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'A lista de registros (records) é obrigatória.' });
    }

    const currentUser = req.user!;
    const updated = await db.saveAbsenteismoBatch(records, currentUser.nome);
    return res.json({ message: 'Registros de absenteísmo salvos com sucesso.', data: Array.isArray(updated) ? updated : [] });
  } catch (err: any) {
    console.error('Erro ao salvar absenteísmo:', err);
    return res.json({ message: 'Registros de absenteísmo salvos localmente.', data: [] });
  }
});

// --- DIÁRIO DE BORDO ENDPOINTS ---

// GET /api/diario-bordo/metrics - Metrics and chart data
app.get('/api/diario-bordo/metrics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.getDiarioBordo();

    const { dataInicial, dataFinal, produto, status, responsavel, impacto, tipo } = req.query;

    const filtered = list.filter((item) => {
      if (dataInicial && item.data_ocorrencia < (dataInicial as string)) return false;
      if (dataFinal && item.data_ocorrencia > (dataFinal as string)) return false;
      if (produto && produto !== 'Todos' && item.produto !== produto) return false;
      if (status && status !== 'Todos' && item.status !== status) return false;
      if (responsavel && responsavel !== 'Todos' && item.responsavel !== responsavel) return false;
      if (impacto && impacto !== 'Todos' && item.impacto !== impacto) return false;
      if (tipo && tipo !== 'Todos' && (item.tipo || 'Operacional') !== tipo) return false;
      return true;
    });

    const totalOcorrencias = filtered.length;
    const totalAbertas = filtered.filter((i) => i.status === 'Aberto').length;
    const totalEmAndamento = filtered.filter((i) => i.status === 'Em Andamento').length;
    const totalResolvidas = filtered.filter((i) => i.status === 'Resolvido').length;
    const totalMonitorando = filtered.filter((i) => i.status === 'Monitorando').length;
    const totalCanceladas = filtered.filter((i) => i.status === 'Cancelado').length;

    // Calculate resolution times
    let totalHorasResolucoes = 0;
    let countResolvidasComTempo = 0;

    const tempoPorProdutoMap: Record<string, { totalHoras: number; count: number }> = {};

    filtered.forEach((item) => {
      if (item.status === 'Resolvido' && item.data_solucao && item.hora_solucao) {
        try {
          const start = new Date(`${item.data_ocorrencia}T${item.hora_ocorrencia}:00`).getTime();
          const end = new Date(`${item.data_solucao}T${item.hora_solucao}:00`).getTime();
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            const diffHours = (end - start) / (1000 * 60 * 60);
            totalHorasResolucoes += diffHours;
            countResolvidasComTempo++;

            if (!tempoPorProdutoMap[item.produto]) {
              tempoPorProdutoMap[item.produto] = { totalHoras: 0, count: 0 };
            }
            tempoPorProdutoMap[item.produto].totalHoras += diffHours;
            tempoPorProdutoMap[item.produto].count++;
          }
        } catch (e) {
          // ignore date parse errors
        }
      }
    });

    const tempoMedioResolucoesHoras = countResolvidasComTempo > 0 ? parseFloat((totalHorasResolucoes / countResolvidasComTempo).toFixed(1)) : 0;

    // Ocorrências por Produto
    const produtoCountMap: Record<string, number> = {};
    filtered.forEach((item) => {
      produtoCountMap[item.produto] = (produtoCountMap[item.produto] || 0) + 1;
    });
    const ocorrenciasPorProduto = Object.entries(produtoCountMap)
      .map(([produto, quantidade]) => ({ produto, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const produtosMaisImpactados = ocorrenciasPorProduto.slice(0, 5);

    // Ocorrências por Status
    const statusCountMap: Record<string, number> = {};
    filtered.forEach((item) => {
      statusCountMap[item.status] = (statusCountMap[item.status] || 0) + 1;
    });
    const ocorrenciasPorStatus = Object.entries(statusCountMap)
      .map(([status, quantidade]) => ({ status, quantidade }));

    // Ocorrências por Impacto
    const impactoCountMap: Record<string, number> = {};
    filtered.forEach((item) => {
      impactoCountMap[item.impacto] = (impactoCountMap[item.impacto] || 0) + 1;
    });
    const ocorrenciasPorImpacto = Object.entries(impactoCountMap)
      .map(([impacto, quantidade]) => ({ impacto, quantidade }));

    // Ocorrências por Mês
    const mesCountMap: Record<string, number> = {};
    filtered.forEach((item) => {
      if (item.data_ocorrencia) {
        const [year, month] = item.data_ocorrencia.split('-');
        if (year && month) {
          const key = `${month}/${year}`;
          mesCountMap[key] = (mesCountMap[key] || 0) + 1;
        }
      }
    });
    const ocorrenciasPorMes = Object.entries(mesCountMap)
      .map(([mes, quantidade]) => ({ mes, quantidade }));

    // Ocorrências por Turno (Manhã até 11:59 / Tarde 12:00 em diante)
    let manhaCount = 0;
    let tardeCount = 0;

    filtered.forEach((item) => {
      const hora = item.hora_ocorrencia ? item.hora_ocorrencia.trim() : '00:00';
      if (hora < '12:00') {
        manhaCount++;
      } else {
        tardeCount++;
      }
    });

    const ocorrenciasPorTurno = [
      { turno: 'Manhã (Até 11:59)', quantidade: manhaCount },
      { turno: 'Tarde (12:00 em diante)', quantidade: tardeCount }
    ];

    // Tempo médio por produto
    const tempoMedioPorProduto = Object.entries(tempoPorProdutoMap)
      .map(([produto, data]) => ({
        produto,
        tempoMedioHoras: parseFloat((data.totalHoras / data.count).toFixed(1))
      }))
      .sort((a, b) => b.tempoMedioHoras - a.tempoMedioHoras);

    return res.json({
      totalOcorrencias,
      totalAbertas,
      totalEmAndamento,
      totalResolvidas,
      totalMonitorando,
      totalCanceladas,
      tempoMedioResolucoesHoras,
      produtosMaisImpactados,
      ocorrenciasPorProduto,
      ocorrenciasPorStatus,
      ocorrenciasPorImpacto,
      ocorrenciasPorMes,
      ocorrenciasPorTurno,
      tempoMedioPorProduto
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao carregar métricas do Diário de Bordo.' });
  }
});

// GET /api/diario-bordo - List occurrences with filters
app.get('/api/diario-bordo', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.getDiarioBordo();
    const { dataInicial, dataFinal, produto, status, responsavel, impacto, tipo, busca } = req.query;

    let filtered = list;

    if (dataInicial) {
      filtered = filtered.filter((i) => i.data_ocorrencia >= (dataInicial as string));
    }
    if (dataFinal) {
      filtered = filtered.filter((i) => i.data_ocorrencia <= (dataFinal as string));
    }
    if (produto && produto !== 'Todos') {
      const prods = String(produto).split(',').map((s) => s.trim());
      filtered = filtered.filter((i) => prods.includes(i.produto));
    }
    if (status && status !== 'Todos') {
      const st = String(status).split(',').map((s) => s.trim());
      filtered = filtered.filter((i) => st.includes(i.status));
    }
    if (responsavel && responsavel !== 'Todos') {
      const resps = String(responsavel).split(',').map((s) => s.trim());
      filtered = filtered.filter((i) => resps.includes(i.responsavel));
    }
    if (impacto && impacto !== 'Todos') {
      const imps = String(impacto).split(',').map((s) => s.trim());
      filtered = filtered.filter((i) => imps.includes(i.impacto));
    }
    if (tipo && tipo !== 'Todos') {
      const tps = String(tipo).split(',').map((s) => s.trim());
      filtered = filtered.filter((i) => tps.includes(i.tipo || 'Operacional'));
    }
    if (busca) {
      const term = (busca as string).toLowerCase().trim();
      filtered = filtered.filter((i) =>
        i.ocorrencia.toLowerCase().includes(term) ||
        i.produto.toLowerCase().includes(term) ||
        i.responsavel.toLowerCase().includes(term) ||
        i.impacto.toLowerCase().includes(term) ||
        (i.tipo && i.tipo.toLowerCase().includes(term)) ||
        (i.comentario && i.comentario.toLowerCase().includes(term)) ||
        (i.solucao && i.solucao.toLowerCase().includes(term))
      );
    }

    return res.json(filtered);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao buscar registros do Diário de Bordo.' });
  }
});

// GET /api/diario-bordo/:id/historico - Get timeline history
app.get('/api/diario-bordo/:id/historico', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const historico = await db.getDiarioBordoHistorico(id);
    return res.json(historico);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao buscar histórico da ocorrência.' });
  }
});

// POST /api/diario-bordo - Create new occurrence
app.post(
  '/api/diario-bordo',
  authenticateToken,
  upload.single('evidencia'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        data_ocorrencia,
        hora_ocorrencia,
        produto,
        ocorrencia,
        impacto,
        tipo,
        comentario,
        status,
        responsavel
      } = req.body;

      if (!data_ocorrencia || !hora_ocorrencia || !produto || !ocorrencia || !impacto || !responsavel) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      let nome_evidencia = '';
      let caminho_evidencia = '';

      if (req.file) {
        nome_evidencia = req.file.originalname || 'evidencia.png';
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const mimeType = req.file.mimetype || 'image/png';
          caminho_evidencia = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          caminho_evidencia = `/uploads/${req.file.filename}`;
        }
      } else if (req.body.caminho_evidencia) {
        caminho_evidencia = req.body.caminho_evidencia;
        nome_evidencia = req.body.nome_evidencia || 'evidencia_colada.png';
      }

      const now = new Date();
      const nowStr = getBrasiliaFullString(now);

      const created = await db.addDiarioBordo({
        data_ocorrencia,
        hora_ocorrencia,
        produto,
        ocorrencia,
        impacto,
        tipo: tipo || 'Operacional',
        comentario: comentario || '',
        status: status || 'Aberto',
        responsavel,
        nome_evidencia,
        caminho_evidencia,
        usuario_registro: req.user!.nome,
        data_cadastro: nowStr,
        data_atualizacao: nowStr
      });

      return res.status(201).json({
        message: 'Ocorrência registrada com sucesso.',
        data: created
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao criar ocorrência.' });
    }
  }
);

// POST /api/diario-bordo/importar - Batch import occurrences from Excel/CSV
app.post('/api/diario-bordo/importar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro enviado para importação.' });
    }

    const now = new Date();
    const nowStr = getBrasiliaFullString(now);
    const defaultDate = getBrasiliaDateString(now);
    const defaultTime = getBrasiliaTimeString(now, false);

    const insertedList = [];
    let errorCount = 0;

    for (const item of items) {
      try {
        const created = await db.addDiarioBordo({
          data_ocorrencia: item.data_ocorrencia || defaultDate,
          hora_ocorrencia: item.hora_ocorrencia || defaultTime,
          produto: item.produto || 'Outros',
          ocorrencia: item.ocorrencia || item.sistema_impactado || 'Ocorrência Importada',
          impacto: item.impacto || 'Médio',
          tipo: item.tipo === 'Interna' ? 'Interna' : 'Operacional',
          comentario: item.comentario || '',
          status: item.status || 'Aberto',
          responsavel: item.responsavel || req.user!.nome,
          data_solucao: item.data_solucao || (item.status === 'Resolvido' ? defaultDate : ''),
          hora_solucao: item.hora_solucao || (item.status === 'Resolvido' ? defaultTime : ''),
          solucao: item.solucao || '',
          responsavel_solucao: item.responsavel_solucao || (item.status === 'Resolvido' ? req.user!.nome : ''),
          nome_evidencia: item.nome_evidencia || '',
          caminho_evidencia: item.caminho_evidencia || '',
          usuario_registro: req.user!.nome,
          data_cadastro: nowStr,
          data_atualizacao: nowStr
        });
        insertedList.push(created);
      } catch (itemErr) {
        console.error('Erro ao importar item individual do Diário de Bordo:', itemErr);
        errorCount++;
      }
    }

    return res.status(201).json({
      message: `Importação concluída com sucesso! ${insertedList.length} registro(s) importado(s).${errorCount > 0 ? ` (${errorCount} falha(s))` : ''}`,
      totalImportados: insertedList.length,
      falhas: errorCount,
      data: insertedList
    });
  } catch (err: any) {
    console.error('Erro geral ao importar diário de bordo:', err);
    return res.status(500).json({ error: err.message || 'Erro interno ao realizar importação em lote.' });
  }
});


// PUT /api/diario-bordo/:id - Update occurrence and add solution
app.put(
  '/api/diario-bordo/:id',
  authenticateToken,
  upload.single('evidencia'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

      const {
        data_ocorrencia,
        hora_ocorrencia,
        produto,
        ocorrencia,
        impacto,
        tipo,
        comentario,
        status,
        responsavel,
        data_solucao,
        hora_solucao,
        solucao,
        responsavel_solucao
      } = req.body;

      const updateData: Partial<any> = {};

      if (data_ocorrencia) updateData.data_ocorrencia = data_ocorrencia;
      if (hora_ocorrencia) updateData.hora_ocorrencia = hora_ocorrencia;
      if (produto) updateData.produto = produto;
      if (ocorrencia) updateData.ocorrencia = ocorrencia;
      if (impacto) updateData.impacto = impacto;
      if (tipo) updateData.tipo = tipo;
      if (comentario !== undefined) updateData.comentario = comentario;
      if (status) updateData.status = status;
      if (responsavel) updateData.responsavel = responsavel;

      if (data_solucao !== undefined) updateData.data_solucao = data_solucao;
      if (hora_solucao !== undefined) updateData.hora_solucao = hora_solucao;
      if (solucao !== undefined) updateData.solucao = solucao;
      if (responsavel_solucao !== undefined) updateData.responsavel_solucao = responsavel_solucao;

      if (req.file) {
        updateData.nome_evidencia = req.file.originalname || 'evidencia.png';
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const mimeType = req.file.mimetype || 'image/png';
          updateData.caminho_evidencia = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          updateData.caminho_evidencia = `/uploads/${req.file.filename}`;
        }
      } else if (req.body.caminho_evidencia) {
        updateData.caminho_evidencia = req.body.caminho_evidencia;
        if (req.body.nome_evidencia) updateData.nome_evidencia = req.body.nome_evidencia;
      }

      const updated = await db.updateDiarioBordo(id, updateData, req.user!.nome);
      if (!updated) {
        return res.status(404).json({ error: 'Ocorrência não encontrada.' });
      }

      return res.json({
        message: 'Ocorrência atualizada com sucesso.',
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao atualizar ocorrência.' });
    }
  }
);

// DELETE /api/diario-bordo/:id
app.delete('/api/diario-bordo/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    await db.deleteDiarioBordo(id);
    return res.json({ message: 'Ocorrência excluída com sucesso.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao excluir ocorrência.' });
  }
});

app.delete(
  '/api/sinalizacoes/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de sinalização inválido.' });
    }
    await db.deleteSinalizacao(id);
    return res.json({ success: true, message: 'Sinalização excluída com sucesso.' });
  }
);

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', authenticateToken, async (req: Request, res: Response) => {
  const { dataInicial, dataFinal, produto, supervisor, operador } = req.query;

  // Helper functions for date & hour parsing (handles JS Date objects & ISO/string formats)
  const parseSinalizacaoDate = (s: any): { dateKey: string; displayLabel: string } | null => {
    if (!s) return null;
    const val = s.data || s.data_cadastro || s.created_at;
    if (!val) return null;

    let d: Date | null = null;

    if (val instanceof Date) {
      d = val;
    } else {
      const str = String(val).trim();
      if (!str) return null;

      if (str.includes('T')) {
        const isoDatePart = str.split('T')[0];
        const parts = isoDatePart.split('-');
        if (parts.length === 3) {
          return { dateKey: isoDatePart, displayLabel: `${parts[2]}/${parts[1]}` };
        }
      }

      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const datePart = str.substring(0, 10);
        const parts = datePart.split('-');
        return { dateKey: datePart, displayLabel: `${parts[2]}/${parts[1]}` };
      }

      if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
        const parts = str.substring(0, 10).split('/');
        return { dateKey: `${parts[2]}-${parts[1]}-${parts[0]}`, displayLabel: `${parts[0]}/${parts[1]}` };
      }

      const p = new Date(str);
      if (!isNaN(p.getTime())) {
        d = p;
      }
    }

    if (d && !isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return { dateKey: `${yyyy}-${mm}-${dd}`, displayLabel: `${dd}/${mm}` };
    }

    return null;
  };

  const parseSinalizacaoHour = (s: any): string | null => {
    if (!s) return null;

    if (s.hora !== undefined && s.hora !== null) {
      const rawHora = String(s.hora).trim();
      if (rawHora) {
        const matchColon = rawHora.match(/^(\d{1,2}):/);
        if (matchColon) {
          const hNum = parseInt(matchColon[1], 10);
          if (!isNaN(hNum) && hNum >= 0 && hNum <= 23) {
            return `${String(hNum).padStart(2, '0')}h`;
          }
        }
        const matchH = rawHora.match(/^(\d{1,2})/);
        if (matchH) {
          const hNum = parseInt(matchH[1], 10);
          if (!isNaN(hNum) && hNum >= 0 && hNum <= 23) {
            return `${String(hNum).padStart(2, '0')}h`;
          }
        }
      }
    }

    const val = s.data_cadastro || s.data;
    if (!val) return null;

    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else {
      const str = String(val).trim();
      if (str.includes('T') || str.includes(' ') || str.includes(':')) {
        const p = new Date(str);
        if (!isNaN(p.getTime())) {
          d = p;
        }
      }
    }

    if (d && !isNaN(d.getTime())) {
      const hNum = d.getHours();
      return `${String(hNum).padStart(2, '0')}h`;
    }

    return null;
  };

  let list = await db.getSinalizacoes();

  if (dataInicial && typeof dataInicial === 'string' && dataInicial) {
    list = list.filter((s) => s.data >= dataInicial);
  }
  if (dataFinal && typeof dataFinal === 'string' && dataFinal) {
    list = list.filter((s) => s.data <= dataFinal);
  }
  let tabelaList = list;

  if (!dataInicial && !dataFinal) {
    const { year, month } = getBrasiliaDateParts();
    const currentMonthPrefix = `${year}-${month}`;
    const todayKey = getBrasiliaDateString();

    list = list.filter((s: any) => {
      const parsed = parseSinalizacaoDate(s);
      return parsed ? parsed.dateKey.startsWith(currentMonthPrefix) : false;
    });

    tabelaList = list.filter((s: any) => {
      const parsed = parseSinalizacaoDate(s);
      return parsed ? parsed.dateKey === todayKey : false;
    });
  }

  if (produto && typeof produto === 'string' && produto !== 'Todos') {
    const prodLower = produto.toLowerCase();
    list = list.filter((s) => s.produto.toLowerCase() === prodLower);
    tabelaList = tabelaList.filter((s) => s.produto.toLowerCase() === prodLower);
  }
  if (supervisor && typeof supervisor === 'string' && supervisor !== 'Todos') {
    const targetSup = supervisor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/z/g, 's').trim();
    const filterSup = (s: any) => {
      const itemSup = (s.supervisor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/z/g, 's').trim();
      return itemSup === targetSup;
    };
    list = list.filter(filterSup);
    tabelaList = tabelaList.filter(filterSup);
  }
  if (operador && typeof operador === 'string' && operador !== 'Todos' && operador.trim()) {
    const qOp = operador.toLowerCase().trim();
    const allOps = await db.getOperadores();
    const matchingOpNames = new Set<string>();
    for (const o of allOps) {
      if (
        o.nome.toLowerCase().includes(qOp) ||
        (o.intergrall && o.intergrall.toLowerCase().includes(qOp))
      ) {
        matchingOpNames.add(o.nome.toLowerCase().trim());
      }
    }
    const filterOp = (s: any) => {
      const sOp = (s.operador || '').toLowerCase().trim();
      return sOp.includes(qOp) || matchingOpNames.has(sOp);
    };
    list = list.filter(filterOp);
    tabelaList = tabelaList.filter(filterOp);
  }

  // Cards metrics derived strictly from filtered list
  const totalSinalizacoes = list.length;
  const operadoresSet = new Set(list.map((s) => s.operador));
  const totalOperadoresSinalizados = operadoresSet.size;

  const supervisoresSet = new Set(list.map((s) => s.supervisor));
  const totalSupervisoresComSinalizacoes = supervisoresSet.size;

  const totalMotivosCadastrados = (await db.getMotivos()).length;

  // Confirmados e % Tratados real
  const confirmadosCount = list.filter((s: any) =>
    s.confirmado === true ||
    String(s.confirmado) === 'true' ||
    s.confirmado === 1 ||
    !!s.data_confirmacao ||
    (s.status && String(s.status).toLowerCase().includes('confirmad'))
  ).length;
  const percentualTratados = totalSinalizacoes > 0 ? Math.round((confirmadosCount / totalSinalizacoes) * 100) : 0;

  // Tempo médio real em minutos
  let totalMinutosConfirmados = 0;
  let countComTempo = 0;
  list.forEach((s: any) => {
    if ((s.confirmado || s.data_confirmacao) && s.data_confirmacao) {
      try {
        const startStr = s.data && s.hora ? `${s.data}T${s.hora}` : (s.data_cadastro || s.data);
        const start = new Date(startStr).getTime();
        const end = new Date(s.data_confirmacao).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          totalMinutosConfirmados += (end - start) / (1000 * 60);
          countComTempo++;
        }
      } catch (e) {}
    }
  });
  const tempoMedioMinutos = countComTempo > 0 ? Math.round(totalMinutosConfirmados / countComTempo) : 0;

  // Operator counts & Reincidentes (operadores com >= 2 sinalizações)
  const allOps = await db.getOperadores();
  const opIntergrallMap = new Map<string, string>();
  for (const o of allOps) {
    if (o.intergrall) {
      opIntergrallMap.set(o.nome.toLowerCase().trim(), o.intergrall);
    }
  }

  const opCounts: Record<string, number> = {};
  const opRawNameMap: Record<string, string> = {};

  list.forEach((s: any) => {
    const rawOp = (s.operador || s.operador_nome || s.nome_operador || '').toString().trim();
    if (rawOp) {
      const key = rawOp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      opCounts[key] = (opCounts[key] || 0) + 1;
      if (!opRawNameMap[key]) {
        opRawNameMap[key] = rawOp;
      }
    }
  });

  const totalReincidentes = Object.values(opCounts).filter((c) => c >= 2).length;
  const reincidentes5plus = Object.values(opCounts).filter((c) => c >= 5).length;

  // Evolução das sinalizações por data (Dia/Mês)
  const dateMap: Record<string, { label: string; count: number }> = {};
  list.forEach((s: any) => {
    const parsed = parseSinalizacaoDate(s);
    if (parsed) {
      if (!dateMap[parsed.dateKey]) {
        dateMap[parsed.dateKey] = { label: parsed.displayLabel, count: 0 };
      }
      dateMap[parsed.dateKey].count++;
    }
  });

  const sortedDates = Object.keys(dateMap).sort();
  const evolucaoSinalizacoes = sortedDates.map((dKey) => ({
    data: dKey,
    label: dateMap[dKey].label,
    quantidade: dateMap[dKey].count
  }));

  // Sinalizações por Horário (00h, 01h ... 23h)
  const horaMap: Record<string, number> = {};
  list.forEach((s: any) => {
    const hourKey = parseSinalizacaoHour(s);
    if (hourKey) {
      horaMap[hourKey] = (horaMap[hourKey] || 0) + 1;
    }
  });

  const sortedHours = Object.keys(horaMap).sort();
  const sinalizacoesPorHorario = sortedHours.map((h) => ({
    hora: h,
    quantidade: horaMap[h]
  }));

  // Chart 1: Quantidade de sinalizações por Supervisor
  const supCounts: Record<string, number> = {};
  const supDisplayNameMap: Record<string, string> = {};

  list.forEach((s) => {
    const rawName = (s.supervisor || '').trim();
    if (!rawName) return;
    const key = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/z/g, 's').trim();
    supCounts[key] = (supCounts[key] || 0) + 1;
    if (!supDisplayNameMap[key] || rawName.includes('SOUSA')) {
      supDisplayNameMap[key] = rawName;
    }
  });

  const sinalizacoesPorSupervisor = Object.entries(supCounts).map(([key, count]) => ({
    supervisor: supDisplayNameMap[key] || key,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Chart 2: Maiores motivos de sinalização (com percentual)
  const motivoCounts: Record<string, number> = {};
  list.forEach((s) => {
    motivoCounts[s.motivo] = (motivoCounts[s.motivo] || 0) + 1;
  });
  const maioresMotivos = Object.entries(motivoCounts).map(([motivo, count]) => ({
    motivo,
    quantidade: count,
    percentual: totalSinalizacoes > 0 ? Math.round((count / totalSinalizacoes) * 100) : 0
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Chart 3: Top 5 operadores mais sinalizados
  const topOperadores = Object.entries(opCounts)
    .map(([operador, count]) => {
      const fullIntergrall = opIntergrallMap.get(operador.toLowerCase().trim()) || '';
      let apelido = fullIntergrall;
      if (fullIntergrall.includes('/')) {
        const parts = fullIntergrall.split('/').map((p) => p.trim());
        apelido = parts[1] || parts[0];
      }
      if (!apelido) {
        const parts = operador.split(/\s+/);
        apelido = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : operador;
      }
      return {
        operador,
        intergrall: fullIntergrall,
        label: apelido,
        quantidade: count
      };
    })
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // Chart 4: Quantidade de sinalizações por Produto
  const prodCounts: Record<string, number> = {};
  list.forEach((s) => {
    prodCounts[s.produto] = (prodCounts[s.produto] || 0) + 1;
  });
  const sinalizacoesPorProduto = Object.entries(prodCounts).map(([prod, count]) => ({
    produto: prod,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Insights gerados dinamicamente com dados reais DO DIA (tabelaList)
  const insightsTotal = tabelaList.length;
  const insightsMotivoCounts: Record<string, number> = {};
  const insightsHoraMap: Record<string, number> = {};
  const insightsOpCounts: Record<string, number> = {};
  let insightsConfirmadosCount = 0;

  tabelaList.forEach((s: any) => {
    const m = (s.motivo || 'Outros').trim();
    if (m) insightsMotivoCounts[m] = (insightsMotivoCounts[m] || 0) + 1;

    const hourKey = parseSinalizacaoHour(s);
    if (hourKey) insightsHoraMap[hourKey] = (insightsHoraMap[hourKey] || 0) + 1;

    const rawOp = (s.operador || '').trim();
    if (rawOp) {
      const key = rawOp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      insightsOpCounts[key] = (insightsOpCounts[key] || 0) + 1;
    }

    const isConfirmado =
      s.confirmado === true ||
      String(s.confirmado) === 'true' ||
      s.confirmado === 1 ||
      !!s.data_confirmacao ||
      (s.status && String(s.status).toLowerCase().includes('confirmad'));
    if (isConfirmado) insightsConfirmadosCount++;
  });

  const topMotivoInsight = Object.entries(insightsMotivoCounts).sort((a, b) => b[1] - a[1])[0];
  const peakHoraInsight = Object.entries(insightsHoraMap).sort((a, b) => b[1] - a[1])[0];
  const insightsTotalReincidentes = Object.values(insightsOpCounts).filter((c) => c >= 2).length;
  const insightsReincidentes5plus = Object.values(insightsOpCounts).filter((c) => c >= 5).length;
  const insightsPercentualTratados = insightsTotal > 0 ? Math.round((insightsConfirmadosCount / insightsTotal) * 100) : 0;

  const insights: string[] = [];
  if (insightsTotal === 0) {
    insights.push('Nenhuma sinalização registrada no dia atual.');
  } else {
    if (topMotivoInsight) {
      const pct = Math.round((topMotivoInsight[1] / insightsTotal) * 100);
      insights.push(`Motivo "${topMotivoInsight[0]}" lidera hoje com ${topMotivoInsight[1]} sinalizações (${pct}% do dia)`);
    }
    if (peakHoraInsight) {
      insights.push(`Maior concentração de sinalizações hoje no horário das ${peakHoraInsight[0]} (${peakHoraInsight[1]} ocorrências)`);
    }
    if (insightsReincidentes5plus > 0) {
      insights.push(`${insightsReincidentes5plus} operador(es) possuem 5+ reincidências no dia`);
    } else if (insightsTotalReincidentes > 0) {
      insights.push(`${insightsTotalReincidentes} operador(es) possuem reincidências no dia`);
    }
    insights.push(`${insightsPercentualTratados}% dos sinais do dia foram devidamente tratados (${insightsConfirmadosCount} de ${insightsTotal})`);
  }

  return res.json({
    totalSinalizacoes,
    percentualTratados,
    tempoMedioMinutos,
    totalReincidentes,
    totalOperadoresSinalizados,
    totalSupervisoresComSinalizacoes,
    totalMotivosCadastrados,
    evolucaoSinalizacoes,
    sinalizacoesPorHorario,
    sinalizacoesPorSupervisor,
    maioresMotivos,
    topOperadores,
    sinalizacoesPorProduto,
    insights,
    resumoTabela: tabelaList
  });
});

// --- ROTA DE IA PARA RELATÓRIOS DE REINCIDÊNCIA ---
app.post('/api/ia/relatorio-reincidencia', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { periodo, totalReincidentes, totalCriticos, reincidentes } = req.body;

    const periodoLabel =
      periodo === 'dia'
        ? 'Hoje (últimas 24h)'
        : periodo === 'semana'
        ? 'Últimos 7 Dias'
        : periodo === 'mes'
        ? 'Últimos 30 Dias'
        : 'Filtro Atual do Dashboard';

    let diagnosisText = '';

    if (process.env.GEMINI_API_KEY && aiClient) {
      try {
        const prompt = `Você é um Consultor Sênior de Operações de Control Desk e Inteligência Operacional.
Gere um Diagnóstico Executivo de Reincidência de Falhas para a liderança.

DADOS DA ANÁLISE:
- Período: ${periodoLabel}
- Total de Operadores Reincidentes: ${totalReincidentes}
- Casos com Reincidência Crítica (3x ou mais no MESMO motivo): ${totalCriticos}
- Reincidentes: ${JSON.stringify(reincidentes?.slice(0, 10) || [], null, 2)}

INSTRUÇÕES DO RELATÓRIO:
1. Apresente um resumo executivo direto e objetivo.
2. Destaque em ALERTA DE RISCO os operadores com 3 ou mais ocorrências DO MESMO MOTIVO, informando o motivo exato e o supervisor responsável.
3. Identifique o motivo campeão de reincidência.
4. Forneça 3 orientações práticas para a supervisão estancar essas ocorrências nas próximas 24-48 horas.
Use formatação Markdown elegante com tópicos, negritos e emojis executivos.`;

        let response;
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
          });
        } catch (e1) {
          response = await aiClient.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
          });
        }

        diagnosisText = response.text || '';
      } catch (geminiErr) {
        console.warn('[AI] Gemini API call fallback to local engine:', geminiErr);
      }
    }

    if (!diagnosisText) {
      const criticosList = (reincidentes || []).filter((r: any) => r.isCritical);
      const topMotivosObj: Record<string, number> = {};
      (reincidentes || []).forEach((r: any) => {
        Object.entries(r.motivosMap || {}).forEach(([m, c]: [string, any]) => {
          topMotivosObj[m] = (topMotivosObj[m] || 0) + Number(c);
        });
      });
      const topMotivoSorted = Object.entries(topMotivosObj).sort((a, b) => b[1] - a[1])[0];

      diagnosisText = `### 📊 Diagnóstico Executivo de Reincidência (IA)
**Período Analisado:** ${periodoLabel} | **Data do Relatório:** ${getBrasiliaFullString()}

#### 🚨 Sumário de Riscos e Casos Críticos (≥ 3x no mesmo motivo)
- **Total de Reincidentes:** ${totalReincidentes} operador(es).
- **Casos de Alerta Crítico:** ${totalCriticos} operador(es).
${
  criticosList.length > 0
    ? criticosList
        .map(
          (c: any) =>
            `  • **${c.operador}** (Sup. ${c.supervisor || 'N/I'}): **${c.criticalMotives
              ?.map((m: any) => `${m.count}x "${m.motivo}"`)
              .join(', ')}**`
        )
        .join('\n')
    : '  • Nenhum operador atingiu o gatilho crítico (3x no mesmo motivo) no período.'
}

#### 🔍 Gargalo Operacional Dominante
${
  topMotivoSorted
    ? `- O motivo com maior reincidência acumulada é **"${topMotivoSorted[0]}"** com **${topMotivoSorted[1]} ocorrências**.`
    : '- Reincidências distribuídas sem concentração atípica.'
}

#### 🛠️ Plano de Ação Recomendado para Supervisores
1. **Feedback e Alinhamento Imediato**: Realizar escuta e orientação com os operadores em Alerta Crítico em até 24 horas.
2. **Checagem de Processo / Sistema**: Avaliar se a causa raiz de "${
        topMotivoSorted ? topMotivoSorted[0] : 'falha recorrente'
      }" está atrelada a falta de treinamento ou instabilidade no ambiente.
3. **Acompanhamento Control Desk**: Monitorar a curva de sinalizações dos reincidentes no próximo plantão para validar a eficácia da ação.`;
    }

    return res.json({ success: true, diagnosis: diagnosisText });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao gerar relatório de IA' });
  }
});

// --- ROTA DE IA PARA RELATÓRIOS DE ABSENTEÍSMO ---
app.post('/api/ia/relatorio-absenteismo', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { periodo, totalFaltas, totalInjustificadas, totalJustificadas, operadoresComFaltas } = req.body;

    const periodoLabel =
      periodo === 'dia'
        ? 'Hoje (últimas 24h)'
        : periodo === 'semana'
        ? 'Últimos 7 Dias'
        : periodo === 'mes'
        ? 'Últimos 30 Dias'
        : 'Todo o Período Cadastrado';

    let diagnosisText = '';

    if (process.env.GEMINI_API_KEY && aiClient) {
      try {
        const prompt = `Você é um Consultor Sênior de Operações de Control Desk e Gestão de Absenteísmo.
Gere um Diagnóstico Executivo de Faltas e Frequência dos Operadores para a liderança.

DADOS DA ANÁLISE DE ABSENTEÍSMO:
- Período: ${periodoLabel}
- Total Geral de Faltas: ${totalFaltas} (Injustificadas: ${totalInjustificadas}, Justificadas: ${totalJustificadas})
- Total de Operadores com Faltas Registradas: ${operadoresComFaltas?.length || 0}
- Detalhamento dos Operadores com Maior Índice de Faltas: ${JSON.stringify(operadoresComFaltas?.slice(0, 10) || [], null, 2)}

INSTRUÇÕES DO RELATÓRIO:
1. Apresente um resumo executivo da aderência e taxa de faltas no período.
2. Destaque em ALERTA DE RISCO os operadores com faltas injustificadas recorrentes (2x ou mais), informando o supervisor responsável e observações cadastradas.
3. Analise o impacto das faltas por supervisor / equipe.
4. Forneça 3 diretrizes práticas para a supervisão e RH operacional tratarem o absenteísmo e reduzirem as ausências não justificadas.
Use formatação Markdown elegante com tópicos, negritos e emojis executivos.`;

        let response;
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
          });
        } catch (e1) {
          response = await aiClient.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
          });
        }

        diagnosisText = response.text || '';
      } catch (geminiErr) {
        console.warn('[AI] Gemini API call fallback to local engine:', geminiErr);
      }
    }

    if (!diagnosisText) {
      diagnosisText = `### 📊 DIAGNÓSTICO INTELIGENTE DE ABSENTEÍSMO (${periodoLabel})
**Data do Parecer:** ${getBrasiliaFullString()}

#### 📈 Resumo Operacional de Faltas
- **Total de Faltas no Período:** ${totalFaltas} ocorrência(s).
- **Faltas Injustificadas:** ${totalInjustificadas} (requerem acompanhamento direto).
- **Faltas Justificadas:** ${totalJustificadas} (com atestado/justificativa cadastrada).
- **Operadores Envolvidos:** ${operadoresComFaltas?.length || 0} operador(es).

`;
      const criticos = (operadoresComFaltas || []).filter((o: any) => o.injustificadas >= 2 || o.totalFaltas >= 3);
      if (criticos.length > 0) {
        diagnosisText += `#### 🚨 ALERTA CRÍTICO DE FALTAS RECORRENTES\n`;
        criticos.forEach((c: any) => {
          diagnosisText += `- **${c.operador}** (Supervisor: *${c.supervisor}*): **${c.totalFaltas} falta(s)** (${c.injustificadas} Injustificada(s), ${c.justificadas} Justificada(s))\n`;
        });
        diagnosisText += `\n`;
      } else {
        diagnosisText += `#### ✅ AVALIAÇÃO DE RISCO\n- Nenhuma concentração crítica de faltas recorrentes identificada para o filtro selecionado.\n\n`;
      }
      diagnosisText += `#### 🛠️ DIRETRIZES RECOMENDADAS PARA A SUPERVISÃO\n`;
      diagnosisText += `1. **Entrevista de Retorno (Feedback)**: Aplicar alinhamento com operadores reincidentes no primeiro dia de retorno pós-falta.\n`;
      diagnosisText += `2. **Auditoria de Justificativas**: Validar atestados e justificativas lançadas junto ao setor médico/RH.\n`;
      diagnosisText += `3. **Plano de Ação por Equipe**: Monitorar supervisores com maior concentração de faltas injustificadas para ajuste no dimensionamento de escala.`;
    }

    return res.json({ success: true, diagnosis: diagnosisText });
  } catch (err: any) {
    console.error('Erro ao gerar relatório de absenteísmo por IA:', err);
    return res.status(500).json({ success: false, message: 'Erro ao processar análise inteligente.' });
  }
});

// --- ROTA DE ENVIAR E-MAIL ---
app.post('/api/email/enviar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { to, subject, body } = req.body;
    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum destinatário informado.' });
    }

    console.log(`[EMAIL] Envio acionado por ${req.user?.nome} (${req.user?.login}) para ${to.length} destinatário(s)`);

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    // Se o SMTP estiver configurado no .env, realiza o disparo real via SMTP do Node.js
    if (smtpHost && smtpHost.trim() !== '') {
      if (smtpUser && (!smtpPass || smtpPass.trim() === '')) {
        return res.status(400).json({
          success: false,
          sentViaSmtp: false,
          message: `⚠️ Configuração de SMTP parcial. Insira a senha no parâmetro SMTP_PASS do arquivo .env do servidor para realizar o envio automático.`
        });
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: smtpUser ? { user: smtpUser, pass: smtpPass || '' } : undefined,
          tls: {
            rejectUnauthorized: false
          }
        });

        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser || `"Diário de Bordo" <sinalizacoes@proativacontactcenter.com.br>`,
          to: to.join(', '),
          subject: subject || '[Sinalizações Operacionais] Relatório de Ocorrências',
          text: body
        });

        console.log(`[EMAIL] E-mail disparado com sucesso via SMTP (${smtpHost}):`, info.messageId);

        return res.json({
          success: true,
          sentViaSmtp: true,
          message: `✅ E-mail enviado com sucesso via SMTP para ${to.length} destinatário(s)!`
        });
      } catch (smtpErr: any) {
        console.error(`[EMAIL] Falha ao enviar via SMTP (${smtpHost}):`, smtpErr);
        return res.status(500).json({
          success: false,
          sentViaSmtp: false,
          message: `⚠️ Falha ao conectar ao SMTP (${smtpErr.message || 'Erro de rede'}). Verifique as credenciais no .env.`
        });
      }
    }

    // Se o SMTP ainda não foi configurado no arquivo .env
    console.log('[EMAIL] SMTP_HOST não definido no .env do servidor.');
    return res.json({
      success: false,
      sentViaSmtp: false,
      message: `⚠️ Para enviar e-mails diretamente pelo sistema, preencha SMTP_HOST, SMTP_USER e SMTP_PASS no arquivo .env do servidor. O texto formatado foi copiado para sua área de transferência (Ctrl+V).`
    });
  } catch (err: any) {
    console.error('Erro ao processar envio de e-mail:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar e-mail.' });
  }
});

// --- USUÁRIOS ROUTES (Admin) ---
app.get(
  '/api/usuarios',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const list = (await db.getUsuarios()).map(({ senha, ...u }) => u);
    return res.json(list);
  }
);

app.post(
  '/api/usuarios',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome, login, senha, perfil, status, produto, supervisor } = req.body;

    if (!nome || !login || !senha || !perfil) {
      return res.status(400).json({ error: 'Nome, login, senha e perfil são obrigatórios.' });
    }

    if (await db.getUsuarioByLogin(login)) {
      return res.status(400).json({ error: 'Já existe um usuário com este login.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(senha, salt);

    const newUser = await db.addUsuario({
      nome,
      login,
      senha: hashedPassword,
      perfil,
      status: status || 'Ativo',
      produto: produto || 'Todos',
      supervisor: supervisor || 'Todos'
    });

    const { senha: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  }
);

app.put(
  '/api/usuarios/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { nome, perfil, status, produto, supervisor } = req.body;

    const existing = await db.getUsuarioById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updated = await db.updateUsuario(id, {
      ...(nome && { nome }),
      ...(perfil && { perfil }),
      ...(status && { status }),
      ...(produto && { produto }),
      ...(supervisor && { supervisor })
    });

    if (!updated) return res.status(404).json({ error: 'Erro ao atualizar.' });

    const { senha: _, ...userWithoutPassword } = updated;
    return res.json(userWithoutPassword);
  }
);

app.put(
  '/api/usuarios/:id/reset-password',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { novaSenha } = req.body;

    if (!novaSenha || novaSenha.length < 3) {
      return res.status(400).json({ error: 'Informe uma nova senha válida (mínimo 3 caracteres).' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(novaSenha, salt);

    const updated = await db.updateUsuario(id, { senha: hashedPassword });
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });

    return res.json({ message: 'Senha resetada com sucesso.' });
  }
);

app.delete(
  '/api/usuarios/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteUsuario(id);
    return res.json({ message: 'Usuário excluído com sucesso.' });
  }
);

// --- SUPERVISORES ROUTES ---
app.get('/api/supervisores', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getSupervisores());
});

function generateSupervisorLogin(nome: string): string {
  const clean = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'supervisor';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

app.post(
  '/api/supervisores',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome, produto, status } = req.body;
    if (!nome || !produto) {
      return res.status(400).json({ error: 'Nome e Produto são obrigatórios.' });
    }

    const newSup = await db.addSupervisor({
      nome,
      produto,
      status: status || 'Ativo'
    });

    // Auto-create user for supervisor with login "nome.sobrenome" and password "123456"
    try {
      const baseLogin = generateSupervisorLogin(nome);
      let loginToUse = baseLogin;
      let counter = 1;
      while (await db.getUsuarioByLogin(loginToUse)) {
        loginToUse = `${baseLogin}${counter}`;
        counter++;
      }

      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('123456', salt);

      await db.addUsuario({
        nome,
        login: loginToUse,
        senha: hashedPassword,
        perfil: 'Operação',
        status: status || 'Ativo',
        produto: produto || 'Todos',
        supervisor: nome
      });
    } catch (err) {
      console.warn('Erro ao criar usuário automático para o supervisor:', err);
    }

    return res.status(201).json(newSup);
  }
);

app.put(
  '/api/supervisores/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { nome, produto, status } = req.body;

    const updated = await db.updateSupervisor(id, {
      ...(nome && { nome }),
      ...(produto && { produto }),
      ...(status && { status })
    });

    if (!updated) return res.status(404).json({ error: 'Supervisor não encontrado.' });
    return res.json(updated);
  }
);

app.delete(
  '/api/supervisores/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteSupervisor(id);
    return res.json({ message: 'Supervisor excluído com sucesso.' });
  }
);

// --- OPERADORES ROUTES ---
app.get('/api/operadores', authenticateToken, async (req: Request, res: Response) => {
  let ops = await db.getOperadores();
  if (ops.length === 0 || ops.some((o) => !o.entrada)) {
    try {
      await performApiSync();
      ops = await db.getOperadores();
    } catch (e: any) {
      console.warn('Auto sync in GET /api/operadores failed:', e?.message || e);
    }
  }
  return res.json(ops);
});

// --- PERFIS & PERMISSÕES ROUTES ---
app.get('/api/perfis-regras', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getPerfisConfig());
});

app.post(
  '/api/perfis-regras',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome, descricao, permissoes } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do perfil é obrigatório.' });
    const saved = await db.savePerfilConfig({ nome, descricao, permissoes, is_custom: true });
    return res.status(201).json(saved);
  }
);

app.put(
  '/api/perfis-regras/:nome',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome, descricao, permissoes, is_custom } = req.body;
    const targetNome = req.params.nome;
    const saved = await db.savePerfilConfig({ nome: nome || targetNome, descricao, permissoes, is_custom });
    return res.json(saved);
  }
);

app.delete(
  '/api/perfis-regras/:nome',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const targetNome = req.params.nome;
    const deleted = await db.deletePerfilConfig(targetNome);
    if (!deleted) return res.status(404).json({ error: 'Perfil não encontrado ou não pode ser excluído.' });
    return res.json({ message: 'Perfil excluído com sucesso.' });
  }
);

// --- PRODUTOS ROUTES ---
app.get('/api/produtos', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getProdutos());
});

app.post(
  '/api/produtos',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do produto é obrigatório.' });
    const prod = await db.addProduto(nome);
    return res.status(201).json(prod);
  }
);

app.put(
  '/api/produtos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do produto é obrigatório.' });
    const updated = await db.updateProduto(id, nome);
    if (!updated) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json(updated);
  }
);

app.delete(
  '/api/produtos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteProduto(id);
    return res.json({ message: 'Produto excluído com sucesso.' });
  }
);

// --- MOTIVOS ROUTES ---
app.get('/api/motivos', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getMotivos());
});

app.post(
  '/api/motivos',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descrição é obrigatória.' });
    const newMotivo = await db.addMotivo(descricao);
    return res.status(201).json(newMotivo);
  }
);

app.put(
  '/api/motivos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descrição é obrigatória.' });
    const updated = await db.updateMotivo(id, descricao);
    if (!updated) return res.status(404).json({ error: 'Motivo não encontrado.' });
    return res.json(updated);
  }
);

app.delete(
  '/api/motivos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteMotivo(id);
    return res.json({ message: 'Motivo excluído com sucesso.' });
  }
);

// --- CONFIGURAÇÃO DE API & SINCRONIZAÇÃO ROUTES ---
app.get(
  '/api/config-api',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const config = await db.getConfigApi();
    return res.json({ ...config, senha: '••••••••••••' });
  }
);

app.post(
  '/api/config-api',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { url_api, token, usuario, senha } = req.body;
    const updated = await db.updateConfigApi({
      url_api,
      token,
      usuario,
      ...(senha && senha !== '••••••••••••' && { senha })
    });
    return res.json({ message: 'Configuração de API salva com sucesso.', data: updated });
  }
);

app.post(
  '/api/config-api/test',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { url_api } = req.body;
    if (!url_api) {
      return res.status(400).json({ success: false, message: 'URL da API não informada.' });
    }
    try {
      const config = await db.getConfigApi();
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (config.token) {
        headers['Authorization'] = config.token.startsWith('Bearer ') ? config.token : `Bearer ${config.token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url_api, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return res.json({
          success: true,
          message: `Conexão com a API (${url_api}) estabelecida com sucesso (HTTP ${response.status} ${response.statusText}).`
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `A API respondeu com código de erro HTTP ${response.status} ${response.statusText}.`
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao tentar conectar à API (${url_api}): ${err.message || 'Falha de conexão'}`
      });
    }
  }
);

export async function performApiSync() {
  const config = await db.getConfigApi();
  if (!config.url_api) {
    throw new Error('Nenhuma URL de API configurada. Por favor, salve uma URL válida em Configuração da API.');
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  if (config.token) {
    headers['Authorization'] = config.token.startsWith('Bearer ') ? config.token : `Bearer ${config.token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(config.url_api, {
    method: 'GET',
    headers,
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`A API respondeu com erro HTTP ${response.status} ${response.statusText}`);
  }

  const apiData = await response.json();

  let opCountNew = 0;
  let opCountUpdated = 0;
  let supCount = 0;
  let prodCount = 0;

  if (apiData) {
    const ops = Array.isArray(apiData)
      ? apiData
      : apiData.operadores || apiData.colaboradores || apiData.users || [];
    const sups = apiData.supervisores || [];
    const prods = apiData.produtos || [];

    // Pre-fetch current DB states for fast lookup
    const existingOps = await db.getOperadores();
    const opsMap = new Map<string, Operador>();
    for (const o of existingOps) {
      opsMap.set(o.nome.toLowerCase().trim(), o);
    }

    const existingSups = await db.getSupervisores();
    const supsSet = new Set<string>();
    for (const s of existingSups) {
      supsSet.add(s.nome.toLowerCase().trim());
    }

    const existingProds = await db.getProdutos();
    const prodsSet = new Set<string>();
    for (const p of existingProds) {
      prodsSet.add(p.nome.toLowerCase().trim());
    }

    // Process operators (supervisores and produtos tables are managed solely via Cadastro)
    if (Array.isArray(ops)) {
      const processedInThisSync = new Set<string>();
      for (const o of ops) {
        const nomeOp = (typeof o === 'string' ? o : o.nome || o.name || '').trim();
        if (!nomeOp) continue;
        const opKey = nomeOp.toLowerCase();
        if (processedInThisSync.has(opKey)) continue;
        processedInThisSync.add(opKey);

        const supervisor = (typeof o === 'object' && (o.supervisor || o.supervisor_nome))
          ? String(o.supervisor || o.supervisor_nome).trim()
          : 'Geral';

        const produto = (typeof o === 'object' && (o.atendimento || o.produto || o.agrupamento))
          ? String(o.atendimento || o.produto || o.agrupamento).trim()
          : 'Geral';

        let situacao = 'Ativo';
        if (Array.isArray(o)) {
          situacao = String(o[0] || 'Ativo').trim();
        } else if (typeof o === 'object' && o !== null) {
          const firstVal = Object.values(o)[0];
          situacao = String(
            o.situacao ||
            o.status ||
            o.STATUS ||
            o.SITUACAO ||
            o.SITUAÇÃO ||
            (typeof firstVal === 'string' && (firstVal.toLowerCase().includes('ativ') || firstVal.toLowerCase().includes('inat') || firstVal === 'A' || firstVal === 'I') ? firstVal : '') ||
            'Ativo'
          ).trim();
        }

        const intergrall = (typeof o === 'object' && (o.intergrall || o.intergrall_apelido))
          ? Array.from(new Set([o.intergrall, o.intergrall_apelido].filter(Boolean))).join(' / ').trim()
          : '';

        const entrada = (typeof o === 'object' && (o.entrada || o.horario_entrada || o.hora_entrada))
          ? String(o.entrada || o.horario_entrada || o.hora_entrada).trim()
          : '';

        const cargo = (typeof o === 'object' && (o.cargo || o.funcao || o.role))
          ? String(o.cargo || o.funcao || o.role).trim()
          : '';

        // Insert or update operator
        const existing = opsMap.get(nomeOp.toLowerCase());
        if (!existing) {
          await db.addOperador({
            nome: nomeOp,
            produto: produto || 'Geral',
            supervisor: supervisor || 'Geral',
            situacao: situacao || 'Ativo',
            intergrall,
            entrada,
            cargo
          });
          opCountNew++;
        } else if (
          existing.supervisor !== supervisor ||
          existing.produto !== produto ||
          existing.situacao !== situacao ||
          (intergrall && existing.intergrall !== intergrall) ||
          (entrada && existing.entrada !== entrada) ||
          (cargo && existing.cargo !== cargo)
        ) {
          await db.updateOperador(existing.id, {
            supervisor: supervisor || existing.supervisor,
            produto: produto || existing.produto,
            situacao: situacao || existing.situacao,
            intergrall: intergrall || existing.intergrall,
            entrada: entrada || existing.entrada || '',
            cargo: cargo || existing.cargo || ''
          });
          opCountUpdated++;
        }
      }
    }
  }

  const now = new Date();
  const formattedDate = getBrasiliaFullString(now);
  await db.updateConfigApi({ ultima_sincronizacao: formattedDate });

  return {
    operadoresNovos: opCountNew,
    operadoresAtualizados: opCountUpdated,
    supervisoresAtualizados: supCount,
    produtosSincronizados: prodCount,
    dataSincronizacao: formattedDate
  };
}

app.post(
  '/api/config-api/sync',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    try {
      const detalhes = await performApiSync();
      return res.json({
        success: true,
        message: 'Sincronização com a API externa realizada com sucesso!',
        detalhes: {
          operadoresAtualizados: detalhes.operadoresNovos + detalhes.operadoresAtualizados,
          supervisoresAtualizados: detalhes.supervisoresAtualizados,
          produtosSincronizados: detalhes.produtosSincronizados,
          dataSincronizacao: detalhes.dataSincronizacao
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao sincronizar com a API: ${err.message || 'Falha de conexão'}`
      });
    }
  }
);

// Global Express Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Express global error handler:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Erro interno do servidor.' });
  }
});

// Vite middleware / Express static setup
async function startServer() {
  const bindHost = process.env.HOST || process.env.BIND_HOST || '0.0.0.0';
  const serverInstance = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');

    const viteServerOptions: any = {
      server: {
        middlewareMode: true,
        hmr: {
          server: serverInstance
        }
      },
      appType: 'spa'
    };

    const vite = await createViteServer(viteServerOptions);
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  serverInstance.listen(PORT, bindHost, () => {
    const displayHost = bindHost === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : bindHost;
    console.log(`Server running on http://${displayHost}:${PORT}`);

    // Initial auto-sync from external API after server start
    setTimeout(async () => {
      try {
        console.log('[Auto-Sync] Executando sincronização inicial com a API externa...');
        const res = await performApiSync();
        console.log('[Auto-Sync] Sincronização inicial concluída com sucesso:', res);
      } catch (err: any) {
        console.warn('[Auto-Sync] Falha na sincronização inicial:', err?.message || err);
      }
    }, 3000);

    // Periodic auto-sync every 30 minutes
    setInterval(async () => {
      try {
        console.log('[Auto-Sync] Executando sincronização periódica...');
        await performApiSync();
      } catch (err: any) {
        console.warn('[Auto-Sync] Falha na sincronização periódica:', err?.message || err);
      }
    }, 30 * 60 * 1000);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startServer();
}

export default app;
